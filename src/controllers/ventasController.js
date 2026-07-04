import Venta from "../models/Venta.js";
import DetalleVenta from "../models/DetalleVenta.js";
import Producto from "../models/Producto.js";
import StockSucursal from "../models/StockSucursalModel.js";
import Sucursal from "../models/SucursalModel.js";
import sequelize from "../config/database.js";
import { QueryTypes } from "sequelize";
import Caja from "../models/CajaModel.js";
import MovimientoInventario from "../models/MovimientoInventario.js";
import CfdiVenta from "../models/CfdiVenta.js";
import ClienteFiscal from "../models/ClienteFiscal.js";
import { esAdminEmpresa, resolverSucursalOperativa, responderErrorScope } from "../utils/scope.js";
import { registrarAuditoria } from "../utils/auditoria.js";
import { rangoFechasReporte } from "../utils/fechas.js";

function esCajaDeHoy(caja) {
  const fecha = new Date(caja.fecha_apertura);
  const hoy = new Date();
  return fecha.getFullYear() === hoy.getFullYear()
    && fecha.getMonth() === hoy.getMonth()
    && fecha.getDate() === hoy.getDate();
}

export const crearVenta = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const {
      usuario_id, total, tipo_venta, pedido_numero, folio, detalles,
      forma_pago, tipo_pago, descuento_porcentaje,
      nombre_cliente, telefono_cliente, direccion_entrega, referencia_entrega, estado_pedido,
      datos_cfdi
    } = req.body;
    const sucursal_id = await resolverSucursalOperativa(req);

    if (!["Tienda", "Pedido"].includes(tipo_venta)) throw new Error("tipo_venta debe ser 'Tienda' o 'Pedido'.");
    if (tipo_venta === "Pedido" && !pedido_numero?.trim()) throw new Error("El numero de pedido es obligatorio.");
    if (tipo_venta === "Pedido" && !nombre_cliente?.trim()) throw new Error("El nombre del cliente es obligatorio para pedidos.");
    if (!folio) throw new Error("El folio es obligatorio.");
    if (!usuario_id || !detalles?.length) throw new Error("Faltan detalles o el ID del usuario.");
    if (!Number.isFinite(Number(total)) || Number(total) <= 0) throw new Error("El total debe ser mayor a cero.");
    if (tipo_venta === "Pedido" && !telefono_cliente?.trim()) throw new Error("El telefono del cliente es obligatorio para pedidos.");
    if (tipo_venta === "Pedido" && !direccion_entrega?.trim()) throw new Error("La direccion de entrega es obligatoria para pedidos.");

    const cajaAbierta = await Caja.findOne({
      where: { fecha_cierre: null, sucursal_id },
      transaction: t
    });
    if (!cajaAbierta) {
      const error = new Error("No hay caja abierta para esta sucursal. Abre caja antes de vender.");
      error.status = 409;
      throw error;
    }
    if (!esCajaDeHoy(cajaAbierta)) {
      const error = new Error("Hay una caja abierta de un dia anterior. Cierrala en Corte de caja antes de vender.");
      error.status = 409;
      error.requiere_cierre = true;
      throw error;
    }

    const nuevaVenta = await Venta.create({
      usuario_id,
      total,
      folio,
      tipo_venta,
      pedido_numero,
      sucursal_id,
      forma_pago: forma_pago || null,
      tipo_pago: tipo_pago || "efectivo",
      descuento_porcentaje: descuento_porcentaje || 0,
      nombre_cliente: nombre_cliente?.trim() || null,
      telefono_cliente: telefono_cliente?.trim() || null,
      direccion_entrega: direccion_entrega?.trim() || null,
      referencia_entrega: referencia_entrega?.trim() || null,
      estado_pedido: estado_pedido || (tipo_venta === "Pedido" ? "PENDIENTE" : null)
    }, { transaction: t });

    for (const item of detalles) {
      const cantidadSolicitada = Number(item.cantidad);
      const precioUnitario = Number(item.precio_unitario);
      const subtotalItem = Number(item.subtotal);
      if (!Number.isInteger(cantidadSolicitada) || cantidadSolicitada <= 0) throw new Error("Cantidad invalida en detalle de venta.");
      if (!Number.isFinite(precioUnitario) || precioUnitario < 0) throw new Error("Precio invalido en detalle de venta.");
      if (!Number.isFinite(subtotalItem) || subtotalItem < 0) throw new Error("Subtotal invalido en detalle de venta.");

      const prod = await Producto.findOne({
        where: { producto_id: item.producto_id, empresa_id: req.usuario.empresa_id },
        transaction: t
      });
      if (!prod) throw new Error(`Producto ID ${item.producto_id} no existe.`);

      let stockReg = await StockSucursal.findOne({
        where: { producto_id: item.producto_id, sucursal_id },
        transaction: t
      });

      if (!stockReg) {
        stockReg = await StockSucursal.create({
          producto_id: item.producto_id,
          sucursal_id,
          stock_actual: prod.stock_actual || 0,
          stock_minimo: prod.stock_minimo || 0
        }, { transaction: t });
      }

      if (stockReg.stock_actual < item.cantidad) {
        throw new Error(`Stock insuficiente en ${prod.nombre}. Disponible: ${stockReg.stock_actual}`);
      }

      await DetalleVenta.create({
        venta_id: nuevaVenta.venta_id,
        producto_id: item.producto_id,
        nombre_producto: prod.nombre,
        codigo_barras: prod.codigo_barras,
        cantidad: item.cantidad,
        precio_unitario: item.precio_unitario,
        subtotal: item.subtotal
      }, { transaction: t });

      const stockAnterior = Number(stockReg.stock_actual) || 0;
      const cantidad = cantidadSolicitada;
      const stockNuevo = stockAnterior - cantidad;

      await stockReg.decrement("stock_actual", { by: cantidad, transaction: t });
      await prod.decrement("stock_actual", { by: cantidad, transaction: t });
      await MovimientoInventario.create({
        producto_id: item.producto_id,
        nombre_producto: prod.nombre,
        codigo_barras: prod.codigo_barras,
        usuario_id,
        sucursal_id,
        tipo_movimiento: "SALIDA",
        motivo: "VENTA",
        cantidad,
        stock_anterior: stockAnterior,
        stock_nuevo: stockNuevo,
        observaciones: `Venta ${folio}`,
        fecha: new Date()
      }, { transaction: t });
    }

    if (datos_cfdi) {
      const { receptor_rfc, receptor_nombre, receptor_cp, receptor_regimen, uso_cfdi, guardar_cliente } = datos_cfdi;
      let clienteId = null;

      if (guardar_cliente === true) {
        const [cliente] = await ClienteFiscal.findOrCreate({
          where: { empresa_id: req.usuario.empresa_id, rfc: receptor_rfc.toUpperCase() },
          defaults: {
            empresa_id: req.usuario.empresa_id,
            rfc: receptor_rfc.toUpperCase(),
            nombre_fiscal: receptor_nombre,
            cp_fiscal: receptor_cp,
            regimen_fiscal: receptor_regimen,
            uso_cfdi_default: uso_cfdi
          },
          transaction: t
        });
        clienteId = cliente.cliente_id;

        const sucursal = await Sucursal.findByPk(sucursal_id, { transaction: t });
        datos_cfdi.lugar_expedicion = sucursal?.cp_sat || receptor_cp;
      }

      await CfdiVenta.create({
        venta_id: nuevaVenta.venta_id,
        cliente_id: clienteId,
        receptor_rfc: receptor_rfc.toUpperCase(),
        receptor_nombre,
        receptor_cp,
        receptor_regimen,
        uso_cfdi,
        estado: "PENDIENTE"
      }, { transaction: t });
    }

    await registrarAuditoria(req, {
      accion: "VENTA_CREAR",
      entidad: "ventas",
      entidad_id: nuevaVenta.venta_id,
      sucursal_id,
      detalle: { folio, total, tipo_venta, tipo_pago: tipo_pago || "efectivo", pedido_numero },
      transaction: t
    });

    await t.commit();
    res.json({ msg: "Venta registrada", folio, venta_id: nuevaVenta.venta_id });
  } catch (error) {
    await t.rollback();
    responderErrorScope(res, error);
  }
};

export const getVentaPorId = async (req, res) => {
  try {
    const { id } = req.params;
    const empresa_id = req.usuario.empresa_id;
    const filtroEmpleado = esAdminEmpresa(req.usuario) ? "" : "AND v.sucursal_id = :sucursal_id";
    const [venta] = await sequelize.query(
      `SELECT v.venta_id, v.folio, v.fecha, v.total, v.tipo_venta, v.pedido_numero,
              v.nombre_cliente, v.telefono_cliente, v.direccion_entrega, v.referencia_entrega, v.estado_pedido,
              u.nombre AS nombre_cajero, s.nombre AS nombre_sucursal
       FROM ventas v
       LEFT JOIN usuarios u ON v.usuario_id = u.usuario_id
       LEFT JOIN sucursales s ON v.sucursal_id = s.sucursal_id
       WHERE v.venta_id = :id
         AND s.empresa_id = :empresa_id
         ${filtroEmpleado}`,
      { replacements: { id, empresa_id, sucursal_id: req.usuario.sucursal_id }, type: QueryTypes.SELECT }
    );
    if (!venta) return res.status(404).json({ error: "Venta no encontrada" });

    const detalles = await DetalleVenta.findAll({
      where: { venta_id: id },
      attributes: ["producto_id", "nombre_producto", "codigo_barras", "cantidad", "precio_unitario", "subtotal"]
    });

    res.json({
      ...venta,
      total: parseFloat(venta.total),
      detalles: detalles.map(d => ({
        producto_id: d.producto_id,
        nombre: d.nombre_producto,
        codigo_barras: d.codigo_barras,
        cantidad: d.cantidad,
        precio_unitario: parseFloat(d.precio_unitario),
        subtotal: parseFloat(d.subtotal)
      }))
    });
  } catch (err) {
    res.status(500).json({ error: "Error al obtener la venta" });
  }
};
export const listarPedidos = async (req, res) => {
  try {
    const fechaInicio = req.query.fechaInicio || new Date().toISOString().slice(0, 10);
    const fechaFin = req.query.fechaFin || fechaInicio;
    const { inicio, fin } = rangoFechasReporte(fechaInicio, fechaFin);
    const empresa_id = req.usuario.empresa_id;
    const filtroEmpleado = esAdminEmpresa(req.usuario) ? "" : "AND v.sucursal_id = :sucursal_id";

    const pedidos = await sequelize.query(
      `SELECT v.venta_id, v.folio, v.fecha, v.total, v.tipo_venta, v.pedido_numero,
              v.nombre_cliente, v.telefono_cliente, v.direccion_entrega, v.referencia_entrega,
              COALESCE(v.estado_pedido, 'PENDIENTE') as estado_pedido,
              u.nombre AS nombre_cajero, s.nombre AS nombre_sucursal
       FROM ventas v
       LEFT JOIN usuarios u ON v.usuario_id = u.usuario_id
       LEFT JOIN sucursales s ON v.sucursal_id = s.sucursal_id
       WHERE v.tipo_venta = 'Pedido'
         AND v.fecha BETWEEN :inicio AND :fin
         AND s.empresa_id = :empresa_id
         ${filtroEmpleado}
       ORDER BY
         CASE COALESCE(v.estado_pedido, 'PENDIENTE')
           WHEN 'PENDIENTE' THEN 1
           WHEN 'ENVIADO' THEN 2
           WHEN 'ENTREGADO' THEN 3
           ELSE 4
         END,
         v.fecha DESC`,
      { replacements: { inicio, fin, empresa_id, sucursal_id: req.usuario.sucursal_id }, type: QueryTypes.SELECT }
    );

    const resumen = pedidos.reduce((acc, p) => {
      const estado = p.estado_pedido || 'PENDIENTE';
      acc.total += 1;
      acc[estado.toLowerCase()] = (acc[estado.toLowerCase()] || 0) + 1;
      return acc;
    }, { total: 0, pendiente: 0, enviado: 0, entregado: 0, cancelado: 0 });

    res.json({ datos: pedidos, resumen });
  } catch (err) {
    res.status(500).json({ error: "Error al listar pedidos" });
  }
};

export const actualizarEstadoPedido = async (req, res) => {
  const ventaId = Number(req.params.id);
  const estado = String(req.body.estado || '').toUpperCase();
  const estadosValidos = ['PENDIENTE', 'ENVIADO', 'ENTREGADO', 'CANCELADO'];
  if (!ventaId) return res.status(400).json({ error: 'venta_id requerido' });
  if (!estadosValidos.includes(estado)) return res.status(400).json({ error: 'Estado de pedido no valido' });

  const t = await sequelize.transaction();
  try {
    const filtroEmpleado = esAdminEmpresa(req.usuario) ? "" : "AND v.sucursal_id = :sucursal_id";
    const [pedido] = await sequelize.query(
      `SELECT v.venta_id, v.folio, v.sucursal_id, v.estado_pedido, s.empresa_id
       FROM ventas v
       JOIN sucursales s ON v.sucursal_id = s.sucursal_id
       WHERE v.venta_id = :ventaId
         AND v.tipo_venta = 'Pedido'
         AND s.empresa_id = :empresa_id
         ${filtroEmpleado}`,
      { replacements: { ventaId, empresa_id: req.usuario.empresa_id, sucursal_id: req.usuario.sucursal_id }, type: QueryTypes.SELECT, transaction: t }
    );

    if (!pedido) {
      await t.rollback();
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    await Venta.update({ estado_pedido: estado }, { where: { venta_id: ventaId }, transaction: t });
    await registrarAuditoria(req, {
      accion: 'PEDIDO_ESTADO',
      entidad: 'ventas',
      entidad_id: ventaId,
      sucursal_id: pedido.sucursal_id,
      detalle: { folio: pedido.folio, estado_anterior: pedido.estado_pedido || 'PENDIENTE', estado_nuevo: estado },
      transaction: t
    });

    await t.commit();
    res.json({ mensaje: 'Estado de pedido actualizado', estado });
  } catch (err) {
    await t.rollback();
    responderErrorScope(res, err);
  }
};



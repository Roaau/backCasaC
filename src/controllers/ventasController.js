import Venta from "../models/Venta.js";
import DetalleVenta from "../models/DetalleVenta.js";
import Producto from "../models/Producto.js";
import StockSucursal from "../models/StockSucursalModel.js";
import Sucursal from "../models/SucursalModel.js";
import Empresa from "../models/EmpresaModel.js";
import sequelize from "../config/database.js";
import { QueryTypes } from "sequelize";
import Caja from "../models/CajaModel.js";
import MovimientoInventario from "../models/MovimientoInventario.js";
import MovimientoCaja from "../models/MovimientoCaja.js";
import Devolucion from "../models/Devolucion.js";
import DetalleDevolucion from "../models/DetalleDevolucion.js";
import CfdiVenta from "../models/CfdiVenta.js";
import ClienteFiscal from "../models/ClienteFiscal.js";
import { esAdminEmpresa, resolverSucursalOperativa, responderErrorScope } from "../utils/scope.js";
import { registrarAuditoria } from "../utils/auditoria.js";
import { rangoFechasReporte, esMismoDiaLocal, fechaLocalISO } from "../utils/fechas.js";
import { validarLineaVenta, calcularTotalVenta } from "../utils/ventas.js";
import { cfdiHabilitado } from "../config/features.js";
import { cantidadValida } from "../utils/giros.js";
import { regresarAInventario } from "../utils/inventario.js";

const esCajaDeHoy = (caja) => esMismoDiaLocal(caja.fecha_apertura);

export const crearVenta = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const {
      total, tipo_venta, pedido_numero, folio, detalles,
      forma_pago, tipo_pago, descuento_porcentaje, iva_porcentaje,
      nombre_cliente, telefono_cliente, direccion_entrega, referencia_entrega, estado_pedido
    } = req.body;
    // El cajero es quien trae el token, no el usuario_id que mande el navegador
    const usuario_id = req.usuario.id;
    const datos_cfdi = cfdiHabilitado() ? req.body.datos_cfdi : null;
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

    let subtotalServidor = 0;
    for (const item of detalles) {
      const cantidadSolicitada = Number(item.cantidad);
      const precioUnitario = Number(item.precio_unitario);
      const subtotalItem = Number(item.subtotal);
      if (!Number.isFinite(cantidadSolicitada) || cantidadSolicitada <= 0) throw new Error("Cantidad invalida en detalle de venta.");
      if (!Number.isFinite(precioUnitario) || precioUnitario < 0) throw new Error("Precio invalido en detalle de venta.");
      if (!Number.isFinite(subtotalItem) || subtotalItem < 0) throw new Error("Subtotal invalido en detalle de venta.");

      const prod = await Producto.findOne({
        where: { producto_id: item.producto_id, empresa_id: req.usuario.empresa_id },
        transaction: t
      });
      if (!prod) throw new Error(`Producto ID ${item.producto_id} no existe.`);
      if (!cantidadValida(cantidadSolicitada, prod.unidad_venta)) {
        throw new Error(`Cantidad invalida para ${prod.nombre}: se vende por ${prod.unidad_venta || "pieza"}.`);
      }
      if (prod.fecha_caducidad && prod.fecha_caducidad < fechaLocalISO()) {
        const error = new Error(`${prod.nombre} esta caducado (${prod.fecha_caducidad}). No se puede vender.`);
        error.status = 409;
        throw error;
      }

      const linea = validarLineaVenta(prod, cantidadSolicitada, precioUnitario);
      subtotalServidor += linea.subtotal;

      // lock: evita que dos cajas vendan la misma ultima pieza al mismo tiempo
      let stockReg = await StockSucursal.findOne({
        where: { producto_id: item.producto_id, sucursal_id },
        transaction: t,
        lock: true
      });

      if (!stockReg) {
        stockReg = await StockSucursal.create({
          producto_id: item.producto_id,
          sucursal_id,
          stock_actual: prod.stock_actual || 0,
          stock_minimo: prod.stock_minimo || 0
        }, { transaction: t });
      }

      if (Number(stockReg.stock_actual) < cantidadSolicitada) {
        throw new Error(`Stock insuficiente en ${prod.nombre}. Disponible: ${stockReg.stock_actual}`);
      }

      await DetalleVenta.create({
        venta_id: nuevaVenta.venta_id,
        producto_id: item.producto_id,
        nombre_producto: prod.nombre,
        codigo_barras: prod.codigo_barras,
        cantidad: cantidadSolicitada,
        precio_unitario: linea.precio_unitario,
        subtotal: linea.subtotal
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

    // El IVA sale de la configuracion de la empresa, no de lo que mande el navegador
    const empresaIva = await Empresa.findByPk(req.usuario.empresa_id, { attributes: ['iva_activo', 'iva_porcentaje'], transaction: t });
    const ivaEmpresa = empresaIva?.iva_activo ? Number(empresaIva.iva_porcentaje) || 0 : 0;
    if (iva_porcentaje !== undefined && iva_porcentaje !== null && Number(iva_porcentaje) !== ivaEmpresa) {
      const error = new Error('La configuración de IVA del negocio cambió. Recarga la página e intenta de nuevo.');
      error.status = 409;
      throw error;
    }
    const totalServidor = calcularTotalVenta({
      subtotal: subtotalServidor,
      ivaPorcentaje: ivaEmpresa,
      descuentoPorcentaje: descuento_porcentaje,
      totalEnviado: total
    });
    await nuevaVenta.update({ total: totalServidor }, { transaction: t });

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
      detalle: { folio, total: totalServidor, tipo_venta, tipo_pago: tipo_pago || "efectivo", pedido_numero },
      transaction: t
    });

    await t.commit();
    res.json({ msg: "Venta registrada", folio, venta_id: nuevaVenta.venta_id, total: totalServidor });
  } catch (error) {
    await t.rollback();
    responderErrorScope(res, error);
  }
};

// GET /api/ventas/hoy — ventas de hoy de la sucursal operativa.
// Empleado: solo las suyas. Admin: todas las de la sucursal, con el desglose por cajero.
export const ventasDeHoy = async (req, res) => {
  try {
    const sucursal_id = await resolverSucursalOperativa(req);
    const admin = esAdminEmpresa(req.usuario);
    const soloMias = !admin || req.query.mias === 'true';
    const { inicio, fin } = rangoFechasReporte(fechaLocalISO());
    const ventas = await sequelize.query(`
      SELECT v.venta_id, v.folio, v.fecha, v.total, v.tipo_venta,
             COALESCE(v.tipo_pago, 'efectivo') AS tipo_pago, v.pedido_numero, v.nombre_cliente,
             v.estado_pedido, v.usuario_id, u.nombre AS nombre_cajero
      FROM ventas v
      LEFT JOIN usuarios u ON u.usuario_id = v.usuario_id
      WHERE v.sucursal_id = :sucursal_id
        AND v.fecha BETWEEN :inicio AND :fin
        ${soloMias ? 'AND v.usuario_id = :usuario_id' : ''}
      ORDER BY v.fecha DESC
    `, { replacements: { sucursal_id, inicio, fin, usuario_id: req.usuario.id }, type: QueryTypes.SELECT });

    const suma = (lista) => Math.round(lista.reduce((s, v) => s + Number(v.total || 0), 0) * 100) / 100;
    const porCajero = new Map();
    for (const v of ventas) {
      const clave = v.usuario_id ?? 0;
      const actual = porCajero.get(clave) || { usuario_id: v.usuario_id, nombre: v.nombre_cajero || 'Sin nombre', ventas: 0, total: 0 };
      actual.ventas += 1;
      actual.total = Math.round((actual.total + Number(v.total || 0)) * 100) / 100;
      porCajero.set(clave, actual);
    }
    res.json({
      solo_mias: soloMias,
      resumen: {
        total: suma(ventas),
        conteo: ventas.length,
        efectivo: suma(ventas.filter(v => v.tipo_pago === 'efectivo')),
        terminal: suma(ventas.filter(v => v.tipo_pago !== 'efectivo')),
      },
      por_cajero: [...porCajero.values()].sort((a, b) => b.total - a.total),
      ventas: ventas.slice(0, 50),
    });
  } catch (e) {
    responderErrorScope(res, e);
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
    const fechaInicio = req.query.fechaInicio || fechaLocalISO();
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

const redondear2 = (n) => Math.round(n * 100) / 100;

// Cancelar un pedido equivale a devolverlo completo: regresa a inventario lo que no se haya devuelto antes
// y, si se cobro en efectivo, registra la salida del dinero en la caja abierta de esa sucursal.
// Se guarda como devolucion para que caja y reportes lo descuenten igual que cualquier devolucion.
export async function revertirPedidoCancelado(req, pedido, transaction) {
  const vendidos = await DetalleVenta.findAll({ where: { venta_id: pedido.venta_id }, transaction });
  const previas = await Devolucion.findAll({ where: { venta_id: pedido.venta_id }, attributes: ['devolucion_id'], transaction });
  const devuelto = new Map();
  if (previas.length) {
    const detallesPrevios = await DetalleDevolucion.findAll({
      where: { devolucion_id: previas.map(d => d.devolucion_id) },
      transaction
    });
    for (const d of detallesPrevios) {
      devuelto.set(d.producto_id, (devuelto.get(d.producto_id) || 0) + Number(d.cantidad));
    }
  }

  // Mismo prorrateo que devoluciones: aplica el IVA/descuento que tuvo la venta
  const base = vendidos.reduce((s, v) => s + Number(v.precio_unitario) * Number(v.cantidad), 0);
  const ratio = base > 0 ? Number(pedido.total) / base : 1;
  const lineas = vendidos
    .map(v => {
      const cantidad = Math.round((Number(v.cantidad) - (devuelto.get(v.producto_id) || 0)) * 1000) / 1000;
      return { v, cantidad, subtotal: redondear2(Number(v.precio_unitario) * cantidad * ratio) };
    })
    .filter(l => l.cantidad > 0);

  const totalDevuelto = redondear2(lineas.reduce((s, l) => s + l.subtotal, 0));
  if (!lineas.length) return { productos: 0, totalDevuelto: 0, efectivo: false };

  const efectivo = (pedido.tipo_pago || 'efectivo') === 'efectivo';
  let caja = null;
  if (efectivo && totalDevuelto > 0) {
    caja = await Caja.findOne({ where: { sucursal_id: pedido.sucursal_id, fecha_cierre: null }, transaction });
    if (!caja) {
      const error = new Error('Abre la caja de la sucursal del pedido para registrar la devolución del dinero.');
      error.status = 409;
      throw error;
    }
  }

  const usuario_id = req.usuario.id;
  const dev = await Devolucion.create({
    venta_id: pedido.venta_id,
    folio_venta: pedido.folio,
    motivo: 'Pedido cancelado',
    usuario_id,
    sucursal_id: pedido.sucursal_id,
    total_devuelto: totalDevuelto
  }, { transaction });

  for (const { v, cantidad, subtotal } of lineas) {
    await DetalleDevolucion.create({
      devolucion_id: dev.devolucion_id,
      producto_id: v.producto_id,
      nombre_producto: v.nombre_producto,
      cantidad,
      precio_unitario: v.precio_unitario,
      subtotal
    }, { transaction });

    await regresarAInventario({
      producto_id: v.producto_id,
      nombre_producto: v.nombre_producto,
      codigo_barras: v.codigo_barras || null,
      cantidad,
      sucursal_id: pedido.sucursal_id,
      usuario_id,
      motivo: 'CANCELACION',
      observaciones: `Pedido cancelado ${pedido.folio}`,
      transaction
    });
  }

  if (caja) {
    await MovimientoCaja.create({
      caja_id: caja.caja_id,
      usuario_id,
      tipo_movimiento: 'DEVOLUCION',
      monto: totalDevuelto,
      concepto: `Pedido cancelado ${pedido.folio}`,
      fecha: new Date()
    }, { transaction });
  }

  return { productos: lineas.length, totalDevuelto, efectivo: !!caja };
}

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
      `SELECT v.venta_id, v.folio, v.sucursal_id, v.estado_pedido, v.total, v.tipo_pago, s.empresa_id
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

    const estadoActual = pedido.estado_pedido || 'PENDIENTE';
    if (estadoActual === 'CANCELADO' && estado !== 'CANCELADO') {
      const error = new Error('El pedido ya está cancelado y su mercancía regresó al inventario; no se puede reactivar.');
      error.status = 409;
      throw error;
    }
    if (estadoActual === 'CANCELADO') {
      await t.rollback();
      return res.json({ mensaje: 'El pedido ya estaba cancelado', estado });
    }
    if (estado === 'CANCELADO' && estadoActual === 'ENTREGADO') {
      const error = new Error('El pedido ya se entregó. Para regresarlo registra una devolución.');
      error.status = 409;
      throw error;
    }

    let reverso = null;
    if (estado === 'CANCELADO') reverso = await revertirPedidoCancelado(req, pedido, t);

    await Venta.update({ estado_pedido: estado }, { where: { venta_id: ventaId }, transaction: t });
    await registrarAuditoria(req, {
      accion: 'PEDIDO_ESTADO',
      entidad: 'ventas',
      entidad_id: ventaId,
      sucursal_id: pedido.sucursal_id,
      detalle: { folio: pedido.folio, estado_anterior: estadoActual, estado_nuevo: estado, ...(reverso ? { reverso } : {}) },
      transaction: t
    });

    await t.commit();
    let mensaje = 'Estado de pedido actualizado';
    if (reverso) {
      mensaje = reverso.productos
        ? `Pedido cancelado. La mercancía regresó al inventario${reverso.efectivo ? ` y salen ${reverso.totalDevuelto.toFixed(2)} de la caja` : ''}.`
        : 'Pedido cancelado.';
    }
    res.json({ mensaje, estado, ...(reverso ? { reverso } : {}) });
  } catch (err) {
    await t.rollback();
    responderErrorScope(res, err);
  }
};



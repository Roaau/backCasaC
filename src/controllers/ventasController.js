import Venta from "../models/Venta.js";
import DetalleVenta from "../models/DetalleVenta.js";
import Producto from "../models/Producto.js";
import StockSucursal from "../models/StockSucursalModel.js";
import Sucursal from "../models/SucursalModel.js";
import Usuario from "../models/Usuario.js";
import sequelize from "../config/database.js";
import { QueryTypes } from "sequelize";
import Caja from "../models/CajaModel.js";
import MovimientoCaja from "../models/MovimientoCaja.js";
import CfdiVenta from "../models/CfdiVenta.js";
import ClienteFiscal from "../models/ClienteFiscal.js";

export const crearVenta = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { usuario_id, total, tipo_venta, pedido_numero, folio, detalles, forma_pago, datos_cfdi } = req.body;
    const sucursal_id = req.body.sucursal_id || req.usuario.sucursal_id || 1;

    if (!['Tienda', 'Pedido'].includes(tipo_venta)) throw new Error("tipo_venta debe ser 'Tienda' o 'Pedido'.");
    if (tipo_venta === 'Pedido' && !pedido_numero?.trim()) throw new Error("El número de pedido es obligatorio.");
    if (!folio) throw new Error("El folio es obligatorio.");
    if (!usuario_id || !detalles?.length) throw new Error("Faltan detalles o el ID del usuario.");

    const nuevaVenta = await Venta.create({
      usuario_id, total, folio, tipo_venta, pedido_numero,
      sucursal_id,
      forma_pago: forma_pago || null
    }, { transaction: t });

    for (const item of detalles) {
      const prod = await Producto.findByPk(item.producto_id, { transaction: t });
      if (!prod) throw new Error(`Producto ID ${item.producto_id} no existe.`);

      // Stock por sucursal
      let stockReg = await StockSucursal.findOne({
        where: { producto_id: item.producto_id, sucursal_id },
        transaction: t
      });

      // Si no existe registro de stock para esta sucursal, usamos stock global
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
        venta_id:       nuevaVenta.venta_id,
        producto_id:    item.producto_id,
        nombre_producto: prod.nombre,
        codigo_barras:  prod.codigo_barras,
        cantidad:       item.cantidad,
        precio_unitario: item.precio_unitario,
        subtotal:       item.subtotal
      }, { transaction: t });

      await stockReg.decrement('stock_actual', { by: item.cantidad, transaction: t });
      await prod.decrement('stock_actual', { by: item.cantidad, transaction: t });
    }

    const cajaActiva = await Caja.findOne({
      where: { fecha_cierre: null, sucursal_id },
      transaction: t
    });
    // Las ventas se suman vía query directo en obtenerTotalesCaja — no crear INGRESO aquí para evitar doble conteo

    if (datos_cfdi) {
      const { receptor_rfc, receptor_nombre, receptor_cp, receptor_regimen, uso_cfdi, guardar_cliente } = datos_cfdi;
      let clienteId = null;

      if (guardar_cliente === true) {
        const [cliente] = await ClienteFiscal.findOrCreate({
          where: { rfc: receptor_rfc.toUpperCase() },
          defaults: { rfc: receptor_rfc.toUpperCase(), nombre_fiscal: receptor_nombre, cp_fiscal: receptor_cp, regimen_fiscal: receptor_regimen, uso_cfdi_default: uso_cfdi },
          transaction: t
        });
        clienteId = cliente.cliente_id;

        // Obtener cp_sat de la sucursal para LugarExpedicion
        const sucursal = await Sucursal.findByPk(sucursal_id, { transaction: t });
        datos_cfdi.lugar_expedicion = sucursal?.cp_sat || receptor_cp;
      }

      await CfdiVenta.create({
        venta_id: nuevaVenta.venta_id, cliente_id: clienteId,
        receptor_rfc: receptor_rfc.toUpperCase(), receptor_nombre, receptor_cp,
        receptor_regimen, uso_cfdi, estado: "PENDIENTE"
      }, { transaction: t });
    }

    await t.commit();
    res.json({ msg: "Venta registrada", folio, venta_id: nuevaVenta.venta_id });

  } catch (error) {
    await t.rollback();
    res.status(500).json({ error: error.message });
  }
};

export const getVentaPorId = async (req, res) => {
  try {
    const { id } = req.params;
    const empresa_id = req.usuario.empresa_id;
    const [venta] = await sequelize.query(
      `SELECT v.venta_id, v.folio, v.fecha, v.total, v.tipo_venta, v.pedido_numero,
              u.nombre AS nombre_cajero, s.nombre AS nombre_sucursal
       FROM ventas v
       LEFT JOIN usuarios u ON v.usuario_id = u.usuario_id
       LEFT JOIN sucursales s ON v.sucursal_id = s.sucursal_id
       WHERE v.venta_id = :id
         AND s.empresa_id = :empresa_id`,
      { replacements: { id, empresa_id }, type: QueryTypes.SELECT }
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
        producto_id: d.producto_id, nombre: d.nombre_producto, codigo_barras: d.codigo_barras,
        cantidad: d.cantidad, precio_unitario: parseFloat(d.precio_unitario), subtotal: parseFloat(d.subtotal)
      }))
    });
  } catch (err) {
    res.status(500).json({ error: "Error al obtener la venta" });
  }
};

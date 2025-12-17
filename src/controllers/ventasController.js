import Venta from "../models/Venta.js";
import DetalleVenta from "../models/DetalleVenta.js";
import Producto from "../models/Producto.js";
import Usuario from "../models/Usuario.js";
import sequelize from "../config/database.js";

// 👇 IMPORTAR LOS MODELOS DE CAJA
import Caja from "../models/CajaModel.js";
import MovimientoCaja from "../models/MovimientoCaja.js";

export const crearVenta = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { usuario_id, total, tipo_venta, pedido_numero, detalles } = req.body;

    if (!usuario_id || !detalles || detalles.length === 0) {
      throw new Error("Faltan detalles o el ID del usuario.");
    }

    const existente = await Venta.findOne({
    where: { uuid: req.body.uuid },
    transaction: t
    });
    
    if (existente) {
      await t.rollback();
      return res.status(409).json({ error: 'Venta duplicada' });
    }


    // =======================================
    // 📌 CREAR VENTA (CABECERA)
    // =======================================
    const nuevaVenta = await Venta.create({
      usuario_id,
      total,
      tipo_venta,
      pedido_numero
    }, { transaction: t });

    // =======================================
    // 📌 DETALLES + VERIFICAR Y RESTAR STOCK
    // =======================================
    for (const item of detalles) {
      const prod = await Producto.findByPk(item.producto_id, { transaction: t });

      if (!prod) throw new Error(`Producto ID ${item.producto_id} no existe.`);
      if (prod.stock_actual < item.cantidad) {
        throw new Error(`Stock insuficiente en ${prod.nombre}. Stock: ${prod.stock_actual}`);
      }

      await DetalleVenta.create({
        venta_id: nuevaVenta.venta_id,
        producto_id: item.producto_id,
        cantidad: item.cantidad,
        precio_unitario: item.precio_unitario,
        subtotal: item.subtotal
      }, { transaction: t });

      await prod.decrement('stock_actual', { by: item.cantidad, transaction: t });
    }

    // ====================================================
    // 📌 NUEVO: REGISTRAR MOVIMIENTO EN CAJA (SI HAY ABIERTA)
    // ====================================================
    const cajaActiva = await Caja.findOne({
      where: { fecha_cierre: null }, // caja abierta
      transaction: t
    });

    if (cajaActiva) {
      await MovimientoCaja.create({
        caja_id: cajaActiva.caja_id,
        usuario_id,
        tipo_movimiento: "INGRESO",
        monto: total,
        concepto: `Venta folio ${folio}`
      }, { transaction: t });
    }

    // =======================================
    // 📌 CONFIRMAR TRANSACCIÓN COMPLETA
    // =======================================
    await t.commit();

    res.json({ msg: "Venta registrada", folio, venta_id: nuevaVenta.venta_id });

  } catch (error) {
    await t.rollback();
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

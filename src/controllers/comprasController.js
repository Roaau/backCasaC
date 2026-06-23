import sequelize from "../config/database.js";
import Compra from "../models/Compra.js";
import DetalleCompra from "../models/DetalleCompra.js";
import Proveedor from "../models/Proveedor.js";
import Producto from "../models/Producto.js";
import StockSucursal from "../models/StockSucursalModel.js";
import CajaModel from "../models/CajaModel.js";
import MovimientoCaja from "../models/MovimientoCaja.js";
import { Op } from "sequelize";

export const listarCompras = async (req, res) => {
  try {
    const esAdmin = req.usuario.rol === 1 || req.usuario.rol_id === 1;
    const filtro = esAdmin
      ? { empresa_id: req.usuario.empresa_id }
      : { sucursal_id: req.usuario.sucursal_id };

    const { fechaInicio, fechaFin } = req.query;
    if (fechaInicio && fechaFin) {
      filtro.fecha = {
        [Op.between]: [
          new Date(`${fechaInicio}T00:00:00`),
          new Date(`${fechaFin}T23:59:59`)
        ]
      };
    }

    const compras = await Compra.findAll({
      where: filtro,
      order: [['fecha', 'DESC']],
      limit: 200
    });

    const ids = compras.map(c => c.compra_id);
    const detalles = ids.length
      ? await DetalleCompra.findAll({ where: { compra_id: ids } })
      : [];

    const proveedorIds = [...new Set(compras.map(c => c.proveedor_id).filter(Boolean))];
    const proveedores = proveedorIds.length
      ? await Proveedor.findAll({ where: { proveedor_id: proveedorIds } })
      : [];
    const provMap = Object.fromEntries(proveedores.map(p => [p.proveedor_id, p.nombre]));

    const result = compras.map(c => ({
      ...c.toJSON(),
      proveedor_nombre: provMap[c.proveedor_id] ?? null,
      detalles: detalles.filter(d => d.compra_id === c.compra_id)
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener compras', detalle: err.message });
  }
};

export const crearCompra = async (req, res) => {
  const { proveedor_id, folio, notas, items, descontar_de_caja } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Se requieren productos en la compra' });
  }

  const t = await sequelize.transaction();
  try {
    const total = items.reduce((s, i) => s + Number(i.costo_unitario) * Number(i.cantidad), 0);

    const compra = await Compra.create({
      empresa_id:  req.usuario.empresa_id,
      sucursal_id: req.usuario.sucursal_id,
      usuario_id:  req.usuario.id,
      proveedor_id: proveedor_id || null,
      folio: folio || null,
      notas: notas || null,
      total,
      fecha: new Date()
    }, { transaction: t });

    for (const item of items) {
      await DetalleCompra.create({
        compra_id:       compra.compra_id,
        producto_id:     item.producto_id || null,
        nombre_producto: item.nombre_producto,
        cantidad:        item.cantidad,
        costo_unitario:  item.costo_unitario,
        subtotal:        Number(item.costo_unitario) * Number(item.cantidad)
      }, { transaction: t });

      // Actualiza stock si el producto existe
      if (item.producto_id) {
        const stock = await StockSucursal.findOne({
          where: { producto_id: item.producto_id, sucursal_id: req.usuario.sucursal_id },
          transaction: t
        });
        if (stock) {
          await stock.update({ cantidad: stock.cantidad + Number(item.cantidad) }, { transaction: t });
        } else {
          await StockSucursal.create({
            producto_id:  item.producto_id,
            sucursal_id:  req.usuario.sucursal_id,
            cantidad:     item.cantidad,
            stock_minimo: 0
          }, { transaction: t });
        }
        // Actualiza costo en producto
        await Producto.update(
          { precio_costo: item.costo_unitario },
          { where: { producto_id: item.producto_id }, transaction: t }
        );
      }
    }

    // Opcional: registrar egreso en la caja abierta
    if (descontar_de_caja) {
      const cajaAbierta = await CajaModel.findOne({
        where: { sucursal_id: req.usuario.sucursal_id, estado: 'ABIERTA' }
      });
      if (cajaAbierta) {
        await MovimientoCaja.create({
          caja_id:          cajaAbierta.caja_id,
          usuario_id:       req.usuario.id,
          tipo_movimiento:  'EGRESO',
          monto:            total,
          concepto:         `Pago compra${folio ? ' ' + folio : ''}${proveedor_id ? ' — proveedor' : ''}`
        });
      }
    }

    await t.commit();
    res.status(201).json({ mensaje: 'Compra registrada', compra_id: compra.compra_id });
  } catch (err) {
    await t.rollback();
    res.status(500).json({ error: 'Error al registrar compra', detalle: err.message });
  }
};

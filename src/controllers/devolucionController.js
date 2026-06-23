import Venta from '../models/Venta.js';
import DetalleVenta from '../models/DetalleVenta.js';
import Devolucion from '../models/Devolucion.js';
import DetalleDevolucion from '../models/DetalleDevolucion.js';
import StockSucursal from '../models/StockSucursalModel.js';
import Sucursal from '../models/SucursalModel.js';
import Caja from '../models/CajaModel.js';
import MovimientoCaja from '../models/MovimientoCaja.js';
import sequelize from '../config/database.js';
import { Op } from 'sequelize';

export const buscarVenta = async (req, res) => {
  try {
    const empresa_id = req.usuario.empresa_id;
    const venta = await Venta.findOne({ where: { folio: req.params.folio } });
    if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });
    const sucursal = await Sucursal.findOne({ where: { sucursal_id: venta.sucursal_id, empresa_id } });
    if (!sucursal) return res.status(404).json({ error: 'Venta no encontrada' });
    const detalles = await DetalleVenta.findAll({ where: { venta_id: venta.venta_id } });
    res.json({ ...venta.toJSON(), detalles });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const crear = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { venta_id, folio_venta, motivo, usuario_id, sucursal_id, detalles } = req.body;
    if (!detalles?.length) throw new Error('Debe seleccionar al menos un producto a devolver');

    const totalDevuelto = detalles.reduce((s, d) => s + Number(d.subtotal), 0);

    const dev = await Devolucion.create(
      { venta_id, folio_venta, motivo, usuario_id, sucursal_id, total_devuelto: totalDevuelto },
      { transaction: t }
    );

    for (const d of detalles) {
      await DetalleDevolucion.create({
        devolucion_id:   dev.devolucion_id,
        producto_id:     d.producto_id,
        nombre_producto: d.nombre_producto,
        cantidad:        d.cantidad,
        precio_unitario: d.precio_unitario,
        subtotal:        d.subtotal
      }, { transaction: t });

      if (d.producto_id && sucursal_id) {
        const stock = await StockSucursal.findOne({
          where: { producto_id: d.producto_id, sucursal_id },
          transaction: t
        });
        if (stock) await stock.increment('stock_actual', { by: d.cantidad, transaction: t });
      }
    }

    // Registrar como movimiento de la caja activa
    // Busca por caja_id explícito si viene, o por sucursal_id + abierta
    const { caja_id: cajaIdBody } = req.body;
    const cajaAbierta = cajaIdBody
      ? await Caja.findOne({ where: { caja_id: cajaIdBody, fecha_cierre: null }, transaction: t })
      : await Caja.findOne({ where: { sucursal_id, fecha_cierre: null }, transaction: t });

    if (cajaAbierta) {
      await MovimientoCaja.create({
        caja_id: cajaAbierta.caja_id,
        usuario_id,
        tipo_movimiento: 'DEVOLUCION',
        monto: totalDevuelto,
        concepto: `Devolución de venta ${folio_venta}${motivo ? ': ' + motivo : ''}`,
        fecha: new Date()
      }, { transaction: t });
    }

    await t.commit();
    res.json({ ok: true, devolucion_id: dev.devolucion_id, total_devuelto: totalDevuelto });
  } catch (e) {
    await t.rollback();
    res.status(500).json({ error: e.message });
  }
};

export const listar = async (req, res) => {
  try {
    const { sucursal_id, page = 1, limit = 20 } = req.query;
    const empresa_id = req.usuario.empresa_id;
    const offset = (Number(page) - 1) * Number(limit);

    const sucursalesEmpresa = await Sucursal.findAll({
      where: { empresa_id },
      attributes: ['sucursal_id']
    });
    const sucursalIds = sucursalesEmpresa.map(s => s.sucursal_id);

    const filtroSucursal = sucursal_id && sucursalIds.includes(Number(sucursal_id))
      ? Number(sucursal_id)
      : null;

    const where = filtroSucursal
      ? { sucursal_id: filtroSucursal }
      : { sucursal_id: { [Op.in]: sucursalIds } };

    const { count, rows } = await Devolucion.findAndCountAll({
      where, order: [['fecha', 'DESC']], limit: Number(limit), offset
    });

    const data = await Promise.all(rows.map(async d => {
      const detalles = await DetalleDevolucion.findAll({ where: { devolucion_id: d.devolucion_id } });
      return { ...d.toJSON(), detalles };
    }));

    res.json({ data, total: count, page: Number(page), totalPaginas: Math.ceil(count / Number(limit)) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const getHoy = async (req, res) => {
  try {
    const { sucursal_id } = req.query;
    const empresa_id = req.usuario.empresa_id;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const manana = new Date(hoy);
    manana.setDate(hoy.getDate() + 1);

    const sucursalesEmpresa = await Sucursal.findAll({
      where: { empresa_id },
      attributes: ['sucursal_id']
    });
    const sucursalIds = sucursalesEmpresa.map(s => s.sucursal_id);

    const where = { fecha: { [Op.gte]: hoy, [Op.lt]: manana } };
    if (sucursal_id && sucursalIds.includes(Number(sucursal_id))) {
      where.sucursal_id = Number(sucursal_id);
    } else {
      where.sucursal_id = { [Op.in]: sucursalIds };
    }

    const devs = await Devolucion.findAll({ where });
    const total = devs.reduce((s, d) => s + Number(d.total_devuelto), 0);
    res.json({ total, count: devs.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

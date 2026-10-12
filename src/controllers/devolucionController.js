import Venta from '../models/Venta.js';
import DetalleVenta from '../models/DetalleVenta.js';
import Devolucion from '../models/Devolucion.js';
import DetalleDevolucion from '../models/DetalleDevolucion.js';
import StockSucursal from '../models/StockSucursalModel.js';
import Sucursal from '../models/SucursalModel.js';
import Caja from '../models/CajaModel.js';
import MovimientoCaja from '../models/MovimientoCaja.js';
import MovimientoInventario from '../models/MovimientoInventario.js';
import sequelize from '../config/database.js';
import { Op } from 'sequelize';
import {
  esAdminEmpresa,
  resolverScopeSucursales,
  resolverSucursalOperativa,
  responderErrorScope,
  validarSucursalEmpresa
} from '../utils/scope.js';
import { cantidadValida } from '../utils/giros.js';

export const buscarVenta = async (req, res) => {
  try {
    const empresa_id = req.usuario.empresa_id;
    const venta = await Venta.findOne({ where: { folio: req.params.folio } });
    if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });
    const sucursal = await Sucursal.findOne({ where: { sucursal_id: venta.sucursal_id, empresa_id } });
    if (!sucursal) return res.status(404).json({ error: 'Venta no encontrada' });
    if (!esAdminEmpresa(req.usuario) && venta.sucursal_id !== req.usuario.sucursal_id) {
      return res.status(404).json({ error: 'Venta no encontrada' });
    }
    const detalles = await DetalleVenta.findAll({ where: { venta_id: venta.venta_id } });
    res.json({ ...venta.toJSON(), detalles });
  } catch (e) {
    responderErrorScope(res, e);
  }
};

export const listarVentasParaDevolucion = async (req, res) => {
  try {
    const { q = '', page = 1, limit = 30 } = req.query;
    const scope = await resolverScopeSucursales(req);

    const whereSucursal = { sucursal_id: scope.whereSucursal };

    const where = { ...whereSucursal };
    if (q) where.folio = { [Op.iLike]: `%${q}%` };

    const offset = (Number(page) - 1) * Number(limit);
    const { count, rows } = await Venta.findAndCountAll({
      where, order: [['fecha', 'DESC']], limit: Number(limit), offset
    });

    const ventaIds = rows.map(v => v.venta_id);
    const devsExistentes = ventaIds.length
      ? await Devolucion.findAll({ where: { venta_id: { [Op.in]: ventaIds } }, attributes: ['venta_id'] })
      : [];
    const yaDevueltas = new Set(devsExistentes.map(d => d.venta_id));

    res.json({
      data: rows.map(v => ({ ...v.toJSON(), tiene_devolucion: yaDevueltas.has(v.venta_id) })),
      total: count,
      totalPaginas: Math.ceil(count / Number(limit))
    });
  } catch (e) {
    responderErrorScope(res, e);
  }
};

export const crear = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { venta_id, folio_venta, motivo, detalles } = req.body;
    const usuario_id = req.usuario.id;
    const sucursal_id = await resolverSucursalOperativa(req);
    if (!detalles?.length) throw new Error('Debe seleccionar al menos un producto a devolver');

    if (!venta_id) {
      const error = new Error('La devolución debe ligarse a una venta');
      error.status = 400;
      throw error;
    }
    const venta = await Venta.findOne({ where: { venta_id, sucursal_id }, transaction: t });
    if (!venta) throw new Error('La venta no pertenece a esta sucursal');
    const yaDevuelta = await Devolucion.findOne({ where: { venta_id }, transaction: t });
    if (yaDevuelta) {
      const error = new Error('Esta venta ya tiene una devolución registrada');
      error.status = 409;
      throw error;
    }

    // Montos y cantidades salen de la venta original, no de lo que mande el navegador.
    // ratio aplica el mismo IVA/descuento que tuvo la venta.
    const vendidos = await DetalleVenta.findAll({ where: { venta_id }, transaction: t });
    const baseVenta = vendidos.reduce((s, v) => s + Number(v.precio_unitario) * Number(v.cantidad), 0);
    const ratio = baseVenta > 0 ? Number(venta.total) / baseVenta : 1;

    const lineas = detalles.map(d => {
      const vendido = vendidos.find(v => Number(v.producto_id) === Number(d.producto_id));
      const cantidad = Number(d.cantidad);
      if (!vendido) throw new Error('Uno de los productos no pertenece a esta venta');
      if (!cantidadValida(cantidad, "kg") || cantidad > Number(vendido.cantidad)) {
        throw new Error(`Cantidad a devolver invalida para ${vendido.nombre_producto}`);
      }
      const precio = Number(vendido.precio_unitario);
      return {
        producto_id: vendido.producto_id,
        nombre_producto: vendido.nombre_producto,
        cantidad,
        precio_unitario: precio,
        subtotal: Math.round(precio * cantidad * ratio * 100) / 100
      };
    });

    const totalDevuelto = Math.round(lineas.reduce((s, d) => s + d.subtotal, 0) * 100) / 100;

    const dev = await Devolucion.create(
      { venta_id, folio_venta: venta.folio ?? folio_venta, motivo, usuario_id, sucursal_id, total_devuelto: totalDevuelto },
      { transaction: t }
    );

    for (const d of lineas) {
      await DetalleDevolucion.create({
        devolucion_id:   dev.devolucion_id,
        producto_id:     d.producto_id,
        nombre_producto: d.nombre_producto,
        cantidad:        d.cantidad,
        precio_unitario: d.precio_unitario,
        subtotal:        d.subtotal
      }, { transaction: t });

      if (d.producto_id && sucursal_id) {
        let stock = await StockSucursal.findOne({
          where: { producto_id: d.producto_id, sucursal_id },
          transaction: t
        });
        const cantidad = Number(d.cantidad);
        const stockAnterior = stock ? Number(stock.stock_actual) || 0 : 0;
        const stockNuevo = stockAnterior + cantidad;
        if (stock) {
          await stock.update({ stock_actual: stockNuevo }, { transaction: t });
        } else {
          stock = await StockSucursal.create({
            producto_id: d.producto_id,
            sucursal_id,
            stock_actual: stockNuevo,
            stock_minimo: 0
          }, { transaction: t });
        }
        await MovimientoInventario.create({
          producto_id: d.producto_id,
          nombre_producto: d.nombre_producto,
          codigo_barras: null,
          usuario_id,
          sucursal_id,
          tipo_movimiento: "ENTRADA",
          motivo: "DEVOLUCION",
          cantidad,
          stock_anterior: stockAnterior,
          stock_nuevo: stockNuevo,
          observaciones: `Devolucion de venta ${folio_venta}`,
          fecha: new Date()
        }, { transaction: t });
      }
    }

    // Registrar como movimiento de la caja activa
    // Busca por caja_id explícito si viene, o por sucursal_id + abierta
    const { caja_id: cajaIdBody } = req.body;
    const cajaAbierta = cajaIdBody
      ? await Caja.findOne({ where: { caja_id: cajaIdBody, fecha_cierre: null }, transaction: t })
      : await Caja.findOne({ where: { sucursal_id, fecha_cierre: null }, transaction: t });
    if (cajaAbierta) await validarSucursalEmpresa(req.usuario, cajaAbierta.sucursal_id);

    // Una venta cobrada con terminal se reembolsa por la terminal: no sale efectivo de la caja
    const cobradaEnEfectivo = (venta.tipo_pago || 'efectivo') === 'efectivo';
    if (cajaAbierta && cobradaEnEfectivo) {
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
    responderErrorScope(res, e);
  }
};

export const listar = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const scope = await resolverScopeSucursales(req);
    const where = { sucursal_id: scope.whereSucursal };

    const { count, rows } = await Devolucion.findAndCountAll({
      where, order: [['fecha', 'DESC']], limit: Number(limit), offset
    });

    const data = await Promise.all(rows.map(async d => {
      const detalles = await DetalleDevolucion.findAll({ where: { devolucion_id: d.devolucion_id } });
      return { ...d.toJSON(), detalles };
    }));

    res.json({ data, total: count, page: Number(page), totalPaginas: Math.ceil(count / Number(limit)) });
  } catch (e) {
    responderErrorScope(res, e);
  }
};

export const getHoy = async (req, res) => {
  try {
    const scope = await resolverScopeSucursales(req);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const manana = new Date(hoy);
    manana.setDate(hoy.getDate() + 1);

    const where = { fecha: { [Op.gte]: hoy, [Op.lt]: manana }, sucursal_id: scope.whereSucursal };

    const devs = await Devolucion.findAll({ where });
    const total = devs.reduce((s, d) => s + Number(d.total_devuelto), 0);
    res.json({ total, count: devs.length });
  } catch (e) {
    responderErrorScope(res, e);
  }
};

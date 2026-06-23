import sequelize from '../config/database.js';
import { Op } from 'sequelize';
import MovimientoInventario from '../models/MovimientoInventario.js';
import Producto from '../models/Producto.js';
import StockSucursal from '../models/StockSucursalModel.js';
import Usuario from '../models/Usuario.js';
import Sucursal from '../models/SucursalModel.js';

const TIPOS_VALIDOS     = ['ENTRADA', 'SALIDA', 'PERDIDA'];
const MOTIVOS_POR_TIPO  = {
  ENTRADA: ['COMPRA', 'DEVOLUCION', 'AJUSTE'],
  SALIDA:  ['AJUSTE'],
  PERDIDA: ['ROBO', 'DAÑO', 'CADUCADO', 'MERMA']
};

export const registrarMovimiento = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { producto_id, usuario_id, tipo_movimiento, motivo, cantidad, observaciones } = req.body;
    const sucursal_id = req.body.sucursal_id || req.usuario.sucursal_id || 1;

    if (!producto_id || !cantidad || !tipo_movimiento) throw new Error("Faltan datos (producto, cantidad o tipo)");
    if (!TIPOS_VALIDOS.includes(tipo_movimiento)) throw new Error(`tipo_movimiento debe ser: ${TIPOS_VALIDOS.join(', ')}`);
    if (motivo && !MOTIVOS_POR_TIPO[tipo_movimiento].includes(motivo)) {
      throw new Error(`Motivo inválido para ${tipo_movimiento}. Opciones: ${MOTIVOS_POR_TIPO[tipo_movimiento].join(', ')}`);
    }

    const producto = await Producto.findByPk(producto_id, { transaction: t });
    if (!producto) throw new Error("Producto no encontrado");

    let stockReg = await StockSucursal.findOne({ where: { producto_id, sucursal_id }, transaction: t });
    if (!stockReg) {
      stockReg = await StockSucursal.create({
        producto_id, sucursal_id,
        stock_actual: producto.stock_actual || 0,
        stock_minimo: producto.stock_minimo || 0
      }, { transaction: t });
    }

    const stockAnterior = stockReg.stock_actual;
    let stockNuevo;

    if (tipo_movimiento === 'ENTRADA') {
      stockNuevo = stockAnterior + parseInt(cantidad);
    } else {
      if (stockAnterior < parseInt(cantidad)) {
        throw new Error(`Stock insuficiente en esta sucursal. Disponible: ${stockAnterior}`);
      }
      stockNuevo = stockAnterior - parseInt(cantidad);
    }

    await stockReg.update({ stock_actual: stockNuevo }, { transaction: t });
    // Mantener stock global sincronizado
    const diff = tipo_movimiento === 'ENTRADA' ? parseInt(cantidad) : -parseInt(cantidad);
    await producto.increment('stock_actual', { by: diff, transaction: t });

    await MovimientoInventario.create({
      producto_id, nombre_producto: producto.nombre, codigo_barras: producto.codigo_barras,
      usuario_id, sucursal_id, tipo_movimiento, motivo: motivo || null,
      cantidad: parseInt(cantidad), stock_anterior: stockAnterior, stock_nuevo: stockNuevo,
      observaciones: observaciones || '', fecha: new Date()
    }, { transaction: t });

    await t.commit();
    res.json({ mensaje: 'Inventario actualizado con éxito', nuevo_stock: stockNuevo });
  } catch (error) {
    await t.rollback();
    res.status(500).json({ error: error.message });
  }
};

export const getHistorial = async (req, res) => {
  try {
    const { producto_id, tipo_movimiento, fechaInicio, fechaFin } = req.query;
    const where = {};
    if (producto_id)    where.producto_id      = producto_id;
    if (tipo_movimiento) where.tipo_movimiento = tipo_movimiento;
    if (fechaInicio || fechaFin) {
      where.fecha = {
        ...(fechaInicio && { [Op.gte]: new Date(`${fechaInicio}T00:00:00`) }),
        ...(fechaFin    && { [Op.lte]: new Date(`${fechaFin}T23:59:59`) })
      };
    }

    const movimientos = await MovimientoInventario.findAll({
      where,
      include: [
        { model: Producto,  attributes: ['nombre', 'codigo_barras'] },
        { model: Usuario,   attributes: ['nombre'] },
        { model: Sucursal,  attributes: ['nombre'], required: false }
      ],
      order: [['fecha', 'DESC']]
    });

    res.json(movimientos.map(m => ({
      fecha: m.fecha, producto: m.nombre_producto || m.Producto?.nombre || 'N/A',
      codigo_barras: m.codigo_barras || m.Producto?.codigo_barras || '',
      tipo: m.tipo_movimiento, motivo: m.motivo || '',
      cantidad: m.cantidad, stock_anterior: m.stock_anterior, stock_nuevo: m.stock_nuevo,
      usuario: m.Usuario?.nombre || 'N/A', observaciones: m.observaciones || '',
      nombre_sucursal: m.Sucursal?.nombre || null
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

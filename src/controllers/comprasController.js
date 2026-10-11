import sequelize from "../config/database.js";
import Compra from "../models/Compra.js";
import DetalleCompra from "../models/DetalleCompra.js";
import Proveedor from "../models/Proveedor.js";
import Producto from "../models/Producto.js";
import StockSucursal from "../models/StockSucursalModel.js";
import CajaModel from "../models/CajaModel.js";
import MovimientoCaja from "../models/MovimientoCaja.js";
import MovimientoInventario from "../models/MovimientoInventario.js";
import { Op } from "sequelize";
import { resolverScopeSucursales, resolverSucursalOperativa, responderErrorScope } from "../utils/scope.js";
import { rangoFechasReporte } from "../utils/fechas.js";
import { cantidadValida } from "../utils/giros.js";

export const listarCompras = async (req, res) => {
  try {
    const scope = await resolverScopeSucursales(req);
    const filtro = {
      empresa_id: scope.empresa_id,
      sucursal_id: scope.whereSucursal
    };

    const { fechaInicio, fechaFin } = req.query;
    if (fechaInicio && fechaFin) {
      const rango = rangoFechasReporte(fechaInicio, fechaFin);
      filtro.fecha = {
        [Op.between]: [rango.inicio, rango.fin]
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
    responderErrorScope(res, err);
  }
};

export const crearCompra = async (req, res) => {
  const { proveedor_id, folio, notas, items, descontar_de_caja } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Se requieren productos en la compra' });
  }

  const t = await sequelize.transaction();
  try {
    const sucursal_id = await resolverSucursalOperativa(req);

    if (proveedor_id) {
      const proveedor = await Proveedor.findOne({ where: { proveedor_id, empresa_id: req.usuario.empresa_id }, transaction: t });
      if (!proveedor) {
        const error = new Error('El proveedor no pertenece a tu empresa');
        error.status = 403;
        throw error;
      }
    }

    // Valida cada renglon antes de tocar stock: producto de la empresa, cantidad y costo validos
    const productosCompra = new Map();
    for (const item of items) {
      const costo = Number(item.costo_unitario);
      if (!Number.isFinite(costo) || costo < 0) throw Object.assign(new Error('Costo unitario invalido'), { status: 400 });
      let unidad = 'kg';
      if (item.producto_id) {
        const prod = await Producto.findOne({ where: { producto_id: item.producto_id, empresa_id: req.usuario.empresa_id }, transaction: t });
        if (!prod) throw Object.assign(new Error(`El producto ${item.nombre_producto || item.producto_id} no pertenece a tu empresa`), { status: 403 });
        productosCompra.set(Number(item.producto_id), prod);
        unidad = prod.unidad_venta;
      }
      if (!cantidadValida(item.cantidad, unidad)) {
        throw Object.assign(new Error(`Cantidad invalida en ${item.nombre_producto || 'un producto'}`), { status: 400 });
      }
    }

    const total = Math.round(items.reduce((s, i) => s + Number(i.costo_unitario) * Number(i.cantidad), 0) * 100) / 100;

    const compra = await Compra.create({
      empresa_id:  req.usuario.empresa_id,
      sucursal_id,
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
        let stock = await StockSucursal.findOne({
          where: { producto_id: item.producto_id, sucursal_id },
          transaction: t
        });
        const cantidad = Number(item.cantidad);
        const stockAnterior = stock ? Number(stock.stock_actual) || 0 : 0;
        const stockNuevo = stockAnterior + cantidad;
        if (stock) {
          await stock.update({ stock_actual: stockNuevo }, { transaction: t });
        } else {
          stock = await StockSucursal.create({
            producto_id:  item.producto_id,
            sucursal_id,
            stock_actual: stockNuevo,
            stock_minimo: 0
          }, { transaction: t });
        }
        await MovimientoInventario.create({
          producto_id: item.producto_id,
          nombre_producto: productosCompra.get(Number(item.producto_id))?.nombre ?? item.nombre_producto,
          codigo_barras: productosCompra.get(Number(item.producto_id))?.codigo_barras ?? null,
          usuario_id: req.usuario.id,
          sucursal_id,
          tipo_movimiento: "ENTRADA",
          motivo: "COMPRA",
          cantidad,
          stock_anterior: stockAnterior,
          stock_nuevo: stockNuevo,
          observaciones: `Compra${folio ? ' ' + folio : ''}`,
          fecha: new Date()
        }, { transaction: t });
        // Mantener stock global sincronizado, igual que ventas e inventario
        await Producto.increment('stock_actual', {
          by: cantidad,
          where: { producto_id: item.producto_id, empresa_id: req.usuario.empresa_id },
          transaction: t
        });
        // Actualiza costo en producto (antes usaba precio_costo, columna que no existe)
        await Producto.update(
          { precio_compra: Number(item.costo_unitario) },
          { where: { producto_id: item.producto_id, empresa_id: req.usuario.empresa_id }, transaction: t }
        );
      }
    }

    // Opcional: registrar egreso en la caja abierta
    if (descontar_de_caja) {
      const cajaAbierta = await CajaModel.findOne({
        where: { sucursal_id, fecha_cierre: null },
        transaction: t
      });
      if (cajaAbierta) {
        await MovimientoCaja.create({
          caja_id:          cajaAbierta.caja_id,
          usuario_id:       req.usuario.id,
          tipo_movimiento:  'EGRESO',
          monto:            total,
          concepto:         `Pago compra${folio ? ' ' + folio : ''}${proveedor_id ? ' — proveedor' : ''}`,
          fecha:            new Date()
        }, { transaction: t });
      }
    }

    await t.commit();
    res.status(201).json({ mensaje: 'Compra registrada', compra_id: compra.compra_id });
  } catch (err) {
    await t.rollback();
    responderErrorScope(res, err);
  }
};

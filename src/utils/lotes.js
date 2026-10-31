import { Op, QueryTypes } from "sequelize";
import sequelize from "../config/database.js";
import Lote from "../models/Lote.js";
import Producto from "../models/Producto.js";
import { fechaLocalISO } from "./fechas.js";

// Lotes por producto y sucursal. La venta descuenta primero lo que caduca antes (FEFO),
// saltando lotes ya caducados. Los productos sin lotes siguen funcionando igual que antes.

const r3 = (n) => Math.round(Number(n || 0) * 1000) / 1000;
const limpiarLote = (v) => (v == null ? null : String(v).trim().slice(0, 60) || null);
const limpiarFecha = (v) => (v && /^\d{4}-\d{2}-\d{2}/.test(String(v)) ? String(v).slice(0, 10) : null);

/** productos.fecha_caducidad y productos.lote = el lote con existencia que caduca primero. */
export async function actualizarCaducidadProducto(producto_id, transaction) {
  const [siguiente] = await sequelize.query(`
    SELECT lote, fecha_caducidad::text AS fecha_caducidad
      FROM lotes
     WHERE producto_id = :producto_id AND cantidad > 0 AND fecha_caducidad IS NOT NULL
     ORDER BY fecha_caducidad ASC, lote_id ASC
     LIMIT 1`, { replacements: { producto_id }, type: QueryTypes.SELECT, transaction });
  const tieneLotes = await Lote.count({ where: { producto_id }, transaction });
  if (!tieneLotes) return;
  await Producto.update(
    { fecha_caducidad: siguiente?.fecha_caducidad ?? null, lote: siguiente?.lote ?? null },
    { where: { producto_id }, transaction }
  );
}

/** Entrada de mercancía con lote y/o caducidad (compras y entradas de inventario). */
export async function registrarEntradaLote({ empresa_id, producto_id, sucursal_id, lote, fecha_caducidad, cantidad, existenciaPrevia = 0, transaction }) {
  const numero = limpiarLote(lote);
  const fecha = limpiarFecha(fecha_caducidad);
  if (!numero && !fecha) return null;

  // Primer lote del producto en esta sucursal: lo que ya habia se guarda como un lote con la caducidad anterior
  const lotesPrevios = await Lote.count({ where: { producto_id, sucursal_id }, transaction });
  if (!lotesPrevios && Number(existenciaPrevia) > 0) {
    const prod = await Producto.findByPk(producto_id, { attributes: ['lote', 'fecha_caducidad'], transaction });
    if (prod?.fecha_caducidad || prod?.lote) {
      await Lote.create({
        empresa_id, producto_id, sucursal_id,
        lote: limpiarLote(prod.lote), fecha_caducidad: limpiarFecha(prod.fecha_caducidad), cantidad: r3(existenciaPrevia)
      }, { transaction });
    }
  }

  const existente = await Lote.findOne({
    where: { producto_id, sucursal_id, lote: numero, fecha_caducidad: fecha },
    transaction, lock: transaction ? true : undefined
  });
  let registro;
  if (existente) {
    registro = await existente.update({ cantidad: r3(Number(existente.cantidad) + Number(cantidad)) }, { transaction });
  } else {
    registro = await Lote.create({ empresa_id, producto_id, sucursal_id, lote: numero, fecha_caducidad: fecha, cantidad: r3(cantidad) }, { transaction });
  }
  await actualizarCaducidadProducto(producto_id, transaction);
  return registro;
}

/**
 * Descuenta cantidad de los lotes de la sucursal: primero los vigentes que caducan antes, luego los sin fecha,
 * y al final los caducados. Lo que no alcance se toma de la existencia sin lote.
 * Regresa [{ lote_id, lote, fecha_caducidad, cantidad }].
 */
export async function descontarLotes({ producto_id, sucursal_id, cantidad, lote_id = null, transaction }) {
  const hoy = fechaLocalISO();
  const where = { producto_id, sucursal_id, cantidad: { [Op.gt]: 0 } };
  if (lote_id) where.lote_id = lote_id;
  const lotes = await Lote.findAll({ where, transaction, lock: transaction ? true : undefined });
  if (!lotes.length) return [];
  const orden = (l) => [l.fecha_caducidad && l.fecha_caducidad < hoy ? 2 : l.fecha_caducidad ? 0 : 1, l.fecha_caducidad || '9999-12-31', l.lote_id];
  lotes.sort((a, b) => {
    const [x, y] = [orden(a), orden(b)];
    return x[0] - y[0] || String(x[1]).localeCompare(String(y[1])) || x[2] - y[2];
  });
  let falta = r3(cantidad);
  const usados = [];
  for (const l of lotes) {
    if (falta <= 0) break;
    const toma = r3(Math.min(Number(l.cantidad), falta));
    if (toma <= 0) continue;
    await l.update({ cantidad: r3(Number(l.cantidad) - toma) }, { transaction });
    usados.push({ lote_id: l.lote_id, lote: l.lote, fecha_caducidad: l.fecha_caducidad, cantidad: toma });
    falta = r3(falta - toma);
  }
  if (lote_id && falta > 0) {
    throw Object.assign(new Error('Ese lote no tiene suficiente cantidad'), { status: 400 });
  }
  await actualizarCaducidadProducto(producto_id, transaction);
  return usados;
}

/**
 * Cuánto se puede vender sin tocar lotes caducados: existencia de la sucursal menos lo que esta en lotes caducados.
 * Si el producto no tiene lotes regresa null (se usa la regla anterior de productos.fecha_caducidad).
 */
export async function existenciaVigente({ producto_id, sucursal_id, existencia, transaction }) {
  const [fila] = await sequelize.query(`
    SELECT COUNT(*)::int AS lotes,
           COALESCE(SUM(cantidad) FILTER (WHERE fecha_caducidad IS NOT NULL AND fecha_caducidad < :hoy), 0)::float AS caducada
      FROM lotes WHERE producto_id = :producto_id AND sucursal_id = :sucursal_id AND cantidad > 0`,
    { replacements: { producto_id, sucursal_id, hoy: fechaLocalISO() }, type: QueryTypes.SELECT, transaction });
  if (!fila || !fila.lotes) return null;
  return r3(Number(existencia || 0) - Number(fila.caducada || 0));
}

/** Lotes con existencia de un producto (de una sucursal o de todas las de la empresa). */
export async function listarLotes({ empresa_id, producto_id, sucursal_id = null }) {
  return sequelize.query(`
    SELECT l.lote_id, l.lote, l.fecha_caducidad::text AS fecha_caducidad, l.cantidad::float AS cantidad,
           l.sucursal_id, s.nombre AS sucursal, (l.fecha_caducidad IS NOT NULL AND l.fecha_caducidad < :hoy) AS caducado
      FROM lotes l JOIN sucursales s ON s.sucursal_id = l.sucursal_id
     WHERE l.empresa_id = :empresa_id AND l.producto_id = :producto_id AND l.cantidad > 0
       ${sucursal_id ? 'AND l.sucursal_id = :sucursal_id' : ''}
     ORDER BY l.fecha_caducidad ASC NULLS LAST, l.lote_id`,
    { replacements: { empresa_id, producto_id, sucursal_id, hoy: fechaLocalISO() }, type: QueryTypes.SELECT });
}

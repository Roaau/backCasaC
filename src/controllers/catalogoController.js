import { Op } from 'sequelize';
import CatalogoMaestro from '../models/CatalogoMaestro.js';
import Producto from '../models/Producto.js';
import StockSucursal from '../models/StockSucursalModel.js';
import Sucursal from '../models/SucursalModel.js';

// GET /api/catalogo/buscar?q= — autocomplete para crear productos
export const buscarCatalogo = async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) return res.json([]);
  try {
    const resultados = await CatalogoMaestro.findAll({
      where: { nombre: { [Op.iLike]: `%${q.trim()}%` } },
      limit: 10,
      order: [['nombre', 'ASC']]
    });
    res.json(resultados);
  } catch {
    res.status(500).json({ error: 'Error al buscar en catálogo' });
  }
};

// GET /api/catalogo?q=&page=1&limit=50&categoria=
export const listarCatalogo = async (req, res) => {
  const { q = '', page = 1, limit = 50, categoria } = req.query;
  const empresa_id = req.usuario.empresa_id || 1;
  const offset = (Number(page) - 1) * Number(limit);

  const where = {};
  if (q.trim().length >= 2) {
    where[Op.or] = [
      { nombre:          { [Op.iLike]: `%${q.trim()}%` } },
      { codigo_barras:   { [Op.iLike]: `%${q.trim()}%` } },
      { categoria_sugerida: { [Op.iLike]: `%${q.trim()}%` } },
    ];
  }
  if (categoria) where.categoria_sugerida = categoria;

  try {
    const { count, rows } = await CatalogoMaestro.findAndCountAll({
      where, limit: Number(limit), offset, order: [['nombre', 'ASC']]
    });

    // Marcar cuáles ya fueron adoptados (mismo codigo_barras en empresa)
    const codigos = rows.map(r => r.codigo_barras).filter(Boolean);
    const adoptadosRows = codigos.length
      ? await Producto.findAll({ where: { empresa_id, codigo_barras: { [Op.in]: codigos } }, attributes: ['codigo_barras'] })
      : [];
    const adoptadosSet = new Set(adoptadosRows.map(p => p.codigo_barras));

    const items = rows.map(r => ({
      ...r.toJSON(),
      ya_adoptado: r.codigo_barras ? adoptadosSet.has(r.codigo_barras) : false,
    }));

    res.json({ items, total: count, page: Number(page), pages: Math.ceil(count / Number(limit)) });
  } catch (err) {
    res.status(500).json({ error: 'Error al listar catálogo' });
  }
};

// GET /api/catalogo/categorias
export const categoriasCatalogo = async (req, res) => {
  try {
    const rows = await CatalogoMaestro.findAll({
      attributes: ['categoria_sugerida'],
      where: { categoria_sugerida: { [Op.ne]: null } },
      group: ['categoria_sugerida'],
      order: [['categoria_sugerida', 'ASC']],
    });
    res.json(rows.map(r => r.categoria_sugerida).filter(Boolean));
  } catch {
    res.status(500).json({ error: 'Error al obtener categorías' });
  }
};

// POST /api/catalogo/adoptar  { ids: number[] }
export const adoptarProductos = async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0)
    return res.status(400).json({ error: 'Se requiere al menos un producto' });

  const empresa_id  = req.usuario.empresa_id  || 1;
  const sucursal_id = req.usuario.sucursal_id || 1;

  try {
    const [items, sucursales, existentes] = await Promise.all([
      CatalogoMaestro.findAll({ where: { catalogo_id: { [Op.in]: ids } } }),
      Sucursal.findAll({ where: { empresa_id }, attributes: ['sucursal_id'] }),
      Producto.findAll({ where: { empresa_id }, attributes: ['codigo_barras'] }),
    ]);

    const sucursalIds    = sucursales.map(s => s.sucursal_id);
    const codigosExisten = new Set(existentes.map(p => p.codigo_barras).filter(Boolean));

    const nuevos = items
      .filter(item => !item.codigo_barras || !codigosExisten.has(item.codigo_barras))
      .map(item => mapItemToProducto(item, empresa_id));

    const omitidos = items.length - nuevos.length;
    if (nuevos.length === 0) return res.json({ adoptados: 0, omitidos, mensaje: 'Todos ya estaban en tu inventario' });

    const creados = await Producto.bulkCreate(nuevos, { returning: true });
    await crearStocks(creados, sucursalIds);

    res.json({ mensaje: `Adoptados: ${creados.length}`, adoptados: creados.length, omitidos });
  } catch (err) {
    res.status(500).json({ error: 'Error al adoptar productos', detalle: err.message });
  }
};

// POST /api/catalogo/adoptar-todo
export const adoptarTodo = async (req, res) => {
  const empresa_id = req.usuario.empresa_id || 1;

  try {
    const [items, sucursales, existentes] = await Promise.all([
      CatalogoMaestro.findAll(),
      Sucursal.findAll({ where: { empresa_id }, attributes: ['sucursal_id'] }),
      Producto.findAll({ where: { empresa_id }, attributes: ['codigo_barras'] }),
    ]);

    const sucursalIds    = sucursales.map(s => s.sucursal_id);
    const codigosExisten = new Set(existentes.map(p => p.codigo_barras).filter(Boolean));

    const nuevos = items
      .filter(item => !item.codigo_barras || !codigosExisten.has(item.codigo_barras))
      .map(item => mapItemToProducto(item, empresa_id));

    const omitidos = items.length - nuevos.length;
    if (nuevos.length === 0) return res.json({ adoptados: 0, omitidos, mensaje: 'Todo el catálogo ya está en tu inventario' });

    const creados = await Producto.bulkCreate(nuevos, { returning: true });
    await crearStocks(creados, sucursalIds);

    res.json({ mensaje: `Catálogo adoptado`, adoptados: creados.length, omitidos });
  } catch (err) {
    res.status(500).json({ error: 'Error al adoptar catálogo', detalle: err.message });
  }
};

// ── helpers ──────────────────────────────────────────────────────────────────

function mapItemToProducto(item, empresa_id) {
  return {
    empresa_id,
    codigo_barras:    item.codigo_barras || null,
    nombre:           item.nombre,
    descripcion:      item.descripcion   || null,
    categoria:        item.categoria_sugerida || 'Varios',
    precio_menudeo:   Number(item.precio_menudeo)  || 0,
    precio_mayoreo:   Number(item.precio_mayoreo)  || 0,
    precio_oferta:    Number(item.precio_oferta)   || 0,
    stock_actual:     0,
    stock_minimo:     Number(item.stock_minimo)    || 0,
    minimo_mayoreo:   item.minimo_mayoreo || null,
    clave_sat:        item.clave_sat_sugerida  || '01010101',
    clave_unidad_sat: item.unidad_sat_sugerida || 'H87',
    objeto_imp:       item.objeto_imp          || '02',
    activo:           true,
  };
}

async function crearStocks(productos, sucursalIds) {
  const stockRecords = [];
  for (const prod of productos) {
    for (const sid of sucursalIds) {
      stockRecords.push({
        producto_id:  prod.producto_id,
        sucursal_id:  sid,
        stock_actual: 0,
        stock_minimo: prod.stock_minimo || 0,
      });
    }
  }
  if (stockRecords.length > 0)
    await StockSucursal.bulkCreate(stockRecords, { ignoreDuplicates: true });
}

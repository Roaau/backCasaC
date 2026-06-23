import { Op } from "sequelize";
import Producto from "../models/Producto.js";
import StockSucursal from "../models/StockSucursalModel.js";
import Sucursal from "../models/SucursalModel.js";
import multer from "multer";
import XLSX from "xlsx";

export const uploadMiddleware = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }).single('archivo');

export const buscarProducto = async (req, res) => {
  try {
    const { texto } = req.params;
    const empresa_id  = req.usuario.empresa_id  || 1;
    const sucursal_id = req.query.sucursal_id   || req.usuario.sucursal_id || 1;

    const productos = await Producto.findAll({
      where: {
        empresa_id,
        [Op.or]: [
          { codigo_barras: texto },
          { nombre: { [Op.iLike]: `%${texto}%` } }
        ]
      },
      include: [{
        model: StockSucursal,
        where: { sucursal_id },
        required: false,
        attributes: ['stock_actual', 'stock_minimo']
      }],
      order: [["producto_id", "DESC"]]
    });

    const resultado = productos.map(p => ({
      ...p.toJSON(),
      stock_actual: p.StockSucursals?.[0]?.stock_actual ?? p.stock_actual,
      stock_minimo: p.StockSucursals?.[0]?.stock_minimo ?? p.stock_minimo
    }));

    res.json(resultado);
  } catch (err) {
    res.status(500).json({ error: "Error al buscar productos" });
  }
};

export const getAll = async (req, res) => {
  try {
    const empresa_id  = req.usuario.empresa_id  || 1;
    const sucursal_id = req.query.sucursal_id   || req.usuario.sucursal_id || 1;
    const page        = Math.max(1, parseInt(req.query.page)  || 1);
    const limit       = Math.min(200, parseInt(req.query.limit) || 50);
    const q           = req.query.q?.toString().trim()         || '';
    const categoria   = req.query.categoria?.toString().trim() || '';
    const offset      = (page - 1) * limit;

    const where = { empresa_id };
    if (q) {
      where[Op.or] = [
        { nombre:        { [Op.iLike]: `%${q}%` } },
        { codigo_barras: { [Op.iLike]: `%${q}%` } },
        { descripcion:   { [Op.iLike]: `%${q}%` } },
      ];
    }
    if (categoria) where.categoria = categoria;

    const { count, rows } = await Producto.findAndCountAll({
      where,
      include: [{
        model: StockSucursal,
        where: { sucursal_id },
        required: false,
        attributes: ['stock_actual', 'stock_minimo']
      }],
      order: [['producto_id', 'DESC']],
      limit,
      offset,
    });

    const items = rows.map(p => ({
      ...p.toJSON(),
      stock_actual: p.StockSucursals?.[0]?.stock_actual ?? p.stock_actual,
      stock_minimo: p.StockSucursals?.[0]?.stock_minimo ?? p.stock_minimo
    }));

    res.json({ items, total: count, page, pages: Math.ceil(count / limit) || 1, limit });
  } catch (err) {
    res.status(500).json({ error: "Error al obtener productos" });
  }
};

export const stockBajoCount = async (req, res) => {
  try {
    const empresa_id  = req.usuario.empresa_id  || 1;
    const sucursal_id = req.usuario.sucursal_id || 1;
    const rows = await Producto.findAll({
      where: { empresa_id },
      include: [{ model: StockSucursal, where: { sucursal_id }, required: false, attributes: ['stock_actual', 'stock_minimo'] }],
      attributes: ['stock_actual', 'stock_minimo'],
    });
    const count = rows.filter(p => {
      const actual  = p.StockSucursals?.[0]?.stock_actual ?? p.stock_actual ?? 0;
      const minimo  = p.StockSucursals?.[0]?.stock_minimo ?? p.stock_minimo ?? 5;
      return actual <= minimo;
    }).length;
    res.json({ count });
  } catch {
    res.status(500).json({ count: 0 });
  }
};

export const createProducto = async (req, res) => {
  try {
    const empresa_id = req.usuario.empresa_id || 1;
    const data = { ...req.body, empresa_id };
    if (!data.minimo_mayoreo || Number(data.minimo_mayoreo) === 0) data.minimo_mayoreo = null;

    const nuevoProducto = await Producto.create(data);

    // Crear registro de stock para todas las sucursales de esta empresa
    const sucursal_id = req.usuario.sucursal_id || 1;
    await StockSucursal.create({
      producto_id:  nuevoProducto.producto_id,
      sucursal_id,
      stock_actual: nuevoProducto.stock_actual || 0,
      stock_minimo: nuevoProducto.stock_minimo || 0
    });

    res.json({ msg: "Producto creado correctamente", producto: nuevoProducto });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: "El código de barras ya existe." });
    }
    res.status(500).json({ error: "Error al crear producto" });
  }
};

export const updateProducto = async (req, res) => {
  try {
    const { id } = req.params;
    const empresa_id = req.usuario.empresa_id || 1;
    const data = { ...req.body };
    if (data.minimo_mayoreo !== undefined && (!data.minimo_mayoreo || Number(data.minimo_mayoreo) === 0)) {
      data.minimo_mayoreo = null;
    }

    const [updated] = await Producto.update(data, { where: { producto_id: id, empresa_id } });
    if (!updated) return res.status(404).json({ error: "Producto no encontrado" });

    // Si cambia stock_actual o stock_minimo, actualizar también StockSucursal de esta sucursal
    const sucursal_id = req.usuario.sucursal_id || 1;
    const stockUpdate = {};
    if (data.stock_actual !== undefined) stockUpdate.stock_actual = data.stock_actual;
    if (data.stock_minimo !== undefined) stockUpdate.stock_minimo = data.stock_minimo;
    if (Object.keys(stockUpdate).length > 0) {
      await StockSucursal.update(stockUpdate, { where: { producto_id: id, sucursal_id } });
    }

    const productoActualizado = await Producto.findByPk(id);
    return res.json({ msg: "Producto actualizado", producto: productoActualizado });
  } catch (err) {
    res.status(500).json({ error: "Error al actualizar producto" });
  }
};

export const importarProductos = async (req, res) => {
  uploadMiddleware(req, res, async (err) => {
    if (err) return res.status(400).json({ error: 'Error al recibir el archivo' });
    if (!req.file) return res.status(400).json({ error: 'No se envió ningún archivo' });

    const empresa_id  = req.usuario.empresa_id  || 1;
    const sucursal_id = req.usuario.sucursal_id  || 1;

    try {
      const wb   = XLSX.read(req.file.buffer, { type: 'buffer' });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: null });

      if (rows.length === 0) return res.status(400).json({ error: 'El archivo está vacío o no tiene el formato correcto' });

      // Todas las sucursales de la empresa para crear stock en cada una
      const sucursales = await Sucursal.findAll({ where: { empresa_id }, attributes: ['sucursal_id'] });
      const sucursalIds = sucursales.map(s => s.sucursal_id);

      let importados = 0, omitidos = 0;
      const errores  = [];

      for (const row of rows) {
        try {
          const codigo = row.codigo_barras?.toString().trim();
          const nombre = row.nombre?.toString().trim();
          if (!codigo || !nombre) { omitidos++; continue; }

          const existe = await Producto.findOne({ where: { codigo_barras: codigo, empresa_id } });
          if (existe) { omitidos++; continue; }

          const producto = await Producto.create({
            empresa_id,
            codigo_barras:    codigo,
            nombre,
            descripcion:      row.descripcion     || null,
            categoria:        row.categoria        || 'Varios',
            precio_menudeo:   Number(row.precio_menudeo)  || 0,
            precio_mayoreo:   Number(row.precio_mayoreo)  || 0,
            precio_oferta:    Number(row.precio_oferta)   || 0,
            stock_actual:     Number(row.stock_actual)    || 0,
            stock_minimo:     Number(row.stock_minimo)    || 0,
            minimo_mayoreo:   Number(row.minimo_mayoreo)  || null,
            clave_sat:        row.clave_sat        || '01010101',
            clave_unidad_sat: row.clave_unidad_sat || 'H87',
            objeto_imp:       row.objeto_imp       || '02',
            activo:           true
          });

          // Crear StockSucursal para todas las sucursales
          await Promise.all(sucursalIds.map(sid =>
            StockSucursal.create({
              producto_id:  producto.producto_id,
              sucursal_id:  sid,
              stock_actual: sid === Number(sucursal_id) ? (Number(row.stock_actual) || 0) : 0,
              stock_minimo: Number(row.stock_minimo) || 0
            }).catch(() => {}) // ignorar si ya existe
          ));

          importados++;
        } catch (rowErr) {
          errores.push(`${row.nombre || row.codigo_barras}: ${rowErr.message}`);
        }
      }

      return res.json({
        mensaje:    `Importación completada`,
        importados,
        omitidos,
        errores:    errores.slice(0, 10),
        total_filas: rows.length
      });
    } catch (parseErr) {
      return res.status(400).json({ error: 'No se pudo leer el archivo Excel. Verifica el formato.' });
    }
  });
};

export const deleteProducto = async (req, res) => {
  try {
    const { id } = req.params;
    const empresa_id = req.usuario.empresa_id || 1;
    const filasEliminadas = await Producto.destroy({ where: { producto_id: id, empresa_id } });
    if (filasEliminadas === 0) return res.status(404).json({ error: "Producto no encontrado" });
    res.json({ msg: "Producto eliminado correctamente" });
  } catch (err) {
    res.status(500).json({ error: err.message || "Error al eliminar producto" });
  }
};

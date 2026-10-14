import { Op } from "sequelize";
import Producto from "../models/Producto.js";
import StockSucursal from "../models/StockSucursalModel.js";
import Sucursal from "../models/SucursalModel.js";
import MovimientoInventario from "../models/MovimientoInventario.js";
import multer from "multer";
import XLSX from "xlsx";
import {
  resolverScopeSucursales,
  resolverSucursalOperativa,
  responderErrorScope
} from "../utils/scope.js";
import { UNIDADES_VENTA, permiteDecimales } from "../utils/giros.js";
import { leerFilasInventario, COLUMNAS_PLANTILLA } from "../utils/importarExcel.js";
import sequelize from "../config/database.js";
import { obtenerEmpresaId, parseIdPositivo } from "../utils/scope.js";

// GET /api/productos/:id/stock-sucursales (solo admin; ruta con verificarAdmin)
// Existencia del producto en cada sucursal activa de la empresa. Sin registro de stock = 0.
export const stockPorSucursal = async (req, res) => {
  try {
    const empresa_id = obtenerEmpresaId(req.usuario);
    const producto_id = parseIdPositivo(req.params.id);
    if (!producto_id) return res.status(400).json({ error: 'Producto inválido' });

    const producto = await Producto.findOne({
      where: { producto_id, empresa_id },
      attributes: ['producto_id', 'nombre', 'unidad_venta']
    });
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });

    const [sucursales, stocks] = await Promise.all([
      Sucursal.findAll({ where: { empresa_id, activa: true }, attributes: ['sucursal_id', 'nombre'], order: [['nombre', 'ASC']] }),
      StockSucursal.findAll({ where: { producto_id }, attributes: ['sucursal_id', 'stock_actual', 'stock_minimo'] })
    ]);
    const porSucursal = new Map(stocks.map(s => [s.sucursal_id, s]));
    const detalle = sucursales.map(s => ({
      sucursal_id:  s.sucursal_id,
      nombre:       s.nombre,
      stock_actual: Number(porSucursal.get(s.sucursal_id)?.stock_actual ?? 0),
      stock_minimo: Number(porSucursal.get(s.sucursal_id)?.stock_minimo ?? 0)
    }));

    res.json({
      producto_id: producto.producto_id,
      nombre: producto.nombre,
      unidad_venta: producto.unidad_venta,
      total: detalle.reduce((acc, d) => acc + d.stock_actual, 0),
      sucursales: detalle
    });
  } catch (e) {
    responderErrorScope(res, e);
  }
};

export const uploadMiddleware = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }).single('archivo');

// Campos que el cliente puede escribir. empresa_id y producto_id nunca vienen del navegador
// (antes updateProducto aceptaba empresa_id y permitia mover un producto a otra empresa).
const CAMPOS_PRODUCTO = [
  "codigo_barras", "nombre", "descripcion", "categoria",
  "precio_menudeo", "precio_mayoreo", "precio_oferta", "precio_compra",
  "stock_actual", "stock_minimo", "minimo_mayoreo", "activo",
  "unidad_venta", "marca", "modelo", "talla", "color", "lote", "fecha_caducidad",
  "requiere_receta", "ubicacion",
  "clave_sat", "clave_unidad_sat", "objeto_imp"
];

const TEXTO_OPCIONAL = ["descripcion", "marca", "modelo", "talla", "color", "lote", "ubicacion"];

export const limpiarProducto = (body = {}) => {
  const data = {};
  for (const campo of CAMPOS_PRODUCTO) {
    if (body[campo] !== undefined) data[campo] = body[campo];
  }
  for (const campo of TEXTO_OPCIONAL) {
    if (data[campo] !== undefined) data[campo] = String(data[campo] ?? "").trim() || null;
  }
  if (data.unidad_venta !== undefined && !UNIDADES_VENTA.includes(data.unidad_venta)) data.unidad_venta = "pieza";
  if (data.fecha_caducidad !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(String(data.fecha_caducidad || ""))) data.fecha_caducidad = null;
  if (data.requiere_receta !== undefined) data.requiere_receta = data.requiere_receta === true || data.requiere_receta === "true";
  if (data.precio_compra !== undefined && (data.precio_compra === "" || data.precio_compra === null)) data.precio_compra = null;
  // Clave SAT generica si no se maneja facturacion
  if (data.clave_sat === "" || data.clave_sat === null) delete data.clave_sat;
  if (data.clave_unidad_sat === "" || data.clave_unidad_sat === null) delete data.clave_unidad_sat;
  return data;
};

export const buscarProducto = async (req, res) => {
  try {
    const { texto } = req.params;
    const empresa_id  = req.usuario.empresa_id;
    const sucursal_id = await resolverSucursalOperativa(req);

    const productos = await Producto.findAll({
      where: {
        empresa_id,
        activo: { [Op.not]: false }, // los desactivados no se venden
        [Op.or]: [
          { codigo_barras: texto },
          { nombre: { [Op.iLike]: `%${texto}%` } },
          { marca:  { [Op.iLike]: `%${texto}%` } },
          { modelo: { [Op.iLike]: `%${texto}%` } }
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
    responderErrorScope(res, err);
  }
};

export const getAll = async (req, res) => {
  try {
    const empresa_id  = req.usuario.empresa_id;
    const sucursal_id = await resolverSucursalOperativa(req);
    const page        = Math.max(1, parseInt(req.query.page)  || 1);
    const limit       = Math.min(200, parseInt(req.query.limit) || 50);
    const q           = req.query.q?.toString().trim()         || '';
    const categoria   = req.query.categoria?.toString().trim() || '';
    const offset      = (page - 1) * limit;

    // Los desactivados (eliminados con historial) no se listan; ?inactivos=true muestra solo esos
    const where = req.query.inactivos === 'true'
      ? { empresa_id, activo: false }
      : { empresa_id, activo: { [Op.not]: false } };
    if (q) {
      where[Op.or] = [
        { nombre:        { [Op.iLike]: `%${q}%` } },
        { codigo_barras: { [Op.iLike]: `%${q}%` } },
        { descripcion:   { [Op.iLike]: `%${q}%` } },
        { marca:         { [Op.iLike]: `%${q}%` } },
        { modelo:        { [Op.iLike]: `%${q}%` } },
        { talla:         { [Op.iLike]: `%${q}%` } },
        { color:         { [Op.iLike]: `%${q}%` } },
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
    responderErrorScope(res, err);
  }
};

export const stockBajoCount = async (req, res) => {
  try {
    const scope = await resolverScopeSucursales(req);
    const rows = await Producto.findAll({
      where: { empresa_id: scope.empresa_id, activo: { [Op.not]: false } },
      include: [{ model: StockSucursal, where: { sucursal_id: scope.whereSucursal }, required: false, attributes: ['stock_actual', 'stock_minimo'] }],
      attributes: ['stock_actual', 'stock_minimo'],
    });
    const count = rows.filter(p => {
      const stocks = p.StockSucursals ?? [];
      if (stocks.length === 0) {
        const actual = p.stock_actual ?? 0;
        const minimo = p.stock_minimo ?? 5;
        return actual <= minimo;
      }
      return stocks.some(s => {
        const actual = s.stock_actual ?? 0;
        const minimo = s.stock_minimo ?? p.stock_minimo ?? 5;
        return actual <= minimo;
      });
    }).length;
    res.json({ count });
  } catch (err) {
    responderErrorScope(res, err);
  }
};

export const createProducto = async (req, res) => {
  try {
    const empresa_id = req.usuario.empresa_id;
    const sucursal_id = await resolverSucursalOperativa(req);
    const data = { ...limpiarProducto(req.body), empresa_id };
    if (!data.minimo_mayoreo || Number(data.minimo_mayoreo) === 0) data.minimo_mayoreo = null;
    if (data.activo === undefined) data.activo = true;
    data.codigo_barras = String(data.codigo_barras ?? "").trim() || codigoInterno();
    if (await Producto.findOne({ where: { empresa_id, codigo_barras: data.codigo_barras }, attributes: ["producto_id"] })) {
      return res.status(400).json({ error: "Ya tienes un producto con ese código de barras." });
    }

    const nuevoProducto = await Producto.create(data);
    const stockInicial = Number(nuevoProducto.stock_actual) || 0;
    const sucursales = await Sucursal.findAll({ where: { empresa_id, activa: true }, attributes: ['sucursal_id'] });

    await Promise.all(sucursales.map(s => StockSucursal.create({
      producto_id:  nuevoProducto.producto_id,
      sucursal_id:  s.sucursal_id,
      stock_actual: s.sucursal_id === sucursal_id ? stockInicial : 0,
      stock_minimo: nuevoProducto.stock_minimo || 0
    }).catch(() => {})));

    await MovimientoInventario.create({
      producto_id: nuevoProducto.producto_id,
      nombre_producto: nuevoProducto.nombre,
      codigo_barras: nuevoProducto.codigo_barras,
      usuario_id: req.usuario.id,
      sucursal_id,
      tipo_movimiento: "ENTRADA",
      motivo: "ALTA",
      cantidad: stockInicial,
      stock_anterior: 0,
      stock_nuevo: stockInicial,
      observaciones: "Alta inicial de producto",
      fecha: new Date()
    });

    res.json({ msg: "Producto creado correctamente", producto: nuevoProducto });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: "El código de barras ya existe." });
    }
    responderErrorScope(res, err);
  }
};

export const updateProducto = async (req, res) => {
  try {
    const { id } = req.params;
    const empresa_id = req.usuario.empresa_id;
    const sucursal_id = await resolverSucursalOperativa(req);
    const data = limpiarProducto(req.body);
    if (data.minimo_mayoreo !== undefined && (!data.minimo_mayoreo || Number(data.minimo_mayoreo) === 0)) {
      data.minimo_mayoreo = null;
    }

    const producto = await Producto.findOne({ where: { producto_id: id, empresa_id } });
    if (!producto) return res.status(404).json({ error: "Producto no encontrado" });

    const stockActualNuevo = data.stock_actual !== undefined ? Number(data.stock_actual) : undefined;
    const stockMinimoNuevo = data.stock_minimo !== undefined ? Number(data.stock_minimo) : undefined;
    const datosProducto = { ...data };
    delete datosProducto.stock_actual;

    const [updated] = await Producto.update(datosProducto, { where: { producto_id: id, empresa_id } });
    if (!updated) return res.status(404).json({ error: "Producto no encontrado" });

    // Si cambia stock_actual o stock_minimo, actualizar también StockSucursal de esta sucursal
    if (stockActualNuevo !== undefined || stockMinimoNuevo !== undefined) {
      let stockReg = await StockSucursal.findOne({ where: { producto_id: id, sucursal_id } });
      if (!stockReg) {
        stockReg = await StockSucursal.create({
          producto_id: id,
          sucursal_id,
          stock_actual: 0,
          stock_minimo: stockMinimoNuevo ?? producto.stock_minimo ?? 0
        });
      }

      const stockAnterior = Number(stockReg.stock_actual) || 0;
      const stockUpdate = {};
      if (stockActualNuevo !== undefined) stockUpdate.stock_actual = stockActualNuevo;
      if (stockMinimoNuevo !== undefined) stockUpdate.stock_minimo = stockMinimoNuevo;

      if (Object.keys(stockUpdate).length > 0) {
        await stockReg.update(stockUpdate);
      }

      if (stockActualNuevo !== undefined && stockActualNuevo !== stockAnterior) {
        await MovimientoInventario.create({
          producto_id: Number(id),
          nombre_producto: producto.nombre,
          codigo_barras: producto.codigo_barras,
          usuario_id: req.usuario.id,
          sucursal_id,
          tipo_movimiento: stockActualNuevo > stockAnterior ? "ENTRADA" : "SALIDA",
          motivo: "AJUSTE",
          cantidad: Math.abs(stockActualNuevo - stockAnterior),
          stock_anterior: stockAnterior,
          stock_nuevo: stockActualNuevo,
          observaciones: "Ajuste desde edicion de producto",
          fecha: new Date()
        });
      }
    }

    const productoActualizado = await Producto.findByPk(id);
    return res.json({ msg: "Producto actualizado", producto: productoActualizado });
  } catch (err) {
    responderErrorScope(res, err);
  }
};

const LOTE_IMPORTACION = 500;

const codigoInterno = () => `INT-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

// POST /api/productos/importar  (multipart: archivo, sucursal_id, actualizar=true|false)
// Crea productos nuevos y, si actualizar=true, actualiza precios/datos/existencia de los que ya existen.
export const importarProductos = (req, res) => {
  uploadMiddleware(req, res, async (err) => {
    if (err) return res.status(400).json({ error: 'Error al recibir el archivo (maximo 10 MB)' });
    if (!req.file) return res.status(400).json({ error: 'No se envió ningún archivo' });

    try {
      const empresa_id  = req.usuario.empresa_id;
      const sucursal_id = await resolverSucursalOperativa(req);
      const actualizar  = req.body?.actualizar === 'true' || req.body?.actualizar === true;

      const { filas, reconocidas, ignoradas } = leerFilasInventario(req.file.buffer);
      if (filas.length === 0) return res.status(400).json({ error: 'El archivo no tiene productos debajo de los encabezados' });
      if (filas.length > 20000) return res.status(400).json({ error: 'Maximo 20,000 productos por archivo. Divide el Excel en partes.' });

      const sucursales = await Sucursal.findAll({ where: { empresa_id, activa: true }, attributes: ['sucursal_id'] });
      const sucursalIds = sucursales.map(s => s.sucursal_id);

      const existentes = await Producto.findAll({
        where: { empresa_id },
        attributes: ['producto_id', 'codigo_barras', 'nombre']
      });
      const porCodigo = new Map(existentes.filter(p => p.codigo_barras).map(p => [String(p.codigo_barras), p]));

      const errores = [];
      const nuevos = [];
      const paraActualizar = [];
      const vistosEnArchivo = new Set();
      let omitidos = 0;

      for (const { numero, datos } of filas) {
        if (!datos.nombre) { omitidos++; errores.push(`Fila ${numero}: sin nombre`); continue; }
        if (datos.precio_menudeo !== undefined && datos.precio_menudeo !== null && datos.precio_menudeo < 0) {
          omitidos++; errores.push(`Fila ${numero} (${datos.nombre}): precio negativo`); continue;
        }
        if (datos.stock_actual !== undefined && datos.stock_actual !== null) {
          if (datos.stock_actual < 0) { omitidos++; errores.push(`Fila ${numero} (${datos.nombre}): existencia negativa`); continue; }
          // Piezas y bultos no se fraccionan: se redondea la existencia
          if (!permiteDecimales(datos.unidad_venta ?? 'pieza')) datos.stock_actual = Math.round(datos.stock_actual);
        }

        const codigo = datos.codigo_barras ? String(datos.codigo_barras) : null;
        if (codigo && vistosEnArchivo.has(codigo)) { omitidos++; errores.push(`Fila ${numero}: codigo ${codigo} repetido en el archivo`); continue; }
        if (codigo) vistosEnArchivo.add(codigo);

        const existente = codigo ? porCodigo.get(codigo) : null;
        if (existente) {
          if (actualizar) paraActualizar.push({ numero, existente, datos });
          else omitidos++;
          continue;
        }
        nuevos.push({ numero, datos: { ...datos, codigo_barras: codigo || codigoInterno() } });
      }

      // Altas por lotes: un INSERT por cada 500 productos en lugar de 3 consultas por fila
      let importados = 0;
      for (let i = 0; i < nuevos.length; i += LOTE_IMPORTACION) {
        const lote = nuevos.slice(i, i + LOTE_IMPORTACION);
        const t = await sequelize.transaction();
        try {
          const creados = await Producto.bulkCreate(lote.map(({ datos }) => ({
            ...limpiarProducto(datos),
            empresa_id,
            categoria:      datos.categoria || 'Varios',
            precio_menudeo: datos.precio_menudeo ?? 0,
            precio_mayoreo: datos.precio_mayoreo ?? 0,
            precio_oferta:  datos.precio_oferta ?? 0,
            stock_actual:   datos.stock_actual ?? 0,
            stock_minimo:   datos.stock_minimo ?? 0,
            minimo_mayoreo: datos.minimo_mayoreo || null,
            activo:         true
          })), { transaction: t, returning: true });

          await StockSucursal.bulkCreate(creados.flatMap(p => sucursalIds.map(sid => ({
            producto_id:  p.producto_id,
            sucursal_id:  sid,
            stock_actual: sid === sucursal_id ? (Number(p.stock_actual) || 0) : 0,
            stock_minimo: Number(p.stock_minimo) || 0
          }))), { transaction: t, ignoreDuplicates: true });

          await MovimientoInventario.bulkCreate(creados.filter(p => Number(p.stock_actual) > 0).map(p => ({
            producto_id: p.producto_id,
            nombre_producto: p.nombre,
            codigo_barras: p.codigo_barras,
            usuario_id: req.usuario.id,
            sucursal_id,
            tipo_movimiento: "ENTRADA",
            motivo: "ALTA",
            cantidad: Number(p.stock_actual),
            stock_anterior: 0,
            stock_nuevo: Number(p.stock_actual),
            observaciones: "Alta inicial por importacion",
            fecha: new Date()
          })), { transaction: t });

          await t.commit();
          importados += creados.length;
        } catch (loteErr) {
          await t.rollback();
          errores.push(`Filas ${lote[0].numero}-${lote[lote.length - 1].numero}: ${loteErr.message}`);
        }
      }

      // Actualizaciones: solo campos que trae el Excel. La existencia se ajusta en la sucursal activa.
      let actualizados = 0;
      for (const { numero, existente, datos } of paraActualizar) {
        const t = await sequelize.transaction();
        try {
          const cambios = limpiarProducto(datos);
          delete cambios.codigo_barras;
          const nuevaExistencia = cambios.stock_actual;
          delete cambios.stock_actual;
          for (const k of Object.keys(cambios)) if (cambios[k] === null && k !== 'precio_compra') delete cambios[k];

          if (Object.keys(cambios).length > 0) {
            await Producto.update(cambios, { where: { producto_id: existente.producto_id, empresa_id }, transaction: t });
          }

          if (nuevaExistencia !== undefined && nuevaExistencia !== null) {
            let stockReg = await StockSucursal.findOne({ where: { producto_id: existente.producto_id, sucursal_id }, transaction: t, lock: true });
            if (!stockReg) {
              stockReg = await StockSucursal.create({ producto_id: existente.producto_id, sucursal_id, stock_actual: 0, stock_minimo: cambios.stock_minimo ?? 0 }, { transaction: t });
            }
            const anterior = Number(stockReg.stock_actual) || 0;
            if (anterior !== nuevaExistencia) {
              await stockReg.update({ stock_actual: nuevaExistencia }, { transaction: t });
              await Producto.increment('stock_actual', { by: nuevaExistencia - anterior, where: { producto_id: existente.producto_id, empresa_id }, transaction: t });
              await MovimientoInventario.create({
                producto_id: existente.producto_id,
                nombre_producto: cambios.nombre ?? existente.nombre,
                codigo_barras: existente.codigo_barras,
                usuario_id: req.usuario.id,
                sucursal_id,
                tipo_movimiento: nuevaExistencia > anterior ? "ENTRADA" : "SALIDA",
                motivo: "AJUSTE",
                cantidad: Math.abs(nuevaExistencia - anterior),
                stock_anterior: anterior,
                stock_nuevo: nuevaExistencia,
                observaciones: "Ajuste por importacion de Excel",
                fecha: new Date()
              }, { transaction: t });
            }
          }
          await t.commit();
          actualizados++;
        } catch (filaErr) {
          await t.rollback();
          errores.push(`Fila ${numero} (${datos.nombre}): ${filaErr.message}`);
        }
      }

      return res.json({
        mensaje: 'Importación completada',
        importados,
        actualizados,
        omitidos,
        errores: errores.slice(0, 20),
        total_errores: errores.length,
        total_filas: filas.length,
        columnas_reconocidas: reconocidas,
        columnas_ignoradas: ignoradas
      });
    } catch (e) {
      if (e.status) return responderErrorScope(res, e);
      return res.status(400).json({ error: 'No se pudo leer el archivo. Usa Excel (.xlsx, .xls) o CSV.' });
    }
  });
};

// GET /api/productos/plantilla — Excel de ejemplo para cargar inventario
export const descargarPlantilla = (req, res) => {
  const ejemplos = [
    ["7501055300075", "Refresco cola 600 ml", "Bebidas", "pieza", 18, 16, 12, 13.5, 48, 12, "", "", "", "", "", "", "no", "Refrigerador 1", ""],
    ["", "Frijol a granel", "Abarrotes", "kg", 32, "", "", 24, 25.5, 5, "", "", "", "", "", "", "no", "", "Se vende por kilo"],
    ["7501234567890", "Paracetamol 500 mg 10 tabletas", "Medicamentos", "pieza", 35, "", "", 18, 30, 10, "Genérico", "", "", "", "L2309A", "31/12/2027", "no", "Estante A2", ""],
    ["GOR-NY-NEG", "Gorra beisbolera", "Gorras", "pieza", 250, 220, 6, 120, 15, 3, "New Era", "9FORTY", "Ajustable", "Negro", "", "", "no", "", ""],
    ["", "Cable calibre 12", "Electricidad e Iluminación", "metro", 14, 12, 100, 8, 300, 50, "Condumex", "", "", "Rojo", "", "", "no", "Pasillo 3", ""],
  ];
  const ws = XLSX.utils.aoa_to_sheet([COLUMNAS_PLANTILLA, ...ejemplos]);
  ws['!cols'] = COLUMNAS_PLANTILLA.map(c => ({ wch: Math.max(12, c.length + 2) }));
  const instrucciones = XLSX.utils.aoa_to_sheet([
    ["Cómo llenar la plantilla"],
    ["Solo es obligatorio el Nombre. Las columnas que no uses puedes borrarlas."],
    ["Codigo de barras: si lo dejas vacío se genera un código interno (útil para granel, fruta, etc.)."],
    ["Unidad: pieza, kg, litro, metro o bulto. kg/litro/metro permiten vender con decimales (ej. 0.250 kg)."],
    ["Precio = precio de venta al público. Costo = lo que te cuesta (para calcular tu ganancia)."],
    ["Caducidad: dd/mm/aaaa o mm/aaaa. Requiere receta: si / no."],
    ["También se aceptan encabezados como Código, Producto, Existencia, Precio venta, Laboratorio, Departamento."],
    ["Si importas un código que ya existe y activas 'Actualizar existentes', se actualizan precio, datos y existencia."],
  ]);
  instrucciones['!cols'] = [{ wch: 110 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Productos');
  XLSX.utils.book_append_sheet(wb, instrucciones, 'Instrucciones');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="plantilla_inventario_scpos.xlsx"');
  res.send(buffer);
};

export const deleteProducto = async (req, res) => {
  try {
    const { id } = req.params;
    const empresa_id = req.usuario.empresa_id;
    const producto = await Producto.findOne({ where: { producto_id: id, empresa_id } });
    if (!producto) return res.status(404).json({ error: "Producto no encontrado" });

    // Con historial (ventas, compras, movimientos) se desactiva para no romper reportes
    const [historial] = await sequelize.query(
      `SELECT 1 FROM detalle_ventas WHERE producto_id = :id
       UNION ALL SELECT 1 FROM movimientos_inventario WHERE producto_id = :id AND motivo <> 'ALTA'
       LIMIT 1`,
      { replacements: { id: producto.producto_id } }
    );
    if (historial.length > 0) {
      await producto.update({ activo: false });
      return res.json({ msg: "Producto desactivado (tiene historial)", eliminado: false });
    }

    const t = await sequelize.transaction();
    try {
      await MovimientoInventario.destroy({ where: { producto_id: producto.producto_id }, transaction: t });
      await StockSucursal.destroy({ where: { producto_id: producto.producto_id }, transaction: t });
      await producto.destroy({ transaction: t });
      await t.commit();
    } catch (e) {
      await t.rollback();
      // Si alguna otra tabla lo referencia, se desactiva en lugar de fallar
      await producto.update({ activo: false });
      return res.json({ msg: "Producto desactivado (tiene historial)", eliminado: false });
    }
    res.json({ msg: "Producto eliminado correctamente", eliminado: true });
  } catch (err) {
    responderErrorScope(res, err);
  }
};

import XLSX from "xlsx";

// Lector flexible de inventarios en Excel/CSV para cualquier giro.
// Reconoce encabezados comunes ("Código", "Precio", "Existencia", "Laboratorio", "Caducidad"...)
// y tolera filas de titulo antes de los encabezados.

// Orden = prioridad: si un Excel trae "codigo" y "sku", gana el primero de la lista.
// Incluye los encabezados que exportan otros POS comunes: Eleventa, SICAR, MyBusiness/Abarrotes PDV,
// Loyverse, Square y Shopify. Un alias que termina en "*" acepta cualquier final
// (ej. Loyverse exporta "In stock [Mi tienda]").
const ALIAS = {
  codigo_barras:   ["codigo_barras", "codigo_de_barras", "cod_barras", "codigobarras", "barcode", "variant_barcode", "ean", "upc", "codigo", "cod", "sku", "variant_sku", "clave_producto", "codigo_producto", "clave", "clave_alterna"],
  nombre:          ["nombre", "nombre_producto", "producto", "articulo", "nombre_articulo", "item", "name", "item_name", "title"],
  descripcion:     ["descripcion", "detalle", "descripcion_larga", "notas"],
  categoria:       ["categoria", "departamento", "familia", "linea", "grupo", "rubro", "seccion", "category", "product_category", "type"],
  precio_menudeo:  ["precio_menudeo", "precio", "precio_venta", "precio_publico", "pvp", "precio_unitario", "venta", "menudeo", "precio_de_venta", "precio_1", "precio1", "price", "variant_price", "default_price", "price_*"],
  precio_mayoreo:  ["precio_mayoreo", "mayoreo", "precio_mayorista", "precio_de_mayoreo", "precio_2", "precio2"],
  precio_oferta:   ["precio_oferta", "oferta", "promocion", "precio_promocion"],
  precio_compra:   ["precio_compra", "costo", "costo_unitario", "precio_costo", "costo_compra", "precio_de_compra", "cost", "cost_per_item", "default_cost"],
  stock_actual:    ["stock_actual", "stock", "existencia", "existencias", "inventario", "cantidad", "piezas", "inventario_actual", "in_stock", "in_stock_*", "variant_inventory_qty", "quantity", "qty", "current_quantity_*"],
  stock_minimo:    ["stock_minimo", "minimo", "existencia_minima", "inventario_minimo", "inv_minimo", "punto_de_reorden", "reorden", "low_stock", "low_stock_*", "stock_alert_*"],
  minimo_mayoreo:  ["minimo_mayoreo", "cantidad_mayoreo", "mayoreo_desde", "piezas_mayoreo"],
  unidad_venta:    ["unidad_venta", "unidad", "unidad_medida", "um", "u_m", "unidad_de_medida", "tipo_de_venta", "se_vende_por", "sold_by_weight"],
  marca:           ["marca", "laboratorio", "fabricante", "proveedor_marca"],
  modelo:          ["modelo", "estilo", "referencia"],
  talla:           ["talla", "medida", "tamano", "size"],
  color:           ["color", "colores"],
  lote:            ["lote", "numero_de_lote", "no_lote"],
  fecha_caducidad: ["fecha_caducidad", "caducidad", "vencimiento", "fecha_vencimiento", "fecha_de_caducidad", "caduca", "expira"],
  requiere_receta: ["requiere_receta", "receta", "con_receta"],
  ubicacion:       ["ubicacion", "pasillo", "anaquel", "estante", "ubicacion_almacen"],
  clave_sat:       ["clave_sat", "clave_prod_serv", "clave_producto_sat"],
  clave_unidad_sat:["clave_unidad_sat", "clave_unidad"],
  objeto_imp:      ["objeto_imp", "objeto_impuesto"],
};

export const normalizarEncabezado = (valor) =>
  String(valor ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

// Asigna cada columna del Excel a un campo del producto
export const mapearEncabezados = (encabezados) => {
  const normalizados = encabezados.map(normalizarEncabezado);
  const usados = new Set();
  const mapa = {};
  for (const [campo, alias] of Object.entries(ALIAS)) {
    for (const a of alias) {
      const prefijo = a.endsWith("*") ? a.slice(0, -1) : null;
      const idx = normalizados.findIndex((h, i) => !usados.has(i) && (prefijo ? h.startsWith(prefijo) : h === a));
      if (idx >= 0) {
        mapa[campo] = idx;
        usados.add(idx);
        break;
      }
    }
  }
  // Muchos sistemas exportan el nombre como "Descripcion"
  if (mapa.nombre === undefined && mapa.descripcion !== undefined) {
    mapa.nombre = mapa.descripcion;
    delete mapa.descripcion;
  }
  const ignoradas = encabezados.filter((h, i) => !usados.has(i) && String(h ?? "").trim());
  return { mapa, ignoradas };
};

export const parsearNumero = (valor) => {
  if (valor === null || valor === undefined || valor === "") return null;
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  const limpio = String(valor).replace(/[$\s]/g, "").replace(/,(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
};

export const parsearUnidad = (valor) => {
  const u = normalizarEncabezado(valor);
  if (!u) return "pieza";
  if (["kg", "kgs", "kilo", "kilos", "kilogramo", "kilogramos", "kgm"].includes(u)) return "kg";
  if (["l", "lt", "lts", "litro", "litros", "ltr"].includes(u)) return "litro";
  if (["m", "mt", "mts", "metro", "metros", "mtr"].includes(u)) return "metro";
  if (["bulto", "bultos", "costal", "costales", "saco", "sacos"].includes(u)) return "bulto";
  // Eleventa: "Granel" = se vende por kilo; Loyverse: "Sold by weight" = Y
  if (["granel", "a_granel", "peso", "y", "yes", "si", "true"].includes(u)) return "kg";
  return "pieza";
};

const pad = (n) => String(n).padStart(2, "0");

export const parsearFecha = (valor) => {
  if (valor === null || valor === undefined || valor === "") return null;
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    return `${valor.getFullYear()}-${pad(valor.getMonth() + 1)}-${pad(valor.getDate())}`;
  }
  if (typeof valor === "number") {
    const d = XLSX.SSF.parse_date_code(valor);
    return d ? `${d.y}-${pad(d.m)}-${pad(d.d)}` : null;
  }
  const s = String(valor).trim();
  let m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(s);
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  m = /^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/.exec(s); // dd/mm/aaaa (formato Mexico)
  if (m) {
    const anio = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${anio}-${pad(m[2])}-${pad(m[1])}`;
  }
  m = /^(\d{1,2})[-/](\d{4})$/.exec(s); // mm/aaaa: ultimo dia del mes, comun en medicamentos
  if (m) {
    const ultimo = new Date(Number(m[2]), Number(m[1]), 0).getDate();
    return `${m[2]}-${pad(m[1])}-${pad(ultimo)}`;
  }
  return null;
};

const parsearBooleano = (valor) => ["si", "s", "true", "1", "x", "yes"].includes(normalizarEncabezado(valor));

const parsearCodigo = (valor) => {
  if (valor === null || valor === undefined) return null;
  // Codigos de barras largos llegan como numero; toFixed evita notacion cientifica
  const s = typeof valor === "number" ? valor.toFixed(0) : String(valor).trim();
  return s || null;
};

const texto = (valor, max) => {
  const s = String(valor ?? "").trim();
  return s ? s.slice(0, max) : null;
};

// Convierte una fila cruda en datos de producto. Solo incluye campos presentes en el Excel.
export const filaAProducto = (fila, mapa) => {
  const get = (campo) => (mapa[campo] === undefined ? undefined : fila[mapa[campo]]);
  const p = {};
  const asignar = (campo, valor) => { if (get(campo) !== undefined) p[campo] = valor; };

  asignar("codigo_barras", parsearCodigo(get("codigo_barras")));
  asignar("nombre", texto(get("nombre"), 255));
  asignar("descripcion", texto(get("descripcion"), 255));
  asignar("categoria", texto(get("categoria"), 60));
  for (const campo of ["precio_menudeo", "precio_mayoreo", "precio_oferta", "precio_compra", "stock_actual", "stock_minimo", "minimo_mayoreo"]) {
    asignar(campo, parsearNumero(get(campo)));
  }
  asignar("unidad_venta", parsearUnidad(get("unidad_venta")));
  asignar("marca", texto(get("marca"), 100));
  asignar("modelo", texto(get("modelo"), 100));
  asignar("talla", texto(get("talla"), 30));
  asignar("color", texto(get("color"), 50));
  asignar("lote", texto(get("lote"), 60));
  asignar("fecha_caducidad", parsearFecha(get("fecha_caducidad")));
  asignar("requiere_receta", parsearBooleano(get("requiere_receta")));
  asignar("ubicacion", texto(get("ubicacion"), 60));
  asignar("clave_sat", texto(get("clave_sat"), 8));
  asignar("clave_unidad_sat", texto(get("clave_unidad_sat"), 6));
  asignar("objeto_imp", texto(get("objeto_imp"), 3));
  return p;
};

// Lee el primer libro y localiza la fila de encabezados (puede haber titulos arriba).
export const leerFilasInventario = (buffer) => {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const matriz = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true, blankrows: false });

  let filaEncabezado = -1;
  let mapeo = null;
  for (let i = 0; i < Math.min(matriz.length, 15); i++) {
    const candidato = mapearEncabezados(matriz[i] || []);
    if (candidato.mapa.nombre !== undefined && Object.keys(candidato.mapa).length >= 2) {
      filaEncabezado = i;
      mapeo = candidato;
      break;
    }
  }
  if (!mapeo) {
    const error = new Error("No se encontraron encabezados. El Excel debe tener al menos una columna de nombre/producto y otra de precio, codigo o existencia.");
    error.status = 400;
    throw error;
  }

  const filas = matriz.slice(filaEncabezado + 1)
    .filter(f => Array.isArray(f) && f.some(c => c !== null && String(c).trim() !== ""))
    .map((f, i) => ({ numero: filaEncabezado + 2 + i, datos: filaAProducto(f, mapeo.mapa) }));

  const reconocidas = Object.keys(mapeo.mapa);
  return { filas, reconocidas, ignoradas: mapeo.ignoradas };
};

// Encabezados de la plantilla descargable, en el orden en que se muestran
export const COLUMNAS_PLANTILLA = [
  "Codigo de barras", "Nombre", "Categoria", "Unidad", "Precio", "Precio mayoreo", "Minimo mayoreo",
  "Costo", "Existencia", "Stock minimo", "Marca", "Modelo", "Talla", "Color", "Lote", "Caducidad",
  "Requiere receta", "Ubicacion", "Descripcion"
];

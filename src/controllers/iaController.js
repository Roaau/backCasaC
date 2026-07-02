import sequelize from "../config/database.js";
import { QueryTypes } from "sequelize";
import { resolverScopeSucursales } from "../utils/scope.js";
import { rangoFechasReporte } from "../utils/fechas.js";
import { registrarAuditoria } from "../utils/auditoria.js";
import { generarNotificacionesEmpresa } from "./notificacionesController.js";
import Notificacion from "../models/Notificacion.js";

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
const DAILY_LIMIT = Number(process.env.IA_DAILY_LIMIT || 25);
const CACHE_TTL_MS = Number(process.env.IA_CACHE_TTL_MS || 10 * 60 * 1000);
const usage = new Map();
const cache = new Map();

const todayKey = () => new Date().toISOString().slice(0, 10);

function tieneGeminiKey() {
  return Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY);
}

function geminiKey() {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
}

function usageKey(req) {
  return `${todayKey()}:${req.usuario?.empresa_id || "sin-empresa"}`;
}

function checkLimit(req) {
  const key = usageKey(req);
  const current = usage.get(key) || 0;
  if (current >= DAILY_LIMIT) {
    const err = new Error(`Limite diario de IA alcanzado (${DAILY_LIMIT}). Intenta manana o aumenta IA_DAILY_LIMIT.`);
    err.status = 429;
    throw err;
  }
  usage.set(key, current + 1);
  return current + 1;
}

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.createdAt > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

function cacheSet(key, value) {
  cache.set(key, { value, createdAt: Date.now() });
}

async function llamarGemini({ system, prompt, maxTokens = 900 }) {
  const apiKey = geminiKey();
  if (!apiKey) {
    const err = new Error("IA no disponible. Falta configurar GEMINI_API_KEY en el servidor.");
    err.status = 402;
    throw err;
  }

  const response = await fetch(`${GEMINI_URL}/${DEFAULT_MODEL}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.25,
        maxOutputTokens: maxTokens,
        responseMimeType: "text/plain"
      }
    })
  });

  if (!response.ok) {
    const text = await response.text();
    const err = new Error(`Error Gemini: ${text.slice(0, 300)}`);
    err.status = response.status;
    throw err;
  }

  const data = await response.json();
  const texto = data?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("\n").trim();
  if (!texto) throw new Error("Gemini no devolvio texto.");
  return texto;
}

function scopePayload(scope) {
  return scope.todas ? { todas_sucursales: true } : { sucursal_id: scope.sucursal_id };
}

async function ventasResumen(scope, fechaInicio, fechaFin) {
  const rango = rangoFechasReporte(fechaInicio, fechaFin);
  const rows = await sequelize.query(`
    SELECT COUNT(*)::int AS ventas,
           COALESCE(SUM(v.total),0)::numeric AS total,
           COALESCE(SUM(CASE WHEN COALESCE(v.tipo_pago,'efectivo')='efectivo' THEN v.total ELSE 0 END),0)::numeric AS efectivo,
           COALESCE(SUM(CASE WHEN COALESCE(v.tipo_pago,'efectivo')='tarjeta' THEN v.total ELSE 0 END),0)::numeric AS tarjeta,
           COALESCE(SUM(CASE WHEN v.tipo_venta='Pedido' THEN 1 ELSE 0 END),0)::int AS pedidos
    FROM ventas v
    WHERE v.sucursal_id IN (:sucursalIds) AND v.fecha BETWEEN :inicio AND :fin
  `, { replacements: { sucursalIds: scope.sucursalIds, inicio: rango.inicio, fin: rango.fin }, type: QueryTypes.SELECT });
  return rows[0] || { ventas: 0, total: 0, efectivo: 0, tarjeta: 0, pedidos: 0 };
}

async function topProductos(scope, fechaInicio, fechaFin, limit = 8) {
  const rango = rangoFechasReporte(fechaInicio, fechaFin);
  return sequelize.query(`
    SELECT d.nombre_producto AS nombre, SUM(d.cantidad)::numeric AS cantidad, SUM(d.subtotal)::numeric AS total
    FROM detalle_ventas d
    JOIN ventas v ON v.venta_id = d.venta_id
    WHERE v.sucursal_id IN (:sucursalIds) AND v.fecha BETWEEN :inicio AND :fin
    GROUP BY d.nombre_producto
    ORDER BY SUM(d.cantidad) DESC
    LIMIT :limit
  `, { replacements: { sucursalIds: scope.sucursalIds, inicio: rango.inicio, fin: rango.fin, limit }, type: QueryTypes.SELECT });
}

async function ventasPorSucursal(scope, fechaInicio, fechaFin) {
  const rango = rangoFechasReporte(fechaInicio, fechaFin);
  return sequelize.query(`
    SELECT s.nombre AS sucursal, COUNT(v.venta_id)::int AS ventas, COALESCE(SUM(v.total),0)::numeric AS total
    FROM sucursales s
    LEFT JOIN ventas v ON v.sucursal_id = s.sucursal_id AND v.fecha BETWEEN :inicio AND :fin
    WHERE s.sucursal_id IN (:sucursalIds)
    GROUP BY s.sucursal_id, s.nombre
    ORDER BY total DESC
  `, { replacements: { sucursalIds: scope.sucursalIds, inicio: rango.inicio, fin: rango.fin }, type: QueryTypes.SELECT });
}

async function stockBajo(scope, limit = 12) {
  return sequelize.query(`
    SELECT p.producto_id, p.nombre, s.nombre AS sucursal,
           COALESCE(ss.stock_actual, p.stock_actual, 0)::numeric AS stock_actual,
           COALESCE(NULLIF(ss.stock_minimo, 0), NULLIF(p.stock_minimo, 0), 5)::numeric AS stock_minimo
    FROM productos p
    JOIN stock_sucursal ss ON ss.producto_id = p.producto_id
    JOIN sucursales s ON s.sucursal_id = ss.sucursal_id
    WHERE p.empresa_id = :empresaId AND s.sucursal_id IN (:sucursalIds) AND p.activo = true
      AND COALESCE(ss.stock_actual, p.stock_actual, 0) <= COALESCE(NULLIF(ss.stock_minimo, 0), NULLIF(p.stock_minimo, 0), 5)
    ORDER BY COALESCE(ss.stock_actual, p.stock_actual, 0) ASC
    LIMIT :limit
  `, { replacements: { empresaId: scope.empresa_id, sucursalIds: scope.sucursalIds, limit }, type: QueryTypes.SELECT });
}

async function pedidosResumen(scope, fechaInicio, fechaFin) {
  const rango = rangoFechasReporte(fechaInicio, fechaFin);
  return sequelize.query(`
    SELECT v.folio, v.fecha, v.total, v.estado_pedido, s.nombre AS sucursal,
           CASE WHEN v.nombre_cliente IS NULL OR v.telefono_cliente IS NULL OR v.direccion_entrega IS NULL THEN true ELSE false END AS datos_incompletos
    FROM ventas v
    JOIN sucursales s ON s.sucursal_id = v.sucursal_id
    WHERE v.sucursal_id IN (:sucursalIds) AND v.fecha BETWEEN :inicio AND :fin AND v.tipo_venta = 'Pedido'
    ORDER BY v.fecha ASC
    LIMIT 25
  `, { replacements: { sucursalIds: scope.sucursalIds, inicio: rango.inicio, fin: rango.fin }, type: QueryTypes.SELECT });
}

async function cajaResumen(scope, fechaInicio, fechaFin) {
  const rango = rangoFechasReporte(fechaInicio, fechaFin);
  return sequelize.query(`
    SELECT c.caja_id, s.nombre AS sucursal, c.fecha_apertura, c.fecha_cierre,
           c.monto_inicial, c.monto_final,
           COALESCE((SELECT SUM(v.total) FROM ventas v WHERE v.sucursal_id = c.sucursal_id AND v.fecha >= c.fecha_apertura AND (c.fecha_cierre IS NULL OR v.fecha <= c.fecha_cierre) AND COALESCE(v.tipo_pago,'efectivo')='efectivo'),0) AS ventas_efectivo,
           COALESCE((SELECT SUM(m.monto) FROM movimiento_caja m WHERE m.caja_id = c.caja_id AND m.tipo_movimiento='INGRESO'),0) AS ingresos,
           COALESCE((SELECT SUM(m.monto) FROM movimiento_caja m WHERE m.caja_id = c.caja_id AND m.tipo_movimiento IN ('EGRESO','DEVOLUCION')),0) AS egresos,
           COALESCE((SELECT SUM(m.monto) FROM movimiento_caja m WHERE m.caja_id = c.caja_id AND m.tipo_movimiento IN ('FALTANTE','SOBRANTE')),0) AS ajustes
    FROM caja c
    JOIN sucursales s ON s.sucursal_id = c.sucursal_id
    WHERE c.sucursal_id IN (:sucursalIds) AND c.fecha_apertura BETWEEN :inicio AND :fin
    ORDER BY c.fecha_apertura DESC
    LIMIT 20
  `, { replacements: { sucursalIds: scope.sucursalIds, inicio: rango.inicio, fin: rango.fin }, type: QueryTypes.SELECT });
}

async function auditoriaResumen(scope, fechaInicio, fechaFin) {
  const rango = rangoFechasReporte(fechaInicio, fechaFin);
  return sequelize.query(`
    SELECT accion, entidad, COUNT(*)::int AS total
    FROM auditoria
    WHERE empresa_id = :empresaId AND (sucursal_id IS NULL OR sucursal_id IN (:sucursalIds)) AND fecha BETWEEN :inicio AND :fin
    GROUP BY accion, entidad
    ORDER BY total DESC
    LIMIT 20
  `, { replacements: { empresaId: scope.empresa_id, sucursalIds: scope.sucursalIds, inicio: rango.inicio, fin: rango.fin }, type: QueryTypes.SELECT });
}

function buildPrompt(tipo, payload) {
  const instrucciones = "Responde en espanol mexicano, maximo 7 bullets. Se practico, accionable y prudente. No acuses a empleados ni inventes datos. Si algo requiere revision, di \"conviene revisar\". No menciones que eres IA.";
  const system = `Eres el asistente inteligente del dueno de una ferreteria con POS multi-sucursal. ${instrucciones}`;
  const prompt = `Tipo de analisis: ${tipo}
Datos agregados, sin datos fiscales ni datos sensibles completos:
${JSON.stringify(payload, null, 2)}

Entrega: resumen breve, puntos importantes y una accion recomendada para hoy.`;
  return { system, prompt };
}

async function responderIA(req, res, tipo, payloadBuilder, maxTokens = 900) {
  try {
    const scope = await resolverScopeSucursales(req);
    const fechaInicio = req.body?.fechaInicio || new Date().toISOString().slice(0, 10);
    const fechaFin = req.body?.fechaFin || fechaInicio;
    const cacheKey = JSON.stringify({ tipo, empresa: scope.empresa_id, sucursales: scope.sucursalIds, fechaInicio, fechaFin, body: req.body });
    const cached = cacheGet(cacheKey);
    if (cached) return res.json({ texto: cached, cache: true, limite_diario: DAILY_LIMIT });
    checkLimit(req);
    const payload = await payloadBuilder(scope, fechaInicio, fechaFin);
    const { system, prompt } = buildPrompt(tipo, payload);
    const texto = await llamarGemini({ system, prompt, maxTokens });
    cacheSet(cacheKey, texto);
    await registrarAuditoria(req, {
      accion: "IA_CONSULTA",
      entidad: "ia",
      detalle: { tipo, fechaInicio, fechaFin, todas_sucursales: scope.todas, sucursales: scope.sucursalIds.length }
    });
    res.json({ texto, cache: false, limite_diario: DAILY_LIMIT });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

export const getStatus = (req, res) => {
  res.json({ tieneKey: tieneGeminiKey(), provider: "gemini", model: DEFAULT_MODEL, limite_diario: DAILY_LIMIT });
};

export const consultar = async (req, res) => {
  try {
    checkLimit(req);
    const system = String(req.body.system || "Eres un asistente de negocio para una ferreteria. Responde en espanol y se breve.");
    const prompt = String(req.body.prompt || "").slice(0, 8000);
    if (!prompt.trim()) return res.status(400).json({ error: "prompt requerido" });
    const texto = await llamarGemini({ system, prompt, maxTokens: Number(req.body.max_tokens) || 900 });
    await registrarAuditoria(req, { accion: "IA_CONSULTA_LIBRE", entidad: "ia", detalle: { caracteres: prompt.length } });
    res.json({ texto });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};

export const resumenDashboard = (req, res) => responderIA(req, res, "dashboard", async (scope, fechaInicio, fechaFin) => ({
  scope: scopePayload(scope),
  ventas: await ventasResumen(scope, fechaInicio, fechaFin),
  ventas_por_sucursal: await ventasPorSucursal(scope, fechaInicio, fechaFin),
  top_productos: await topProductos(scope, fechaInicio, fechaFin, 5),
  stock_bajo: await stockBajo(scope, 8),
  pedidos: await pedidosResumen(scope, fechaInicio, fechaFin)
}));

export const analizarReportes = (req, res) => responderIA(req, res, "reportes", async (scope, fechaInicio, fechaFin) => ({
  scope: scopePayload(scope),
  ventas: await ventasResumen(scope, fechaInicio, fechaFin),
  ventas_por_sucursal: await ventasPorSucursal(scope, fechaInicio, fechaFin),
  top_productos: await topProductos(scope, fechaInicio, fechaFin, 10),
  caja: await cajaResumen(scope, fechaInicio, fechaFin),
  pedidos: await pedidosResumen(scope, fechaInicio, fechaFin)
}));

export const sugerirReabasto = (req, res) => responderIA(req, res, "reabasto", async (scope, fechaInicio, fechaFin) => ({
  scope: scopePayload(scope),
  productos_stock_bajo: await stockBajo(scope, 20),
  productos_vendidos: await topProductos(scope, fechaInicio, fechaFin, 15)
}));

export const revisarCorte = (req, res) => responderIA(req, res, "corte de caja", async (scope, fechaInicio, fechaFin) => ({
  scope: scopePayload(scope),
  cortes: await cajaResumen(scope, fechaInicio, fechaFin)
}));

export const priorizarPedidos = (req, res) => responderIA(req, res, "pedidos", async (scope, fechaInicio, fechaFin) => ({
  scope: scopePayload(scope),
  pedidos: await pedidosResumen(scope, fechaInicio, fechaFin)
}));

export const analizarActividad = (req, res) => responderIA(req, res, "actividad y auditoria", async (scope, fechaInicio, fechaFin) => ({
  scope: scopePayload(scope),
  auditoria: await auditoriaResumen(scope, fechaInicio, fechaFin),
  caja: await cajaResumen(scope, fechaInicio, fechaFin),
  pedidos: await pedidosResumen(scope, fechaInicio, fechaFin)
}));

export const resumenNotificacionesIA = (req, res) => responderIA(req, res, "notificaciones", async (scope) => {
  await generarNotificacionesEmpresa(req, scope);
  const notificaciones = await Notificacion.findAll({
    where: {
      empresa_id: scope.empresa_id,
      sucursal_id: scope.todas ? scope.sucursalIds : scope.sucursal_id,
      estado: ["nueva", "vista"]
    },
    order: [["creada_en", "DESC"]],
    limit: 40
  });
  return {
    scope: scopePayload(scope),
    notificaciones: notificaciones.map(n => ({ tipo: n.tipo, severidad: n.severidad, titulo: n.titulo, mensaje: n.mensaje, detalle: n.detalle }))
  };
});

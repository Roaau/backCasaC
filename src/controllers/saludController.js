import sequelize from "../config/database.js";
import { QueryTypes } from "sequelize";
import jwt from "jsonwebtoken";
import { fechaLocalISO, rangoFechasReporte } from "../utils/fechas.js";
import { sumarAFecha } from "../utils/planes.js";

const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: QueryTypes.SELECT });

// Las rutas con ids se agrupan: /api/ventas/123/pedido-estado -> /api/ventas/:id/pedido-estado
export const normalizarRuta = (url) => String(url || "").split("?")[0].replace(/\/\d+(?=\/|$)/g, "/:id").slice(0, 200);

/** Middleware: guarda cada respuesta 5xx para el panel de salud (sin datos del cliente). */
export const registrarErroresServidor = (req, res, next) => {
  res.on("finish", () => {
    if (res.statusCode < 500) return;
    let usuario = req.usuario;
    if (!usuario && req.headers.authorization?.startsWith("Bearer ")) {
      try { usuario = jwt.decode(req.headers.authorization.slice(7)) || undefined; } catch { usuario = undefined; }
    }
    sequelize.query(
      "INSERT INTO errores_servidor (metodo, ruta, status, empresa_id, usuario_id) VALUES (:metodo, :ruta, :status, :empresa_id, :usuario_id)",
      { replacements: {
        metodo: req.method, ruta: normalizarRuta(req.originalUrl), status: res.statusCode,
        empresa_id: usuario?.empresa_id ?? null, usuario_id: usuario?.id ?? null
      } }
    ).catch(() => {});
  });
  next();
};

const RUTAS_VALIDAS = /^\/[a-z0-9\-/]{0,79}$/;

/** POST /api/uso { ruta } — una visita a una pantalla (para saber que se usa y que no). */
export const registrarUso = async (req, res) => {
  const ruta = normalizarRuta(String(req.body?.ruta || "")).slice(0, 80).toLowerCase();
  if (!RUTAS_VALIDAS.test(ruta) || !req.usuario?.empresa_id) return res.status(204).end();
  try {
    await sequelize.query(`
      INSERT INTO uso_pantallas (fecha, empresa_id, usuario_id, ruta, visitas)
      VALUES (:fecha, :empresa_id, :usuario_id, :ruta, 1)
      ON CONFLICT (fecha, empresa_id, usuario_id, ruta) DO UPDATE SET visitas = uso_pantallas.visitas + 1`,
      { replacements: { fecha: fechaLocalISO(), empresa_id: req.usuario.empresa_id, usuario_id: req.usuario.id, ruta } });
  } catch {
    // medir uso nunca debe estorbar
  }
  return res.status(204).end();
};

/** GET /api/superadmin/salud — quien vendio hoy, quien lleva dias sin entrar, errores y pantallas mas usadas. */
export const saludSuperadmin = async (req, res) => {
  try {
    const hoy = fechaLocalISO();
    const { inicio, fin } = rangoFechasReporte(hoy);
    const hace7 = sumarAFecha(hoy, { dias: -7 });
    const hace30 = sumarAFecha(hoy, { dias: -30 });

    const [empresas, errores, erroresPorRuta, pantallas] = await Promise.all([
      q(`
        SELECT e.empresa_id, e.razon_social, e.estado, e.plan, e.fecha_vencimiento,
               COALESCE(h.ventas_hoy, 0)::int AS ventas_hoy, COALESCE(h.total_hoy, 0)::float AS total_hoy,
               uv.ultima_venta, ua.ultimo_acceso,
               COALESCE(ua.usuarios_7d, 0)::int AS usuarios_activos_7d,
               COALESCE(er.errores_7d, 0)::int AS errores_7d
          FROM empresas e
          LEFT JOIN LATERAL (
            SELECT COUNT(*) AS ventas_hoy, SUM(v.total) AS total_hoy
              FROM ventas v JOIN sucursales s ON s.sucursal_id = v.sucursal_id
             WHERE s.empresa_id = e.empresa_id AND v.fecha BETWEEN :inicio AND :fin) h ON true
          LEFT JOIN LATERAL (
            SELECT MAX(v.fecha) AS ultima_venta
              FROM ventas v JOIN sucursales s ON s.sucursal_id = v.sucursal_id
             WHERE s.empresa_id = e.empresa_id) uv ON true
          LEFT JOIN LATERAL (
            SELECT MAX(u.ultimo_acceso) AS ultimo_acceso,
                   COUNT(*) FILTER (WHERE u.ultimo_acceso >= :hace7) AS usuarios_7d
              FROM usuarios u WHERE u.empresa_id = e.empresa_id AND u.activo = true) ua ON true
          LEFT JOIN LATERAL (
            SELECT COUNT(*) AS errores_7d FROM errores_servidor x
             WHERE x.empresa_id = e.empresa_id AND x.fecha >= :hace7) er ON true
         WHERE e.estado IN ('activa', 'prueba', 'vencida')
         ORDER BY ventas_hoy DESC, uv.ultima_venta DESC NULLS LAST`, { inicio, fin, hace7 }),
      q(`SELECT x.fecha, x.metodo, x.ruta, x.status, x.empresa_id, e.razon_social
           FROM errores_servidor x LEFT JOIN empresas e ON e.empresa_id = x.empresa_id
          ORDER BY x.fecha DESC LIMIT 30`),
      q(`SELECT ruta, metodo, COUNT(*)::int AS veces, MAX(fecha) AS ultima
           FROM errores_servidor WHERE fecha >= :hace7
          GROUP BY ruta, metodo ORDER BY veces DESC LIMIT 15`, { hace7 }),
      q(`SELECT ruta, SUM(visitas)::int AS visitas, COUNT(DISTINCT usuario_id)::int AS usuarios,
                COUNT(DISTINCT empresa_id)::int AS negocios
           FROM uso_pantallas WHERE fecha >= :hace30
          GROUP BY ruta ORDER BY visitas DESC LIMIT 30`, { hace30 })
    ]);

    const diasDesde = (fecha) => fecha ? Math.floor((Date.now() - new Date(fecha).getTime()) / 86400000) : null;
    const filas = empresas.map(e => ({
      ...e,
      dias_sin_vender: diasDesde(e.ultima_venta),
      dias_sin_entrar: diasDesde(e.ultimo_acceso)
    }));

    res.json({
      resumen: {
        negocios: filas.length,
        vendieron_hoy: filas.filter(e => e.ventas_hoy > 0).length,
        sin_entrar_7d: filas.filter(e => e.dias_sin_entrar === null || e.dias_sin_entrar >= 7).length,
        errores_7d: erroresPorRuta.reduce((s, r) => s + r.veces, 0)
      },
      empresas: filas,
      errores_recientes: errores,
      errores_por_ruta: erroresPorRuta,
      pantallas
    });
  } catch (e) {
    console.error("saludSuperadmin:", e.message);
    res.status(500).json({ error: "No se pudo armar el panel de salud" });
  }
};

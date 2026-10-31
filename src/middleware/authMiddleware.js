import jwt from "jsonwebtoken";
import { QueryTypes } from "sequelize";
import sequelize from "../config/database.js";
import { parseIdPositivo } from "../utils/scope.js";
import { tokenDeLaPeticion } from "../utils/sesionCookie.js";

// Cache corto del estado de la sesion para no ir a la BD en cada peticion.
// 15 s es lo maximo que tarda en salir un usuario dado de baja o un negocio suspendido.
const CACHE_MS = 15 * 1000;
const cacheSesion = new Map();

export const limpiarCacheSesion = (usuarioId) => {
  if (usuarioId == null) cacheSesion.clear();
  else cacheSesion.delete(Number(usuarioId));
};

const responderSesionInvalida = (res, error) =>
  res.status(401).json({ error, codigo: "SESION_INVALIDA" });

const leerEstadoSesion = async (usuarioId) => {
  const enCache = cacheSesion.get(usuarioId);
  if (enCache && enCache.expira > Date.now()) return enCache.valor;

  const [fila] = await sequelize.query(
    `SELECT u.usuario_id, u.activo, u.rol_id, u.empresa_id, u.sucursal_id, u.es_superadmin,
            COALESCE(u.sesion_version, 0) AS sesion_version,
            e.estado AS empresa_estado, e.fecha_vencimiento
       FROM usuarios u
       LEFT JOIN empresas e ON e.empresa_id = u.empresa_id
      WHERE u.usuario_id = :id`,
    { replacements: { id: usuarioId }, type: QueryTypes.SELECT }
  );
  const valor = fila || null;
  cacheSesion.set(usuarioId, { valor, expira: Date.now() + CACHE_MS });
  if (cacheSesion.size > 5000) cacheSesion.clear();
  return valor;
};

const empresaVencida = (fechaVencimiento) => {
  if (!fechaVencimiento) return false;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return new Date(`${fechaVencimiento}T00:00:00`) < hoy;
};

// Valida el JWT y ademas revisa en la BD que el usuario siga activo,
// que su negocio no este suspendido/vencido y que no se hayan cerrado sus sesiones.
// Rol, empresa y sucursal se toman de la BD: un cambio del admin aplica de inmediato.
export const verificarToken = async (req, res, next) => {
  // Header Authorization (dominios viejos) o cookie httpOnly (dominio propio)
  const token = tokenDeLaPeticion(req);
  if (!token) {
    return responderSesionInvalida(res, "Token requerido");
  }
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return responderSesionInvalida(res, "Tu sesión venció. Vuelve a iniciar sesión.");
  }

  const usuarioId = parseIdPositivo(payload.id);
  if (!usuarioId) return responderSesionInvalida(res, "Token incompleto");

  let estado;
  try {
    estado = await leerEstadoSesion(usuarioId);
  } catch (err) {
    console.error("verificarToken: no se pudo revisar la sesion:", err.message);
    return res.status(503).json({ error: "No se pudo validar tu sesión. Intenta de nuevo." });
  }

  if (!estado) return responderSesionInvalida(res, "Tu usuario ya no existe.");
  if (estado.activo === false) {
    return responderSesionInvalida(res, "Tu cuenta fue desactivada. Contacta al administrador.");
  }
  if (Number(estado.sesion_version) !== Number(payload.sv ?? 0)) {
    return responderSesionInvalida(res, "Se cerró tu sesión. Vuelve a iniciar sesión.");
  }
  const esSuperadmin = estado.es_superadmin === true;
  if (!esSuperadmin) {
    if (!estado.empresa_id) return responderSesionInvalida(res, "Tu usuario no tiene negocio asignado.");
    if (["pendiente", "suspendida", "rechazada", "vencida"].includes(estado.empresa_estado)
        || empresaVencida(estado.fecha_vencimiento)) {
      return responderSesionInvalida(res, "El acceso a este negocio está suspendido. Contacta al soporte.");
    }
  }

  req.usuario = {
    ...payload,
    id: usuarioId,
    rol: parseIdPositivo(estado.rol_id),
    rol_id: parseIdPositivo(estado.rol_id),
    empresa_id: parseIdPositivo(estado.empresa_id),
    sucursal_id: parseIdPositivo(estado.sucursal_id),
    es_superadmin: esSuperadmin
  };
  next();
};

export const verificarAdmin = (req, res, next) => {
  if (req.usuario.rol !== 1) {
    return res.status(403).json({ error: "Se requiere rol ADMINISTRADOR" });
  }
  next();
};

export const verificarSuperAdmin = (req, res, next) => {
  if (!req.usuario.es_superadmin) {
    return res.status(403).json({ error: "Acceso restringido al superadministrador" });
  }
  next();
};

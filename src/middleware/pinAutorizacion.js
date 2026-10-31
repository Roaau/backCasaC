import bcrypt from "bcrypt";
import crypto from "crypto";
import Empresa from "../models/EmpresaModel.js";
import { registrarAuditoria } from "../utils/auditoria.js";

// PIN de autorizacion del dueno.
// Si el admin lo activa en Configuracion, el empleado debe capturar el codigo de 6 digitos
// (header X-Pin-Autorizacion) para tareas importantes. El admin nunca lo necesita.
// Si esta apagado, todo funciona como siempre.

const MAX_INTENTOS = 5;
const MINUTOS_BLOQUEO = 15;
const intentosPorUsuario = new Map(); // usuario_id -> { fallos, bloqueadoHasta }

const CACHE_MS = 30 * 1000;
const cacheEmpresa = new Map(); // empresa_id -> { activo, hash, expira }

export const limpiarCachePin = (empresaId) => {
  if (empresaId == null) cacheEmpresa.clear();
  else cacheEmpresa.delete(Number(empresaId));
};

const leerConfigPin = async (empresaId) => {
  const enCache = cacheEmpresa.get(empresaId);
  if (enCache && enCache.expira > Date.now()) return enCache;
  const empresa = await Empresa.findByPk(empresaId, {
    attributes: ["empresa_id", "pin_autorizacion_activo", "pin_autorizacion_hash"]
  });
  const valor = {
    activo: empresa?.pin_autorizacion_activo === true && !!empresa?.pin_autorizacion_hash,
    hash: empresa?.pin_autorizacion_hash || null,
    expira: Date.now() + CACHE_MS
  };
  cacheEmpresa.set(empresaId, valor);
  return valor;
};

export const generarPin = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");

/**
 * Exige el PIN cuando aplica.
 * @param {string} accion  Texto para la bitacora (ej. "Devolucion").
 * @param {(req) => boolean} [condicion]  Si se da, solo se pide el PIN cuando devuelve true.
 */
export const requierePin = (accion, condicion) => async (req, res, next) => {
  try {
    const usuario = req.usuario;
    if (!usuario || usuario.rol === 1 || usuario.es_superadmin) return next();
    if (condicion && !(await condicion(req))) return next();

    const config = await leerConfigPin(usuario.empresa_id);
    if (!config.activo) return next();

    const estado = intentosPorUsuario.get(usuario.id);
    if (estado?.bloqueadoHasta && estado.bloqueadoHasta > Date.now()) {
      return res.status(429).json({
        error: "Demasiados intentos de PIN. Espera unos minutos o pide al dueño que lo haga.",
        codigo: "PIN_BLOQUEADO"
      });
    }

    const pin = String(req.headers["x-pin-autorizacion"] || "").trim();
    if (!pin) {
      return res.status(403).json({ error: `Se necesita el PIN del dueño para: ${accion}`, codigo: "PIN_REQUERIDO", accion });
    }

    const valido = /^\d{6}$/.test(pin) && await bcrypt.compare(pin, config.hash);
    if (!valido) {
      const fallos = (estado?.fallos || 0) + 1;
      intentosPorUsuario.set(usuario.id, fallos >= MAX_INTENTOS
        ? { fallos: 0, bloqueadoHasta: Date.now() + MINUTOS_BLOQUEO * 60000 }
        : { fallos, bloqueadoHasta: null });
      return res.status(403).json({ error: "PIN incorrecto", codigo: "PIN_INCORRECTO", accion });
    }

    intentosPorUsuario.delete(usuario.id);
    registrarAuditoria(req, {
      accion: "PIN_AUTORIZACION",
      entidad: "autorizacion",
      detalle: { accion, metodo: req.method, ruta: req.originalUrl }
    }).catch(() => {});
    return next();
  } catch (err) {
    console.error("requierePin:", err.message);
    return res.status(500).json({ error: "No se pudo validar el PIN" });
  }
};

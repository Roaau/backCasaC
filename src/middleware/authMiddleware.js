import jwt from "jsonwebtoken";
import { parseIdPositivo } from "../utils/scope.js";

export const verificarToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token requerido" });
  }
  const token = authHeader.slice(7);
  try {
    req.usuario = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario.id = parseIdPositivo(req.usuario.id);
    req.usuario.rol = parseIdPositivo(req.usuario.rol ?? req.usuario.rol_id);
    req.usuario.rol_id = req.usuario.rol;
    req.usuario.empresa_id = parseIdPositivo(req.usuario.empresa_id);
    req.usuario.sucursal_id = parseIdPositivo(req.usuario.sucursal_id);
    req.usuario.es_superadmin = req.usuario.es_superadmin === true;
    if (!req.usuario.id || (!req.usuario.es_superadmin && !req.usuario.empresa_id)) {
      return res.status(401).json({ error: "Token incompleto" });
    }
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido o expirado" });
  }
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

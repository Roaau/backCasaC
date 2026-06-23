import jwt from "jsonwebtoken";

export const verificarToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token requerido" });
  }
  const token = authHeader.slice(7);
  try {
    req.usuario = jwt.verify(token, process.env.JWT_SECRET);
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

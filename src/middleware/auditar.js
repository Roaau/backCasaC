import { registrarAuditoria } from "../utils/auditoria.js";

// Registra en la bitacora una accion cuando la peticion termina bien (status < 400).
// Se usa en las rutas para no tocar la logica de cada controlador.
//   auditar('PRODUCTO_EDITAR', 'productos', { antes: async (req) => ({...}), detalle: (req) => ({...}) })
const CAMPOS_PRIVADOS = ['contrasena', 'password', 'pin', 'token', 'foto_perfil', 'logo_b64', 'logo_empresa', 'imagen'];

const limpiar = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  const copia = Array.isArray(obj) ? obj.slice(0, 50) : { ...obj };
  if (!Array.isArray(copia)) for (const c of CAMPOS_PRIVADOS) delete copia[c];
  return copia;
};

export const auditar = (accion, entidad, opciones = {}) => async (req, res, next) => {
  let antes = null;
  try {
    if (opciones.antes) antes = await opciones.antes(req);
  } catch {
    antes = null;
  }
  res.on('finish', () => {
    if (res.statusCode >= 400) return;
    let detalle;
    try {
      detalle = opciones.detalle ? opciones.detalle(req) : limpiar(req.body);
    } catch {
      detalle = null;
    }
    registrarAuditoria(req, {
      accion,
      entidad,
      entidad_id: req.params?.id ?? null,
      detalle: antes ? { antes: limpiar(antes), despues: limpiar(detalle) } : limpiar(detalle)
    }).catch(() => {});
  });
  next();
};

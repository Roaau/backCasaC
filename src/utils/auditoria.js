import Auditoria from "../models/Auditoria.js";

export async function registrarAuditoria(req, { accion, entidad, entidad_id = null, detalle = null, sucursal_id = null, transaction = null }) {
  try {
    if (!accion || !entidad) return;
    await Auditoria.create({
      usuario_id: req?.usuario?.usuario_id || req?.usuario?.id || null,
      empresa_id: req?.usuario?.empresa_id || null,
      sucursal_id: sucursal_id ?? req?.usuario?.sucursal_id ?? null,
      accion,
      entidad,
      entidad_id: entidad_id != null ? String(entidad_id) : null,
      detalle,
      ip: req?.ip || req?.headers?.['x-forwarded-for'] || null,
      user_agent: req?.headers?.['user-agent'] || null,
      fecha: new Date()
    }, { transaction });
  } catch (err) {
    console.error('No se pudo registrar auditoria:', err.message);
  }
}

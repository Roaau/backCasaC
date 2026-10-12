import { Op, QueryTypes } from 'sequelize';
import sequelize from '../config/database.js';
import Notificacion from '../models/Notificacion.js';
import Sucursal from '../models/SucursalModel.js';
import { esAdminEmpresa, resolverScopeSucursales, responderErrorScope } from '../utils/scope.js';
import { registrarAuditoria } from '../utils/auditoria.js';
import { fechaLocalISO } from '../utils/fechas.js';

const severidadStock = (actual, minimo) => {
  const min = Number(minimo) || 5;
  const ratio = min > 0 ? Number(actual || 0) / min : 1;
  if (ratio <= 0.3) return 'critica';
  if (ratio <= 0.7) return 'alta';
  return 'media';
};

async function upsertNotificacion(data) {
  const existente = await Notificacion.findOne({
    where: {
      empresa_id: data.empresa_id,
      sucursal_id: data.sucursal_id,
      tipo: data.tipo,
      entidad: data.entidad,
      entidad_id: data.entidad_id,
      estado: { [Op.in]: ['nueva', 'vista'] }
    }
  });
  if (existente) {
    await existente.update({
      severidad: data.severidad,
      titulo: data.titulo,
      mensaje: data.mensaje,
      detalle: data.detalle,
      sucursal_id: data.sucursal_id,
      creada_en: new Date()
    });
    return existente;
  }
  return Notificacion.create(data);
}

// El admin recibe los avisos de stock bajo de todas sus sucursales, aunque tenga seleccionada solo una.
// Los empleados (y el admin en 'todas') se quedan con su alcance normal.
export async function scopeConStockDeTodas(req, scope) {
  if (scope.todas || !esAdminEmpresa(req.usuario)) return scope;
  const sucursales = await Sucursal.findAll({ where: { empresa_id: scope.empresa_id, activa: true }, attributes: ['sucursal_id'] });
  return { ...scope, sucursalesStock: sucursales.map(s => s.sucursal_id) };
}

// Filtro de notificaciones visibles para el alcance
export function whereVisibles(scope) {
  const base = scope.todas ? { [Op.in]: scope.sucursalIds } : scope.sucursal_id;
  if (!scope.sucursalesStock?.length) return { sucursal_id: base };
  return {
    [Op.or]: [
      { sucursal_id: base },
      { tipo: 'stock_bajo', sucursal_id: { [Op.in]: scope.sucursalesStock } }
    ]
  };
}

export async function generarNotificacionesEmpresa(req, scope) {
  const empresaId = scope.empresa_id;
  const sucursalIds = scope.sucursalIds?.length ? scope.sucursalIds : [scope.sucursal_id].filter(Boolean);
  if (!empresaId || sucursalIds.length === 0) return;
  const stockIds = scope.sucursalesStock?.length ? scope.sucursalesStock : sucursalIds;

  const stockRows = await sequelize.query(`
    SELECT p.producto_id, p.nombre, COALESCE(ss.stock_actual, p.stock_actual, 0) AS stock_actual,
           COALESCE(ss.stock_minimo, p.stock_minimo, 5) AS stock_minimo,
           s.sucursal_id, s.nombre AS sucursal
    FROM productos p
    JOIN stock_sucursal ss ON ss.producto_id = p.producto_id
    JOIN sucursales s ON s.sucursal_id = ss.sucursal_id
    WHERE p.empresa_id = :empresa_id
      AND p.activo = true
      AND s.sucursal_id IN (:sucursalIds)
      AND COALESCE(ss.stock_actual, p.stock_actual, 0) <= COALESCE(NULLIF(ss.stock_minimo, 0), NULLIF(p.stock_minimo, 0), 5)
    ORDER BY COALESCE(ss.stock_actual, p.stock_actual, 0) ASC
    LIMIT 40
  `, { replacements: { empresa_id: empresaId, sucursalIds: stockIds }, type: QueryTypes.SELECT });

  for (const p of stockRows) {
    const severidad = severidadStock(p.stock_actual, p.stock_minimo);
    await upsertNotificacion({
      empresa_id: empresaId,
      sucursal_id: p.sucursal_id,
      tipo: 'stock_bajo',
      severidad,
      titulo: severidad === 'critica' ? 'Stock critico' : 'Stock bajo',
      mensaje: `${p.nombre} tiene ${Number(p.stock_actual)} en existencia en ${p.sucursal}. Minimo: ${Number(p.stock_minimo)}.`,
      entidad: 'producto',
      entidad_id: String(p.producto_id),
      detalle: { producto: p.nombre, stock_actual: Number(p.stock_actual), stock_minimo: Number(p.stock_minimo), sucursal: p.sucursal }
    });
  }

  // Caducidades (farmacia, abarrotes, cosmeticos...): caducados o que caducan en 30 dias con existencia
  const hoy = fechaLocalISO();
  const caducidadRows = await sequelize.query(`
    SELECT p.producto_id, p.nombre, p.lote, p.fecha_caducidad,
           ss.stock_actual, s.sucursal_id, s.nombre AS sucursal
    FROM productos p
    JOIN stock_sucursal ss ON ss.producto_id = p.producto_id
    JOIN sucursales s ON s.sucursal_id = ss.sucursal_id
    WHERE p.empresa_id = :empresa_id
      AND p.activo = true
      AND s.sucursal_id IN (:sucursalIds)
      AND p.fecha_caducidad IS NOT NULL
      AND p.fecha_caducidad <= (CAST(:hoy AS date) + INTERVAL '30 days')
      AND COALESCE(ss.stock_actual, 0) > 0
    ORDER BY p.fecha_caducidad ASC
    LIMIT 40
  `, { replacements: { empresa_id: empresaId, sucursalIds, hoy }, type: QueryTypes.SELECT });

  for (const p of caducidadRows) {
    const fecha = typeof p.fecha_caducidad === 'string' ? p.fecha_caducidad : fechaLocalISO(p.fecha_caducidad);
    const caducado = fecha < hoy;
    await upsertNotificacion({
      empresa_id: empresaId,
      sucursal_id: p.sucursal_id,
      tipo: caducado ? 'producto_caducado' : 'por_caducar',
      severidad: caducado ? 'critica' : 'alta',
      titulo: caducado ? 'Producto caducado' : 'Producto por caducar',
      mensaje: `${p.nombre}${p.lote ? ` (lote ${p.lote})` : ''} ${caducado ? 'caducó' : 'caduca'} el ${fecha}. Quedan ${Number(p.stock_actual)} en ${p.sucursal}.`,
      entidad: 'producto',
      entidad_id: String(p.producto_id),
      detalle: { producto: p.nombre, lote: p.lote, fecha_caducidad: fecha, stock_actual: Number(p.stock_actual), sucursal: p.sucursal }
    });
  }

  const pedidosRows = await sequelize.query(`
    SELECT v.venta_id, v.folio, v.sucursal_id, s.nombre AS sucursal, v.estado_pedido,
           v.nombre_cliente, v.telefono_cliente, v.direccion_entrega, v.fecha
    FROM ventas v
    JOIN sucursales s ON s.sucursal_id = v.sucursal_id
    WHERE s.empresa_id = :empresa_id
      AND v.sucursal_id IN (:sucursalIds)
      AND v.tipo_venta = 'Pedido'
      AND COALESCE(v.estado_pedido, 'PENDIENTE') IN ('PENDIENTE', 'ENVIADO')
    ORDER BY v.fecha ASC
    LIMIT 40
  `, { replacements: { empresa_id: empresaId, sucursalIds }, type: QueryTypes.SELECT });

  for (const p of pedidosRows) {
    const faltanDatos = !p.nombre_cliente || !p.telefono_cliente || !p.direccion_entrega;
    await upsertNotificacion({
      empresa_id: empresaId,
      sucursal_id: p.sucursal_id,
      tipo: faltanDatos ? 'pedido_incompleto' : 'pedido_pendiente',
      severidad: faltanDatos ? 'alta' : 'media',
      titulo: faltanDatos ? 'Pedido con datos incompletos' : 'Pedido pendiente',
      mensaje: `${p.folio} esta ${p.estado_pedido || 'PENDIENTE'} en ${p.sucursal}.`,
      entidad: 'venta',
      entidad_id: String(p.venta_id),
      detalle: { folio: p.folio, estado: p.estado_pedido || 'PENDIENTE', sucursal: p.sucursal, datos_incompletos: faltanDatos }
    });
  }

  const cajasRows = await sequelize.query(`
    SELECT c.caja_id, c.sucursal_id, s.nombre AS sucursal, c.fecha_apertura
    FROM caja c
    JOIN sucursales s ON s.sucursal_id = c.sucursal_id
    WHERE s.empresa_id = :empresa_id
      AND c.sucursal_id IN (:sucursalIds)
      AND c.fecha_cierre IS NULL
      AND c.fecha_apertura < (NOW() - INTERVAL '18 hours')
  `, { replacements: { empresa_id: empresaId, sucursalIds }, type: QueryTypes.SELECT });

  for (const c of cajasRows) {
    await upsertNotificacion({
      empresa_id: empresaId,
      sucursal_id: c.sucursal_id,
      tipo: 'caja_abierta',
      severidad: 'alta',
      titulo: 'Caja abierta mucho tiempo',
      mensaje: `La caja de ${c.sucursal} sigue abierta desde hace varias horas. Conviene revisar el cierre.`,
      entidad: 'caja',
      entidad_id: String(c.caja_id),
      detalle: { sucursal: c.sucursal, fecha_apertura: c.fecha_apertura }
    });
  }
}

export const listarNotificaciones = async (req, res) => {
  try {
    const scope = await scopeConStockDeTodas(req, await resolverScopeSucursales(req));
    await generarNotificacionesEmpresa(req, scope);
    const estados = String(req.query.estado || 'nueva,vista').split(',').map(e => e.trim()).filter(Boolean);
    const rows = await Notificacion.findAll({
      where: {
        empresa_id: scope.empresa_id,
        ...whereVisibles(scope),
        estado: { [Op.in]: estados }
      },
      order: [
        [sequelize.literal(`CASE severidad WHEN 'critica' THEN 1 WHEN 'alta' THEN 2 WHEN 'media' THEN 3 ELSE 4 END`), 'ASC'],
        ['creada_en', 'DESC']
      ],
      limit: Math.min(Number(req.query.limit) || 80, 150)
    });
    res.json({ datos: rows, resumen: resumen(rows) });
  } catch (err) {
    responderErrorScope(res, err);
  }
};

export const resumenNotificaciones = async (req, res) => {
  try {
    const scope = await scopeConStockDeTodas(req, await resolverScopeSucursales(req));
    await generarNotificacionesEmpresa(req, scope);
    const rows = await Notificacion.findAll({
      where: {
        empresa_id: scope.empresa_id,
        ...whereVisibles(scope),
        estado: { [Op.in]: ['nueva', 'vista'] }
      },
      order: [['creada_en', 'DESC']],
      limit: 30
    });
    res.json({ resumen: resumen(rows), recientes: rows.slice(0, 5) });
  } catch (err) {
    responderErrorScope(res, err);
  }
};

function resumen(rows) {
  return rows.reduce((acc, n) => {
    acc.total += 1;
    acc[n.severidad] = (acc[n.severidad] || 0) + 1;
    acc[n.tipo] = (acc[n.tipo] || 0) + 1;
    return acc;
  }, { total: 0, critica: 0, alta: 0, media: 0, baja: 0 });
}

export const cambiarEstadoNotificacion = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const estado = String(req.body.estado || '').toLowerCase();
    if (!id || !['vista', 'resuelta', 'ignorada', 'nueva'].includes(estado)) {
      return res.status(400).json({ error: 'Estado no valido' });
    }
    const scope = await scopeConStockDeTodas(req, await resolverScopeSucursales(req));
    const notificacion = await Notificacion.findOne({
      where: {
        notificacion_id: id,
        empresa_id: scope.empresa_id,
        ...whereVisibles(scope)
      }
    });
    if (!notificacion) return res.status(404).json({ error: 'Notificacion no encontrada' });

    const update = { estado };
    if (estado === 'vista') update.vista_en = new Date();
    if (estado === 'resuelta' || estado === 'ignorada') update.resuelta_en = new Date();
    await notificacion.update(update);
    await registrarAuditoria(req, {
      accion: 'NOTIFICACION_ESTADO',
      entidad: 'notificaciones',
      entidad_id: id,
      sucursal_id: notificacion.sucursal_id,
      detalle: { estado, tipo: notificacion.tipo, titulo: notificacion.titulo }
    });
    res.json({ mensaje: 'Notificacion actualizada', notificacion });
  } catch (err) {
    responderErrorScope(res, err);
  }
};

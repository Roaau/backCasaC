import sequelize from '../config/database.js';
import { QueryTypes } from 'sequelize';
import { rangoFechasReporte, fechaLocalISO } from '../utils/fechas.js';
import { obtenerEmpresaId, responderErrorScope } from '../utils/scope.js';

// Acciones que ve el dueño en su bitacora (las internas de IA/notificaciones no se muestran)
export const ACCIONES_BITACORA = {
  VENTA_CREAR: 'Venta',
  VENTA_OFFLINE: 'Venta sin internet (subida después)',
  PEDIDO_ESTADO: 'Pedido cambió de estado',
  DEVOLUCION: 'Devolución',
  PRODUCTO_CREAR: 'Producto nuevo',
  PRODUCTO_EDITAR: 'Producto editado',
  PRODUCTO_ELIMINAR: 'Producto eliminado',
  PRODUCTO_IMPORTAR: 'Productos importados',
  INVENTARIO_MOVIMIENTO: 'Ajuste de inventario',
  COMPRA_CREAR: 'Compra',
  PROVEEDOR_CREAR: 'Proveedor nuevo',
  PROVEEDOR_EDITAR: 'Proveedor editado',
  PROVEEDOR_ELIMINAR: 'Proveedor eliminado',
  CAJA_APERTURA: 'Apertura de caja',
  CAJA_MOVIMIENTO: 'Entrada/retiro de efectivo',
  CAJA_CIERRE: 'Corte de caja',
  USUARIO_CREAR: 'Usuario nuevo',
  USUARIO_EDITAR: 'Usuario editado',
  USUARIO_ELIMINAR: 'Usuario eliminado',
  SUCURSAL_ELIMINAR: 'Sucursal eliminada',
  PIN_AUTORIZACION: 'Autorizado con PIN',
  PIN_GENERADO: 'PIN generado',
  PIN_DESACTIVADO: 'PIN desactivado',
  PLAN_SOLICITUD: 'Solicitud de plan'
};

// GET /api/reportes/bitacora?desde=&hasta=&accion=&usuario_id=&sucursal_id=&page=
export const listarBitacora = async (req, res) => {
  try {
    const empresa_id = obtenerEmpresaId(req.usuario);
    const hoy = fechaLocalISO();
    const { inicio, fin } = rangoFechasReporte(req.query.desde || hoy, req.query.hasta || req.query.desde || hoy);
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = 50;

    const filtros = ['a.empresa_id = :empresa_id', 'a.fecha BETWEEN :inicio AND :fin', 'a.accion IN (:acciones)'];
    const replacements = { empresa_id, inicio, fin, limit, offset: (page - 1) * limit, acciones: Object.keys(ACCIONES_BITACORA) };
    if (req.query.accion && ACCIONES_BITACORA[req.query.accion]) {
      filtros.push('a.accion = :accion');
      replacements.accion = req.query.accion;
    }
    if (Number(req.query.usuario_id)) {
      filtros.push('a.usuario_id = :usuario_id');
      replacements.usuario_id = Number(req.query.usuario_id);
    }
    if (Number(req.query.sucursal_id)) {
      filtros.push('a.sucursal_id = :sucursal_id');
      replacements.sucursal_id = Number(req.query.sucursal_id);
    }
    const where = filtros.join(' AND ');

    const [filas, [{ total }]] = await Promise.all([
      sequelize.query(`
        SELECT a.auditoria_id, a.accion, a.entidad, a.entidad_id, a.detalle, a.fecha,
               a.usuario_id, u.nombre AS usuario, a.sucursal_id, s.nombre AS sucursal
          FROM auditoria a
          LEFT JOIN usuarios u ON u.usuario_id = a.usuario_id
          LEFT JOIN sucursales s ON s.sucursal_id = a.sucursal_id
         WHERE ${where}
         ORDER BY a.fecha DESC
         LIMIT :limit OFFSET :offset`, { replacements, type: QueryTypes.SELECT }),
      sequelize.query(`SELECT COUNT(*)::int AS total FROM auditoria a WHERE ${where}`, { replacements, type: QueryTypes.SELECT })
    ]);

    res.json({
      datos: filas.map(f => ({ ...f, accion_texto: ACCIONES_BITACORA[f.accion] || f.accion })),
      total,
      page,
      totalPaginas: Math.max(1, Math.ceil(total / limit)),
      acciones: ACCIONES_BITACORA
    });
  } catch (e) {
    responderErrorScope(res, e);
  }
};

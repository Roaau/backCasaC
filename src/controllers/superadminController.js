import Empresa from "../models/EmpresaModel.js";
import Sucursal from "../models/SucursalModel.js";
import Usuario from "../models/Usuario.js";
import Venta from "../models/Venta.js";
import MovimientoInventario from "../models/MovimientoInventario.js";
import CatalogoMaestro from "../models/CatalogoMaestro.js";
import Auditoria from "../models/Auditoria.js";
import { notificarEmpresaAprobada, notificarEmpresaRechazada } from "../services/emailService.js";
import { Op } from "sequelize";
import sequelize from "../config/database.js";
import multer from "multer";
import XLSX from "xlsx";
import { registrarAuditoria } from "../utils/auditoria.js";

const uploadCatalogo = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } }).single('archivo');

async function auditarSuperadmin(req, accion, empresa, detalle = {}) {
  await registrarAuditoria(req, {
    accion,
    entidad: 'superadmin_empresas',
    entidad_id: empresa?.empresa_id,
    detalle: {
      empresa_id: empresa?.empresa_id,
      razon_social: empresa?.razon_social,
      ...detalle
    }
  });
}

// GET /api/superadmin/empresas
export const listarEmpresas = async (req, res) => {
  try {
    const empresas = await Empresa.findAll({ order: [['empresa_id', 'DESC']] });

    const result = await Promise.all(empresas.map(async (emp) => {
      const [total_sucursales, total_usuarios, actividad] = await Promise.all([
        Sucursal.count({ where: { empresa_id: emp.empresa_id } }),
        Usuario.count({ where: { empresa_id: emp.empresa_id, es_superadmin: false } }),
        sequelize.query(`
          SELECT
            COUNT(v.venta_id)::int AS ventas_30d,
            COALESCE(SUM(v.total), 0)::float AS ingresos_30d,
            MAX(v.fecha) AS ultima_venta
          FROM sucursales s
          LEFT JOIN ventas v ON v.sucursal_id = s.sucursal_id
            AND v.fecha >= NOW() - INTERVAL '30 days'
          WHERE s.empresa_id = :empresa_id
        `, { replacements: { empresa_id: emp.empresa_id }, type: sequelize.QueryTypes.SELECT })
      ]);
      const resumen = actividad?.[0] || {};
      return {
        ...emp.toJSON(),
        total_sucursales,
        total_usuarios,
        ventas_30d: Number(resumen.ventas_30d) || 0,
        ingresos_30d: Number(resumen.ingresos_30d) || 0,
        ultima_venta: resumen.ultima_venta || null
      };
    }));

    res.json(result);
  } catch {
    res.status(500).json({ error: 'Error al listar empresas' });
  }
};

// GET /api/superadmin/empresas/:id/detalle
export const detalleEmpresa = async (req, res) => {
  const { id } = req.params;
  try {
    const empresa = await Empresa.findByPk(id);
    if (!empresa) return res.status(404).json({ error: 'Empresa no encontrada' });

    const sucursales = await Sucursal.findAll({
      where: { empresa_id: id },
      attributes: ['sucursal_id', 'nombre', 'direccion', 'cp_sat', 'activa'],
      order: [['sucursal_id', 'ASC']]
    });

    const usuarios = await Usuario.findAll({
      where: { empresa_id: id, es_superadmin: false },
      attributes: ['usuario_id', 'nombre', 'usuario', 'rol_id', 'sucursal_id', 'activo'],
      order: [['rol_id', 'ASC']]
    });

    const sucursalIds = sucursales.map(s => s.sucursal_id);
    const hace30dias  = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Ventas de los últimos 30 días
    const ventas = sucursalIds.length
      ? await Venta.findAll({
          where: { sucursal_id: { [Op.in]: sucursalIds }, fecha: { [Op.gte]: hace30dias } },
          attributes: ['venta_id', 'folio', 'fecha', 'total', 'tipo_pago', 'sucursal_id'],
          order: [['fecha', 'DESC']],
          limit: 15
        })
      : [];

    // Totales por sucursal (últimos 30 días)
    const totalesPorSucursal = sucursalIds.length
      ? await sequelize.query(`
          SELECT s.nombre AS nombre_sucursal,
                 COUNT(v.venta_id)::int AS conteo,
                 COALESCE(SUM(v.total), 0)::float AS total
          FROM sucursales s
          LEFT JOIN ventas v ON v.sucursal_id = s.sucursal_id
            AND v.fecha >= NOW() - INTERVAL '30 days'
          WHERE s.empresa_id = :empresa_id
          GROUP BY s.sucursal_id, s.nombre
          ORDER BY total DESC
        `, { replacements: { empresa_id: id }, type: sequelize.QueryTypes.SELECT })
      : [];

    // Movimientos recientes
    const movimientos = sucursalIds.length
      ? await MovimientoInventario.findAll({
          where: { sucursal_id: { [Op.in]: sucursalIds } },
          attributes: ['movimiento_id', 'nombre_producto', 'tipo_movimiento', 'cantidad', 'motivo', 'fecha', 'sucursal_id'],
          order: [['fecha', 'DESC']],
          limit: 10
        })
      : [];

    res.json({
      empresa:           empresa.toJSON(),
      sucursales:        sucursales.map(s => s.toJSON()),
      usuarios:          usuarios.map(u => u.toJSON()),
      ventas_recientes:  ventas.map(v => v.toJSON()),
      totales_sucursal:  totalesPorSucursal,
      movimientos:       movimientos.map(m => m.toJSON())
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener detalle', detalle: err.message });
  }
};

// PUT /api/superadmin/empresas/:id/aprobar
export const aprobarEmpresa = async (req, res) => {
  const { id } = req.params;
  const { notas } = req.body;
  try {
    const empresa = await Empresa.findByPk(id);
    if (!empresa) return res.status(404).json({ error: 'Empresa no encontrada' });

    const estadoAnterior = empresa.estado;
    await empresa.update({ estado: 'activa', notas_admin: notas || empresa.notas_admin });
    await auditarSuperadmin(req, 'SUPERADMIN_EMPRESA_APROBAR', empresa, { estado_anterior: estadoAnterior, estado_nuevo: 'activa', notas });

    if (empresa.email_contacto) {
      notificarEmpresaAprobada({
        destinatario: empresa.email_contacto,
        razon_social: empresa.razon_social
      }).catch(() => {});
    }

    res.json({ mensaje: `${empresa.razon_social} aprobada correctamente` });
  } catch {
    res.status(500).json({ error: 'Error al aprobar empresa' });
  }
};

// PUT /api/superadmin/empresas/:id/rechazar
export const rechazarEmpresa = async (req, res) => {
  const { id } = req.params;
  const { notas } = req.body;
  try {
    const empresa = await Empresa.findByPk(id);
    if (!empresa) return res.status(404).json({ error: 'Empresa no encontrada' });

    const estadoAnterior = empresa.estado;
    await empresa.update({ estado: 'rechazada', notas_admin: notas || empresa.notas_admin });
    await auditarSuperadmin(req, 'SUPERADMIN_EMPRESA_RECHAZAR', empresa, { estado_anterior: estadoAnterior, estado_nuevo: 'rechazada', notas });

    if (empresa.email_contacto) {
      notificarEmpresaRechazada({
        destinatario: empresa.email_contacto,
        razon_social: empresa.razon_social,
        motivo: notas || null
      }).catch(() => {});
    }

    res.json({ mensaje: `${empresa.razon_social} rechazada` });
  } catch {
    res.status(500).json({ error: 'Error al rechazar empresa' });
  }
};

// PUT /api/superadmin/empresas/:id/suspender
export const suspenderEmpresa = async (req, res) => {
  const { id } = req.params;
  const { notas } = req.body;
  try {
    const empresa = await Empresa.findByPk(id);
    if (!empresa) return res.status(404).json({ error: 'Empresa no encontrada' });

    const estadoAnterior = empresa.estado;
    await empresa.update({ estado: 'suspendida', notas_admin: notas || empresa.notas_admin });
    await auditarSuperadmin(req, 'SUPERADMIN_EMPRESA_SUSPENDER', empresa, { estado_anterior: estadoAnterior, estado_nuevo: 'suspendida', notas });
    res.json({ mensaje: `${empresa.razon_social} suspendida` });
  } catch {
    res.status(500).json({ error: 'Error al suspender empresa' });
  }
};

// PUT /api/superadmin/empresas/:id/reactivar
export const reactivarEmpresa = async (req, res) => {
  const { id } = req.params;
  try {
    const empresa = await Empresa.findByPk(id);
    if (!empresa) return res.status(404).json({ error: 'Empresa no encontrada' });

    const estadoAnterior = empresa.estado;
    await empresa.update({ estado: 'activa' });
    await auditarSuperadmin(req, 'SUPERADMIN_EMPRESA_REACTIVAR', empresa, { estado_anterior: estadoAnterior, estado_nuevo: 'activa' });

    if (empresa.email_contacto) {
      notificarEmpresaAprobada({
        destinatario: empresa.email_contacto,
        razon_social: empresa.razon_social
      }).catch(() => {});
    }

    res.json({ mensaje: `${empresa.razon_social} reactivada` });
  } catch {
    res.status(500).json({ error: 'Error al reactivar empresa' });
  }
};

// PUT /api/superadmin/sucursales/:id/toggle
export const toggleSucursal = async (req, res) => {
  const { id } = req.params;
  try {
    const sucursal = await Sucursal.findByPk(id);
    if (!sucursal) return res.status(404).json({ error: 'Sucursal no encontrada' });
    const activaAnterior = sucursal.activa;
    await sucursal.update({ activa: !sucursal.activa });
    await registrarAuditoria(req, {
      accion: 'SUPERADMIN_SUCURSAL_TOGGLE',
      entidad: 'sucursales',
      entidad_id: sucursal.sucursal_id,
      sucursal_id: sucursal.sucursal_id,
      detalle: { empresa_id: sucursal.empresa_id, nombre: sucursal.nombre, activa_anterior: activaAnterior, activa_nueva: sucursal.activa }
    });
    res.json({ mensaje: `Sucursal ${sucursal.activa ? 'activada' : 'desactivada'}`, activa: sucursal.activa });
  } catch {
    res.status(500).json({ error: 'Error al actualizar sucursal' });
  }
};

// PUT /api/superadmin/usuarios/:id/toggle
export const toggleUsuario = async (req, res) => {
  const { id } = req.params;
  try {
    const usuario = await Usuario.findByPk(id);
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (usuario.es_superadmin) return res.status(403).json({ error: 'No se puede desactivar al superadmin' });
    const activoAnterior = usuario.activo;
    await usuario.update({ activo: !usuario.activo });
    await registrarAuditoria(req, {
      accion: 'SUPERADMIN_USUARIO_TOGGLE',
      entidad: 'usuarios',
      entidad_id: usuario.usuario_id,
      detalle: { empresa_id: usuario.empresa_id, usuario: usuario.usuario, activo_anterior: activoAnterior, activo_nuevo: usuario.activo }
    });
    res.json({ mensaje: `Usuario ${usuario.activo ? 'activado' : 'desactivado'}`, activo: usuario.activo });
  } catch {
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
};

// PUT /api/superadmin/empresas/:id/notas
export const actualizarNotas = async (req, res) => {
  const { id } = req.params;
  const { notas } = req.body;
  try {
    const empresa = await Empresa.findByPk(id);
    if (!empresa) return res.status(404).json({ error: 'Empresa no encontrada' });
    const notasAnteriores = empresa.notas_admin;
    await empresa.update({ notas_admin: notas });
    await auditarSuperadmin(req, 'SUPERADMIN_EMPRESA_NOTAS', empresa, { notas_anteriores: notasAnteriores, notas_nuevas: notas });
    res.json({ mensaje: 'Notas actualizadas' });
  } catch {
    res.status(500).json({ error: 'Error al actualizar notas' });
  }
};

// GET /api/superadmin/auditoria
export const listarAuditoriaSuperadmin = async (req, res) => {
  try {
    const empresaId = Number(req.query.empresa_id);
    const limit = Math.min(Math.max(Number(req.query.limit) || 40, 1), 100);
    const where = {};

    if (Number.isInteger(empresaId) && empresaId > 0) {
      where[Op.or] = [
        { empresa_id: empresaId },
        { detalle: { [Op.contains]: { empresa_id: empresaId } } }
      ];
    }

    if (req.query.accion) {
      where.accion = String(req.query.accion).trim();
    }

    const registros = await Auditoria.findAll({
      where,
      attributes: ['auditoria_id', 'usuario_id', 'empresa_id', 'sucursal_id', 'accion', 'entidad', 'entidad_id', 'detalle', 'ip', 'fecha'],
      order: [['fecha', 'DESC']],
      limit
    });

    res.json(registros.map(a => a.toJSON()));
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener auditoria', detalle: err.message });
  }
};

// PUT /api/superadmin/empresas/:id/comercial
export const actualizarComercial = async (req, res) => {
  const { id } = req.params;
  const {
    plan,
    precio_mensual,
    fecha_vencimiento,
    limite_sucursales,
    limite_usuarios,
    estado,
    notas
  } = req.body;
  try {
    const empresa = await Empresa.findByPk(id);
    if (!empresa) return res.status(404).json({ error: 'Empresa no encontrada' });
    const anterior = {
      plan: empresa.plan,
      precio_mensual: Number(empresa.precio_mensual || 0),
      fecha_vencimiento: empresa.fecha_vencimiento,
      limite_sucursales: empresa.limite_sucursales,
      limite_usuarios: empresa.limite_usuarios,
      estado: empresa.estado,
      notas_admin: empresa.notas_admin
    };

    const planesValidos = ['basico', 'pro', 'premium', 'personalizado'];
    const estadosValidos = ['prueba', 'pendiente', 'activa', 'vencida', 'suspendida', 'rechazada'];
    const update = {};

    if (plan !== undefined) {
      const planNormalizado = String(plan).toLowerCase().trim();
      if (!planesValidos.includes(planNormalizado)) {
        return res.status(400).json({ error: 'Plan no valido' });
      }
      update.plan = planNormalizado;
    }

    if (estado !== undefined) {
      const estadoNormalizado = String(estado).toLowerCase().trim();
      if (!estadosValidos.includes(estadoNormalizado)) {
        return res.status(400).json({ error: 'Estado no valido' });
      }
      update.estado = estadoNormalizado;
    }

    if (precio_mensual !== undefined) {
      const precio = Number(precio_mensual);
      if (!Number.isFinite(precio) || precio < 0) return res.status(400).json({ error: 'Precio mensual invalido' });
      update.precio_mensual = precio;
    }

    if (fecha_vencimiento !== undefined) {
      update.fecha_vencimiento = fecha_vencimiento || null;
    }

    if (limite_sucursales !== undefined) {
      const limite = Number(limite_sucursales);
      if (!Number.isInteger(limite) || limite < 1) return res.status(400).json({ error: 'Limite de sucursales invalido' });
      update.limite_sucursales = limite;
    }

    if (limite_usuarios !== undefined) {
      const limite = Number(limite_usuarios);
      if (!Number.isInteger(limite) || limite < 1) return res.status(400).json({ error: 'Limite de usuarios invalido' });
      update.limite_usuarios = limite;
    }

    if (notas !== undefined) update.notas_admin = notas;

    await empresa.update(update);
    await auditarSuperadmin(req, 'SUPERADMIN_EMPRESA_COMERCIAL', empresa, { anterior, nuevo: update });
    res.json({ mensaje: 'Configuracion comercial actualizada', empresa });
  } catch (e) {
    res.status(500).json({ error: 'Error al actualizar configuracion comercial', detalle: e.message });
  }
};

// GET /api/superadmin/catalogo/stats
export const statsCatalogo = async (req, res) => {
  try {
    const total = await CatalogoMaestro.count();
    const cats  = await CatalogoMaestro.count({ distinct: true, col: 'categoria_sugerida' });
    res.json({ total, categorias: cats });
  } catch {
    res.status(500).json({ error: 'Error al obtener stats del catálogo' });
  }
};

// POST /api/superadmin/catalogo/importar  (multipart: archivo .xlsx)
export const importarCatalogo = (req, res) => {
  uploadCatalogo(req, res, async (err) => {
    if (err) return res.status(400).json({ error: 'Error al recibir el archivo' });
    if (!req.file) return res.status(400).json({ error: 'No se envió ningún archivo' });

    try {
      const wb   = XLSX.read(req.file.buffer, { type: 'buffer' });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: null });

      const registros = rows
        .filter(row => row.nombre?.toString().trim())
        .map(row => ({
          codigo_barras:        row.codigo_barras?.toString().trim() || null,
          nombre:               row.nombre.toString().trim(),
          descripcion:          row.descripcion?.toString().trim()   || null,
          categoria_sugerida:   row.categoria?.toString().trim()     || 'Varios',
          precio_menudeo:       Number(row.precio_menudeo)   || 0,
          precio_mayoreo:       Number(row.precio_mayoreo)   || 0,
          precio_oferta:        Number(row.precio_oferta)    || 0,
          stock_minimo:         Number(row.stock_minimo)     || 0,
          minimo_mayoreo:       Number(row.minimo_mayoreo)   || null,
          clave_sat_sugerida:   row.clave_sat?.toString()    || '01010101',
          unidad_sat_sugerida:  row.clave_unidad_sat?.toString() || 'H87',
          objeto_imp:           row.objeto_imp?.toString()   || '02',
        }));

      // Reemplaza todo el catálogo de golpe
      await CatalogoMaestro.destroy({ where: {}, truncate: true });
      await CatalogoMaestro.bulkCreate(registros);

      res.json({ mensaje: 'Catálogo importado', total: registros.length });
    } catch (e) {
      res.status(500).json({ error: 'Error al procesar el Excel', detalle: e.message });
    }
  });
};

// DELETE /api/superadmin/catalogo/limpiar
export const limpiarCatalogo = async (req, res) => {
  try {
    await CatalogoMaestro.destroy({ where: {}, truncate: true });
    res.json({ mensaje: 'Catálogo limpiado' });
  } catch {
    res.status(500).json({ error: 'Error al limpiar catálogo' });
  }
};

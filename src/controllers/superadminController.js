import Empresa from "../models/EmpresaModel.js";
import Sucursal from "../models/SucursalModel.js";
import Usuario from "../models/Usuario.js";
import Venta from "../models/Venta.js";
import MovimientoInventario from "../models/MovimientoInventario.js";
import CatalogoMaestro from "../models/CatalogoMaestro.js";
import CatalogoGiro from "../models/CatalogoGiro.js";
import Auditoria from "../models/Auditoria.js";
import { notificarEmpresaAprobada, notificarEmpresaRechazada, notificarEmpresaSuspendida } from "../services/emailService.js";
import { Op } from "sequelize";
import sequelize from "../config/database.js";
import multer from "multer";
import { registrarAuditoria } from "../utils/auditoria.js";
import { leerFilasInventario } from "../utils/importarExcel.js";
import { normalizarGiro } from "../utils/giros.js";
import { cotizar, sumarAFecha, DIAS_PRUEBA, DIAS_BONO_REFERIDO } from "../utils/planes.js";
import { fechaLocalISO } from "../utils/fechas.js";

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
      const cambioGiro = emp.giro_registro && emp.giro !== emp.giro_registro && emp.plan === 'basico';
      return {
        ...emp.toJSON(),
        cambio_giro: !!cambioGiro,
        precio_sugerido: cambioGiro
          ? cotizar({ plan: 'basico', giro: emp.giro, segunda_sucursal: Number(emp.limite_sucursales) > 1 }).precio_mensual
          : null,
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
    const update = { estado: 'activa', notas_admin: notas || empresa.notas_admin };
    let bono = null;
    // Prueba gratis: corre desde hoy si la empresa todavia no tiene vencimiento
    if (!empresa.fecha_vencimiento) {
      update.fecha_vencimiento = sumarAFecha(fechaLocalISO(), { dias: DIAS_PRUEBA });
    }
    // Recomienda y gana: un mes extra para los dos, una sola vez
    if (empresa.referido_por && !empresa.bono_referido_aplicado) {
      update.fecha_vencimiento = sumarAFecha(update.fecha_vencimiento || empresa.fecha_vencimiento, { dias: DIAS_BONO_REFERIDO });
      update.bono_referido_aplicado = true;
      const quienRecomendo = await Empresa.findByPk(empresa.referido_por);
      if (quienRecomendo) {
        const base = quienRecomendo.fecha_vencimiento && quienRecomendo.fecha_vencimiento > fechaLocalISO()
          ? quienRecomendo.fecha_vencimiento
          : fechaLocalISO();
        await quienRecomendo.update({ fecha_vencimiento: sumarAFecha(base, { dias: DIAS_BONO_REFERIDO }) });
        bono = { empresa_id: quienRecomendo.empresa_id, razon_social: quienRecomendo.razon_social };
      }
    }
    await empresa.update(update);
    await auditarSuperadmin(req, 'SUPERADMIN_EMPRESA_APROBAR', empresa, {
      estado_anterior: estadoAnterior, estado_nuevo: 'activa', notas,
      vence: update.fecha_vencimiento || empresa.fecha_vencimiento, bono_referido: bono
    });

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

    if (empresa.email_contacto) {
      notificarEmpresaSuspendida({
        destinatario: empresa.email_contacto,
        razon_social: empresa.razon_social,
        motivo: notas || null
      }).catch(() => {});
    }

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

    const planesValidos = ['basico', 'pro', 'multisucursal'];
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

    const planFinal = update.plan || empresa.plan || 'basico';
    const precioFinal = update.precio_mensual !== undefined
      ? Number(update.precio_mensual)
      : Number(empresa.precio_mensual || 0);
    const limiteSucursalesFinal = update.limite_sucursales !== undefined
      ? Number(update.limite_sucursales)
      : Number(empresa.limite_sucursales || 1);
    const limiteUsuariosFinal = update.limite_usuarios !== undefined
      ? Number(update.limite_usuarios)
      : Number(empresa.limite_usuarios || 1);

    const cambiaPlanComercial = plan !== undefined ||
      precio_mensual !== undefined ||
      limite_sucursales !== undefined ||
      limite_usuarios !== undefined;

    // Los precios de lista estan en utils/planes.js; aqui el superadmin puede dar descuentos,
    // por eso no hay minimo de precio. Solo se cuida que las sucursales correspondan al plan.
    if (cambiaPlanComercial && planFinal === 'basico' && limiteSucursalesFinal > 2) {
      return res.status(400).json({ error: 'El plan de 1 sucursal permite como maximo 2 sucursales (con la segunda sucursal)' });
    }
    if (cambiaPlanComercial && planFinal === 'pro' && limiteSucursalesFinal > 2) {
      return res.status(400).json({ error: 'El plan Pro permite maximo 2 sucursales' });
    }
    if (cambiaPlanComercial && planFinal === 'multisucursal' && limiteSucursalesFinal < 3) {
      return res.status(400).json({ error: 'El plan Multi-sucursal requiere minimo 3 sucursales' });
    }
    if (req.body.periodo_pago !== undefined) {
      if (!['mensual', 'anual'].includes(req.body.periodo_pago)) return res.status(400).json({ error: 'Periodo de pago invalido' });
      update.periodo_pago = req.body.periodo_pago;
    }
    if (req.body.ia_limite_diario !== undefined) {
      const ia = req.body.ia_limite_diario === null || req.body.ia_limite_diario === '' ? null : Number(req.body.ia_limite_diario);
      if (ia !== null && (!Number.isInteger(ia) || ia < 0 || ia > 500)) return res.status(400).json({ error: 'Limite de IA invalido' });
      update.ia_limite_diario = ia;
    }
    void precioFinal;
    void limiteUsuariosFinal;

    await empresa.update(update);
    await auditarSuperadmin(req, 'SUPERADMIN_EMPRESA_COMERCIAL', empresa, { anterior, nuevo: update });
    res.json({ mensaje: 'Configuracion comercial actualizada', empresa });
  } catch (e) {
    res.status(500).json({ error: 'Error al actualizar configuracion comercial', detalle: e.message });
  }
};

// POST /api/superadmin/empresas/:id/pago  { meses? }  — registra un pago recibido (transferencia)
// Extiende desde el vencimiento actual si aun no vence, o desde hoy si ya vencio. Reactiva si estaba vencida.
export const registrarPago = async (req, res) => {
  try {
    const empresa = await Empresa.findByPk(req.params.id);
    if (!empresa) return res.status(404).json({ error: 'Empresa no encontrada' });
    const meses = req.body?.meses !== undefined
      ? Number(req.body.meses)
      : (empresa.periodo_pago === 'anual' ? 12 : 1);
    if (!Number.isInteger(meses) || meses < 1 || meses > 24) return res.status(400).json({ error: 'Meses invalidos (1 a 24)' });

    const hoy = fechaLocalISO();
    const base = empresa.fecha_vencimiento && empresa.fecha_vencimiento > hoy ? empresa.fecha_vencimiento : hoy;
    const anterior = { fecha_vencimiento: empresa.fecha_vencimiento, estado: empresa.estado };
    const update = { fecha_vencimiento: sumarAFecha(base, { meses }), aviso_vencimiento_enviado: null };
    if (['vencida', 'prueba'].includes(empresa.estado)) update.estado = 'activa';
    await empresa.update(update);
    await auditarSuperadmin(req, 'SUPERADMIN_EMPRESA_PAGO', empresa, { meses, anterior, nuevo: update });
    res.json({ mensaje: `Pago registrado: vence el ${update.fecha_vencimiento}`, fecha_vencimiento: update.fecha_vencimiento });
  } catch (e) {
    res.status(500).json({ error: 'Error al registrar el pago', detalle: e.message });
  }
};

// ── Catalogos base por giro ──────────────────────────────────────────────────

const entero = (n) => (n === null || n === undefined ? null : Math.round(n));

// Fila del lector flexible de Excel (utils/importarExcel.js) -> producto del catalogo base
export const filaACatalogo = (datos, catalogo_giro_id) => ({
  catalogo_giro_id,
  codigo_barras:       datos.codigo_barras ? String(datos.codigo_barras).slice(0, 50) : null,
  nombre:              String(datos.nombre).slice(0, 200),
  descripcion:         datos.descripcion || null,
  categoria_sugerida:  datos.categoria || 'Varios',
  precio_menudeo:      datos.precio_menudeo ?? 0,
  precio_mayoreo:      datos.precio_mayoreo ?? 0,
  precio_oferta:       datos.precio_oferta ?? 0,
  precio_compra:       datos.precio_compra ?? null,
  stock_minimo:        entero(datos.stock_minimo) ?? 0,
  minimo_mayoreo:      entero(datos.minimo_mayoreo),
  unidad_venta:        datos.unidad_venta || 'pieza',
  marca:               datos.marca || null,
  modelo:              datos.modelo || null,
  talla:               datos.talla || null,
  color:               datos.color || null,
  requiere_receta:     datos.requiere_receta === true,
  clave_sat_sugerida:  datos.clave_sat || '01010101',
  unidad_sat_sugerida: datos.clave_unidad_sat || 'H87',
  objeto_imp:          datos.objeto_imp || '02',
});

// GET /api/superadmin/catalogos
export const listarCatalogos = async (req, res) => {
  try {
    const catalogos = await CatalogoGiro.findAll({ order: [['giro', 'ASC'], ['nombre', 'ASC']] });
    res.json(catalogos);
  } catch {
    res.status(500).json({ error: 'Error al listar catálogos' });
  }
};

// POST /api/superadmin/catalogos  (multipart: archivo .xlsx/.xls/.csv, nombre, giro)
// Cada Excel crea un catalogo nuevo; no toca los demas.
export const subirCatalogo = (req, res) => {
  uploadCatalogo(req, res, async (err) => {
    if (err) return res.status(400).json({ error: 'Error al recibir el archivo (maximo 20 MB)' });
    if (!req.file) return res.status(400).json({ error: 'No se envió ningún archivo' });

    const giro   = normalizarGiro(req.body?.giro);
    const nombre = String(req.body?.nombre || '').trim().slice(0, 120)
      || req.file.originalname.replace(/\.[^.]+$/, '').slice(0, 120);

    let filas, reconocidas, ignoradas;
    try {
      ({ filas, reconocidas, ignoradas } = leerFilasInventario(req.file.buffer));
    } catch (e) {
      return res.status(e.status || 400).json({ error: e.status ? e.message : 'No se pudo leer el archivo. Usa Excel (.xlsx, .xls) o CSV.' });
    }

    const validas = filas.filter(f => f.datos.nombre);
    if (validas.length === 0) return res.status(400).json({ error: 'El archivo no tiene productos con nombre debajo de los encabezados' });
    if (validas.length > 50000) return res.status(400).json({ error: 'Maximo 50,000 productos por catálogo. Divide el Excel en partes.' });

    const t = await sequelize.transaction();
    try {
      const catalogo = await CatalogoGiro.create({
        nombre, giro, archivo: req.file.originalname.slice(0, 255), total_productos: validas.length
      }, { transaction: t });

      const registros = validas.map(f => filaACatalogo(f.datos, catalogo.catalogo_giro_id));
      for (let i = 0; i < registros.length; i += 2000) {
        await CatalogoMaestro.bulkCreate(registros.slice(i, i + 2000), { transaction: t });
      }
      await t.commit();

      await registrarAuditoria(req, {
        accion: 'SUPERADMIN_CATALOGO_SUBIR', entidad: 'catalogos_giro', entidad_id: catalogo.catalogo_giro_id,
        detalle: { nombre, giro, archivo: catalogo.archivo, total: validas.length }
      });
      res.status(201).json({
        mensaje: 'Catálogo importado', catalogo,
        total: validas.length, omitidas: filas.length - validas.length, reconocidas, ignoradas
      });
    } catch (e) {
      await t.rollback();
      res.status(500).json({ error: 'Error al guardar el catálogo', detalle: e.message });
    }
  });
};

// DELETE /api/superadmin/catalogos/:id  — borra el catalogo y sus productos.
// Los productos que las empresas ya adoptaron son copias y no se tocan.
export const eliminarCatalogo = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const catalogo = await CatalogoGiro.findByPk(req.params.id, { transaction: t });
    if (!catalogo) {
      await t.rollback();
      return res.status(404).json({ error: 'Catálogo no encontrado' });
    }
    const borrados = await CatalogoMaestro.destroy({ where: { catalogo_giro_id: catalogo.catalogo_giro_id }, transaction: t });
    await catalogo.destroy({ transaction: t });
    await t.commit();

    await registrarAuditoria(req, {
      accion: 'SUPERADMIN_CATALOGO_ELIMINAR', entidad: 'catalogos_giro', entidad_id: catalogo.catalogo_giro_id,
      detalle: { nombre: catalogo.nombre, giro: catalogo.giro, productos: borrados }
    });
    res.json({ mensaje: 'Catálogo eliminado', productos: borrados });
  } catch (e) {
    await t.rollback();
    res.status(500).json({ error: 'Error al eliminar catálogo', detalle: e.message });
  }
};

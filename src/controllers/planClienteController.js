import Empresa from "../models/EmpresaModel.js";
import Usuario from "../models/Usuario.js";
import Sucursal from "../models/SucursalModel.js";
import SolicitudPlan from "../models/SolicitudPlan.js";
import PagoEmpresa from "../models/PagoEmpresa.js";
import { datosDePago } from "../models/PlataformaConfig.js";
import { obtenerEmpresaId, responderErrorScope } from "../utils/scope.js";
import { cotizar, EXTRAS, NIVELES, MESES_GRATIS_ANUAL, DIAS_BONO_REFERIDO } from "../utils/planes.js";
import { registrarAuditoria } from "../utils/auditoria.js";
import { notificarNuevaSolicitudPlan } from "../services/emailService.js";

const ORDEN_PLAN = { basico: 1, pro: 2, multisucursal: 3 };
const nombrePlan = (empresa) =>
  empresa.plan === "pro" ? "Pro"
    : empresa.plan === "multisucursal" ? "Multi"
      : (NIVELES[empresa.nivel]?.nombre || "Básico");

// Lo que paga por periodo: anual = 10 meses (2 gratis)
export const montoPorPeriodo = (precioMensual, periodo) =>
  Number(precioMensual || 0) * (periodo === "anual" ? 12 - MESES_GRATIS_ANUAL : 1);

const errorSolicitud = (mensaje, status = 400) => Object.assign(new Error(mensaje), { status });

/**
 * Calcula como quedaria el plan con lo que pide el admin. Lo usan la vista previa y la solicitud,
 * asi el cliente ve exactamente lo que se aprobara. Nunca toma precios del navegador.
 */
export function calcularSolicitud(empresa, { tipo, cantidad, plan, sucursales } = {}) {
  const actual = {
    plan: empresa.plan || "basico",
    periodo: empresa.periodo_pago || "mensual",
    sucursales: Number(empresa.limite_sucursales) || 1,
    usuarios: Number(empresa.limite_usuarios) || 1,
    extras: Number(empresa.usuarios_extra) || 0,
    precio: Number(empresa.precio_mensual) || 0,
  };
  const base = {
    tipo,
    plan_nuevo: actual.plan,
    periodo_nuevo: actual.periodo,
    limite_sucursales_nuevo: actual.sucursales,
    limite_usuarios_nuevo: actual.usuarios,
    usuarios_extra_nuevo: actual.extras,
    precio_actual: actual.precio,
  };

  if (tipo === "usuarios_extra") {
    const n = Math.trunc(Number(cantidad));
    if (!Number.isInteger(n) || n < 1) throw errorSolicitud("Indica cuántos usuarios extra necesitas");
    if (actual.extras + n > EXTRAS.max_usuarios_extra) {
      throw errorSolicitud(`Tu plan admite hasta ${EXTRAS.max_usuarios_extra} usuarios extra. Para más, cambia de plan.`);
    }
    return {
      ...base,
      descripcion: `Agregar ${n} usuario${n === 1 ? "" : "s"} extra`,
      limite_usuarios_nuevo: actual.usuarios + n,
      usuarios_extra_nuevo: actual.extras + n,
      precio_nuevo: actual.precio + n * EXTRAS.usuario,
    };
  }

  if (tipo === "cambio_plan") {
    if (!["pro", "multisucursal"].includes(plan)) throw errorSolicitud("Plan no válido");
    const cot = cotizar({ plan, giro: empresa.giro, sucursales, usuarios_extra: actual.extras });
    const subeDePlan = ORDEN_PLAN[plan] > ORDEN_PLAN[actual.plan];
    // Dentro del mismo plan solo Multi puede crecer (mas sucursales)
    const masSucursales = plan === "multisucursal" && actual.plan === "multisucursal" && cot.limite_sucursales > actual.sucursales;
    if (!subeDePlan && !masSucursales) throw errorSolicitud("Ese cambio no aumenta tu plan actual");
    return {
      ...base,
      descripcion: plan === "pro"
        ? `Cambiar a Pro (${cot.limite_sucursales} sucursales)`
        : `Cambiar a Multi (${cot.limite_sucursales} sucursales)`,
      plan_nuevo: plan,
      limite_sucursales_nuevo: cot.limite_sucursales,
      limite_usuarios_nuevo: cot.limite_usuarios,
      precio_nuevo: cot.precio_mensual,
    };
  }

  if (tipo === "periodo") {
    if (actual.periodo === "anual") throw errorSolicitud("Ya pagas de forma anual");
    return {
      ...base,
      descripcion: `Cambiar a pago anual (${MESES_GRATIS_ANUAL} meses gratis)`,
      periodo_nuevo: "anual",
      precio_nuevo: actual.precio,
    };
  }

  throw errorSolicitud("Tipo de solicitud no válido");
}

const solicitudPublica = (s) => ({
  solicitud_id: s.solicitud_id,
  tipo: s.tipo,
  descripcion: s.descripcion,
  precio_actual: Number(s.precio_actual),
  precio_nuevo: Number(s.precio_nuevo),
  estado: s.estado,
  motivo: s.motivo,
  creada_en: s.creada_en,
  resuelta_en: s.resuelta_en,
});

// GET /api/empresas/mi-plan/detalle (admin) — todo lo de la seccion "Tu plan"
export const getTuPlan = async (req, res) => {
  try {
    const empresa_id = obtenerEmpresaId(req.usuario);
    const empresa = await Empresa.findByPk(empresa_id);
    if (!empresa) return res.status(404).json({ error: "Empresa no encontrada" });

    const [usuariosActivos, sucursalesActivas, ultimoPago, solicitudes, referidos, datosPago] = await Promise.all([
      Usuario.count({ where: { empresa_id, activo: true, es_superadmin: false } }),
      Sucursal.count({ where: { empresa_id, activa: true } }),
      PagoEmpresa.findOne({ where: { empresa_id }, order: [["fecha", "DESC"]] }),
      SolicitudPlan.findAll({ where: { empresa_id }, order: [["creada_en", "DESC"]], limit: 5 }),
      Empresa.count({ where: { referido_por: empresa_id, bono_referido_aplicado: true } }),
      datosDePago(),
    ]);

    res.json({
      nombre_plan: nombrePlan(empresa),
      plan: empresa.plan,
      nivel: empresa.nivel,
      giro: empresa.giro,
      estado: empresa.estado,
      periodo_pago: empresa.periodo_pago,
      precio_mensual: Number(empresa.precio_mensual) || 0,
      monto_a_pagar: montoPorPeriodo(empresa.precio_mensual, empresa.periodo_pago),
      fecha_vencimiento: empresa.fecha_vencimiento,
      uso: {
        usuarios: usuariosActivos,
        limite_usuarios: empresa.limite_usuarios,
        sucursales: sucursalesActivas,
        limite_sucursales: empresa.limite_sucursales,
        usuarios_extra: empresa.usuarios_extra || 0,
      },
      ultimo_pago: ultimoPago ? { fecha: ultimoPago.fecha, monto: Number(ultimoPago.monto), meses: ultimoPago.meses } : null,
      solicitudes: solicitudes.map(solicitudPublica),
      referidos: {
        codigo: empresa.codigo_referido,
        total: referidos,
        dias_ganados: referidos * DIAS_BONO_REFERIDO,
      },
      datos_pago: datosPago,
      precios: { usuario_extra: EXTRAS.usuario, max_usuarios_extra: EXTRAS.max_usuarios_extra },
    });
  } catch (e) {
    responderErrorScope(res, e);
  }
};

// POST /api/empresas/mi-plan/cotizar — vista previa de una solicitud (no guarda nada)
export const cotizarSolicitud = async (req, res) => {
  try {
    const empresa = await Empresa.findByPk(obtenerEmpresaId(req.usuario));
    if (!empresa) return res.status(404).json({ error: "Empresa no encontrada" });
    const calc = calcularSolicitud(empresa, req.body || {});
    res.json({ ...calc, monto_a_pagar: montoPorPeriodo(calc.precio_nuevo, calc.periodo_nuevo) });
  } catch (e) {
    responderErrorScope(res, e);
  }
};

// POST /api/empresas/mi-plan/solicitudes — el admin pide el cambio; lo aprueba el superadmin al recibir el pago
export const crearSolicitud = async (req, res) => {
  try {
    const empresa_id = obtenerEmpresaId(req.usuario);
    const empresa = await Empresa.findByPk(empresa_id);
    if (!empresa) return res.status(404).json({ error: "Empresa no encontrada" });

    const pendiente = await SolicitudPlan.findOne({ where: { empresa_id, estado: "pendiente" } });
    if (pendiente) {
      return res.status(409).json({ error: `Ya tienes una solicitud en revisión: "${pendiente.descripcion}". Espera a que la revisemos.` });
    }

    const calc = calcularSolicitud(empresa, req.body || {});
    const solicitud = await SolicitudPlan.create({ ...calc, empresa_id, solicitado_por: req.usuario.id });

    await registrarAuditoria(req, {
      accion: "PLAN_SOLICITUD", entidad: "solicitudes_plan", entidad_id: solicitud.solicitud_id,
      detalle: { descripcion: calc.descripcion, precio_actual: calc.precio_actual, precio_nuevo: calc.precio_nuevo }
    });
    notificarNuevaSolicitudPlan({
      razon_social: empresa.razon_social,
      descripcion: calc.descripcion,
      precio_actual: calc.precio_actual,
      precio_nuevo: calc.precio_nuevo,
    }).catch(() => {});

    res.status(201).json({ mensaje: "Solicitud enviada. Te avisaremos cuando quede aplicada.", solicitud: solicitudPublica(solicitud) });
  } catch (e) {
    responderErrorScope(res, e);
  }
};


import sequelize from '../config/database.js';
import { QueryTypes } from 'sequelize';
import Caja from '../models/CajaModel.js';
import MovimientoCaja from '../models/MovimientoCaja.js';
import { resolverSucursalOperativa, responderErrorScope, validarSucursalEmpresa } from '../utils/scope.js';
import { registrarAuditoria } from '../utils/auditoria.js';
import { esMismoDiaLocal } from '../utils/fechas.js';

const esCajaDeHoy = (caja) => esMismoDiaLocal(caja.fecha_apertura);
async function calcularTotalesCaja(caja) {
  const cajaId = Number(caja.caja_id);
  const montoInicial = parseFloat(caja.monto_inicial) || 0;

  // Una caja cerrada solo cuenta las ventas hasta su cierre
  const limiteCierre = caja.fecha_cierre ? 'AND fecha <= :fechaCierre' : '';
  const ventasRaw = await sequelize.query(
    `SELECT COALESCE(SUM(total), 0) as total
     FROM "ventas"
     WHERE fecha >= :fechaInicio
       ${limiteCierre}
       AND sucursal_id = :sucursal_id
       AND COALESCE(tipo_pago, 'efectivo') = 'efectivo'`,
    { replacements: { fechaInicio: caja.fecha_apertura, fechaCierre: caja.fecha_cierre, sucursal_id: caja.sucursal_id }, type: QueryTypes.SELECT }
  );
  const totalVentas = parseFloat(ventasRaw[0]?.total) || 0;

  const ingresosMov     = await MovimientoCaja.sum('monto', { where: { caja_id: cajaId, tipo_movimiento: 'INGRESO'    } }) || 0;
  const egresosMov      = await MovimientoCaja.sum('monto', { where: { caja_id: cajaId, tipo_movimiento: 'EGRESO'     } }) || 0;
  const devolucionesMov = await MovimientoCaja.sum('monto', { where: { caja_id: cajaId, tipo_movimiento: 'DEVOLUCION' } }) || 0;
  const totalSalidas    = Number(egresosMov) + Number(devolucionesMov);
  const montoEsperado   = montoInicial + Number(totalVentas) + Number(ingresosMov) - totalSalidas;

  return { caja_id: cajaId, montoInicial, totalVentas, totalIngresos: Number(ingresosMov), totalEgresos: totalSalidas, montoEsperado, fecha_apertura: caja.fecha_apertura };
}

export const estadoCaja = async (req, res) => {
  try {
    const sucursal_id = await resolverSucursalOperativa(req);
    const cajaAbierta = await Caja.findOne({
      where: { fecha_cierre: null, sucursal_id },
      order: [['fecha_apertura', 'DESC']]
    });

    if (!cajaAbierta) return res.json({ abierta: false });

    const pendienteCierre = !esCajaDeHoy(cajaAbierta);
    return res.json({
      abierta: true,
      pendiente_cierre: pendienteCierre,
      requiere_cierre: pendienteCierre,
      mensaje: pendienteCierre ? 'Hay una caja abierta de un dia anterior. Debe cerrarse antes de vender.' : undefined,
      datos: cajaAbierta
    });
  } catch (err) {
    return responderErrorScope(res, err);
  }
};

export const abrirCaja = async (req, res) => {
  try {
    const { monto } = req.body;
    const usuario_id = req.usuario.id;
    const sucursal_id = await resolverSucursalOperativa(req);

    const montoNum = Number(monto);
    if (monto === undefined || monto === null || !Number.isFinite(montoNum) || montoNum < 0) {
      return res.status(400).json({ error: 'Ingresa un monto inicial valido' });
    }

    const cajaAbierta = await Caja.findOne({ where: { fecha_cierre: null, sucursal_id } });
    if (cajaAbierta) {
      if (esCajaDeHoy(cajaAbierta)) {
        return res.status(400).json({ error: 'Ya existe una caja abierta hoy.' });
      }
      return res.status(409).json({
        error: 'Hay una caja abierta de un dia anterior. Cierrala en Corte de caja antes de abrir otra.',
        requiere_cierre: true,
        caja: cajaAbierta
      });
    }

    const nuevaCaja = await Caja.create({
      usuario_apertura_id: usuario_id,
      sucursal_id,
      monto_inicial: montoNum,
      fecha_apertura: new Date()
    });
    res.status(201).json({ message: "Caja abierta", caja: nuevaCaja });
  } catch (error) {
    responderErrorScope(res, error);
  }
};

export const obtenerTotalesCaja = async (req, res) => {
  try {
    const cajaId = Number(req.params.cajaId);
    if (!cajaId) return res.status(400).json({ error: 'cajaId requerido' });

    const caja = await Caja.findByPk(cajaId);
    if (!caja) return res.status(404).json({ error: 'Caja no encontrada' });
    await validarSucursalEmpresa(req.usuario, caja.sucursal_id);

    return res.json(await calcularTotalesCaja(caja));
  } catch (err) {
    return responderErrorScope(res, err);
  }
};

export const registrarMovimiento = async (req, res) => {
  try {
    const { caja_id, tipo_movimiento, monto, concepto } = req.body;
    const usuario_id = req.usuario.id;
    const sucursal_id = await resolverSucursalOperativa(req);
    const caja = await Caja.findOne({ where: { caja_id, fecha_cierre: null, sucursal_id } });
    if (!caja) return res.status(400).json({ error: 'Caja cerrada o no pertenece a esta sucursal' });
    if (!esCajaDeHoy(caja)) return res.status(409).json({ error: 'Esta caja pertenece a un dia anterior. Cierrala antes de registrar movimientos.', requiere_cierre: true });

    const tipo = String(tipo_movimiento || '').toUpperCase();
    const montoNum = Math.abs(Number(monto));
    const conceptoLimpio = String(concepto || '').trim();

    if (!['INGRESO', 'EGRESO'].includes(tipo)) return res.status(400).json({ error: 'Tipo de movimiento no valido' });
    if (!montoNum || montoNum <= 0) return res.status(400).json({ error: 'Ingresa un monto mayor a cero' });
    if (conceptoLimpio.length < 4) return res.status(400).json({ error: 'Agrega un motivo claro para la auditoria' });

    const totales = await calcularTotalesCaja(caja);
    if (tipo === 'EGRESO' && montoNum > totales.montoEsperado) {
      return res.status(400).json({ error: `No hay suficiente efectivo disponible. Disponible: $${totales.montoEsperado.toFixed(2)}` });
    }

    const mov = await MovimientoCaja.create({
      caja_id,
      usuario_id,
      tipo_movimiento: tipo,
      monto: montoNum,
      concepto: conceptoLimpio,
      fecha: new Date()
    });
    await registrarAuditoria(req, {
      accion: "CAJA_MOVIMIENTO",
      entidad: "movimiento_caja",
      entidad_id: mov.movimiento_id,
      sucursal_id,
      detalle: { caja_id, tipo_movimiento: tipo, monto: montoNum, concepto: conceptoLimpio, efectivo_disponible_antes: totales.montoEsperado }
    });
    return res.json({ mensaje: 'Movimiento registrado', movimiento: mov });
  } catch (err) {
    return responderErrorScope(res, err);
  }
};

export const cerrarCaja = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const sanitize = (val) => { const n = parseFloat(val); return isNaN(n) ? 0 : n; };
    const idCaja      = req.body.caja_id     || req.body.cajaId;
    const idUsuario   = req.usuario.id;
    const montoFinalDb = sanitize(req.body.montoFinal ?? req.body.monto_final);
    const motivoCierre = req.body.motivo || req.body.concepto || null;
    const checklist = req.body.checklist || {};
    const checklistCompleto = checklist.efectivo_contado === true
      && checklist.movimientos_revisados === true
      && checklist.facturas_revisadas === true;

    if (!checklistCompleto) {
      const error = new Error('Checklist de cierre incompleto');
      error.status = 400;
      throw error;
    }
    if (!idCaja) {
      const error = new Error('caja_id requerido');
      error.status = 400;
      throw error;
    }

    const caja = await Caja.findByPk(Number(idCaja), { transaction: t, lock: true });
    if (!caja) {
      const error = new Error('Caja no encontrada');
      error.status = 404;
      throw error;
    }
    await validarSucursalEmpresa(req.usuario, caja.sucursal_id);
    if (caja.fecha_cierre) {
      const error = new Error('Esta caja ya fue cerrada');
      error.status = 409;
      throw error;
    }

    // La diferencia se calcula en el servidor, no se confia en la que manda el navegador
    const { montoEsperado } = await calcularTotalesCaja(caja);
    const diferenciaDb = Math.round((montoFinalDb - montoEsperado) * 100) / 100;
    if (Math.abs(diferenciaDb) > 0.009 && !String(motivoCierre || '').trim()) {
      const error = new Error('Agrega una observacion para explicar la diferencia de caja');
      error.status = 400;
      throw error;
    }

    await Caja.update(
      { usuario_cierre_id: Number(idUsuario), monto_final: montoFinalDb, fecha_cierre: new Date() },
      { where: { caja_id: Number(idCaja), sucursal_id: caja.sucursal_id }, transaction: t }
    );

    if (diferenciaDb !== 0) {
      await MovimientoCaja.create({
        caja_id: Number(idCaja), usuario_id: Number(idUsuario),
        tipo_movimiento: diferenciaDb > 0 ? 'SOBRANTE' : 'FALTANTE',
        monto: Math.abs(diferenciaDb),
        concepto: motivoCierre ? `${motivoCierre} (Diferencia: ${diferenciaDb.toFixed(2)})` : `Ajuste cierre. Diferencia: ${diferenciaDb.toFixed(2)}`,
        fecha: new Date()
      }, { transaction: t });
    }

    await registrarAuditoria(req, {
      accion: "CAJA_CIERRE",
      entidad: "caja",
      entidad_id: Number(idCaja),
      sucursal_id: caja.sucursal_id,
      detalle: { monto_final: montoFinalDb, diferencia: diferenciaDb, motivo: motivoCierre, checklist },
      transaction: t
    });

    await t.commit();
    return res.json({ mensaje: 'Caja cerrada correctamente' });
  } catch (err) {
    await t.rollback();
    return responderErrorScope(res, err);
  }
};

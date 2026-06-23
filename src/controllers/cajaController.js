import sequelize from '../config/database.js';
import { QueryTypes, Op } from 'sequelize';
import Caja from '../models/CajaModel.js';
import MovimientoCaja from '../models/MovimientoCaja.js';

export const estadoCaja = async (req, res) => {
  try {
    const sucursal_id = req.query.sucursal_id || req.usuario.sucursal_id || 1;
    const inicioDia = new Date(); inicioDia.setHours(0, 0, 0, 0);
    const finDia    = new Date(); finDia.setHours(23, 59, 59, 999);

    const cajaHoy = await Caja.findOne({
      where: {
        fecha_cierre: null,
        sucursal_id,
        fecha_apertura: { [Op.between]: [inicioDia, finDia] }
      }
    });
    if (cajaHoy) return res.json({ abierta: true, datos: cajaHoy });
    return res.json({ abierta: false });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

export const abrirCaja = async (req, res) => {
  try {
    const { usuario_id, monto } = req.body;
    const sucursal_id = req.body.sucursal_id || req.usuario.sucursal_id || 1;

    if (usuario_id === undefined || monto === undefined) {
      return res.status(400).json({ error: 'Faltan datos requeridos' });
    }

    const cajaAbierta = await Caja.findOne({ where: { fecha_cierre: null, sucursal_id } });
    if (cajaAbierta) {
      const fechaCaja = new Date(cajaAbierta.fecha_apertura).toDateString();
      if (fechaCaja === new Date().toDateString()) {
        return res.status(400).json({ error: 'Ya existe una caja abierta hoy.' });
      }
      await cajaAbierta.update({ fecha_cierre: new Date(), monto_final: 0, usuario_cierre_id: usuario_id });
    }

    const nuevaCaja = await Caja.create({
      usuario_apertura_id: usuario_id,
      sucursal_id,
      monto_inicial: monto,
      fecha_apertura: new Date()
    });
    res.status(201).json({ message: "Caja abierta", caja: nuevaCaja });
  } catch (error) {
    res.status(500).json({ error: "Error al abrir" });
  }
};

export const obtenerTotalesCaja = async (req, res) => {
  try {
    const cajaId = Number(req.params.cajaId);
    if (!cajaId) return res.status(400).json({ error: 'cajaId requerido' });

    const caja = await Caja.findByPk(cajaId);
    if (!caja) return res.status(404).json({ error: 'Caja no encontrada' });

    const montoInicial = parseFloat(caja.monto_inicial) || 0;

    const ventasRaw = await sequelize.query(
      `SELECT COALESCE(SUM(total), 0) as total FROM "ventas" WHERE fecha >= :fechaInicio AND sucursal_id = :sucursal_id`,
      { replacements: { fechaInicio: caja.fecha_apertura, sucursal_id: caja.sucursal_id || 1 }, type: QueryTypes.SELECT }
    );
    const totalVentas = parseFloat(ventasRaw[0].total) || 0;

    const ingresosMov     = await MovimientoCaja.sum('monto', { where: { caja_id: cajaId, tipo_movimiento: 'INGRESO'    } }) || 0;
    const egresosMov      = await MovimientoCaja.sum('monto', { where: { caja_id: cajaId, tipo_movimiento: 'EGRESO'     } }) || 0;
    const devolucionesMov = await MovimientoCaja.sum('monto', { where: { caja_id: cajaId, tipo_movimiento: 'DEVOLUCION' } }) || 0;
    const totalSalidas    = egresosMov + devolucionesMov;

    return res.json({
      caja_id: caja.caja_id, montoInicial, totalVentas,
      totalIngresos: ingresosMov,
      totalEgresos: totalSalidas,
      montoEsperado: montoInicial + totalVentas + ingresosMov - totalSalidas,
      fecha_apertura: caja.fecha_apertura
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

export const registrarMovimiento = async (req, res) => {
  try {
    const { caja_id, usuario_id, tipo_movimiento, monto, concepto } = req.body;
    const sucursal_id = req.usuario.sucursal_id || 1;
    const caja = await Caja.findOne({ where: { caja_id, fecha_cierre: null, sucursal_id } });
    if (!caja) return res.status(400).json({ error: 'Caja cerrada o no pertenece a esta sucursal' });

    const mov = await MovimientoCaja.create({
      caja_id, usuario_id, tipo_movimiento,
      monto: Math.abs(monto), concepto: concepto || '', fecha: new Date()
    });
    return res.json({ mensaje: 'Movimiento registrado', movimiento: mov });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

export const cerrarCaja = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const sanitize = (val) => { const n = parseFloat(val); return isNaN(n) ? 0 : n; };
    const idCaja      = req.body.caja_id     || req.body.cajaId;
    let   idUsuario   = req.body.usuario_cierre_id ?? req.body.usuarioCierreId;
    const montoFinalDb = sanitize(req.body.montoFinal ?? req.body.monto_final);
    const diferenciaDb = sanitize(req.body.diferencia);
    const motivoCierre = req.body.motivo || req.body.concepto || null;

    if (!idCaja || idUsuario === undefined) throw new Error(`Datos faltantes. Caja: ${idCaja}, Usuario: ${idUsuario}`);

    await Caja.update(
      { usuario_cierre_id: Number(idUsuario), monto_final: montoFinalDb, fecha_cierre: new Date() },
      { where: { caja_id: Number(idCaja) }, transaction: t }
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

    await t.commit();
    return res.json({ mensaje: 'Caja cerrada correctamente' });
  } catch (err) {
    await t.rollback();
    return res.status(500).json({ error: err.message });
  }
};

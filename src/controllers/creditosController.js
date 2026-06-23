import sequelize from "../config/database.js";
import Venta from "../models/Venta.js";
import PagoCredito from "../models/PagoCredito.js";
import { Op } from "sequelize";

export const listarCreditos = async (req, res) => {
  try {
    const ventas = await Venta.findAll({
      where: {
        sucursal_id: req.usuario.sucursal_id,
        tipo_pago: 'credito',
        saldo_pendiente: { [Op.gt]: 0 }
      },
      order: [['fecha', 'DESC']]
    });

    const ids = ventas.map(v => v.venta_id);
    const pagos = ids.length
      ? await PagoCredito.findAll({ where: { venta_id: ids }, order: [['fecha', 'ASC']] })
      : [];

    const result = ventas.map(v => ({
      ...v.toJSON(),
      pagos: pagos.filter(p => p.venta_id === v.venta_id)
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener créditos', detalle: err.message });
  }
};

export const listarCreditosSaldados = async (req, res) => {
  try {
    const ventas = await Venta.findAll({
      where: {
        sucursal_id: req.usuario.sucursal_id,
        tipo_pago: 'credito',
        saldo_pendiente: 0
      },
      order: [['fecha', 'DESC']],
      limit: 50
    });
    res.json(ventas);
  } catch {
    res.status(500).json({ error: 'Error al obtener historial' });
  }
};

export const registrarPago = async (req, res) => {
  const { venta_id } = req.params;
  const { monto, notas } = req.body;

  if (!monto || Number(monto) <= 0) {
    return res.status(400).json({ error: 'Monto inválido' });
  }

  const t = await sequelize.transaction();
  try {
    const venta = await Venta.findOne({
      where: { venta_id, sucursal_id: req.usuario.sucursal_id },
      transaction: t
    });

    if (!venta) {
      await t.rollback();
      return res.status(404).json({ error: 'Venta no encontrada' });
    }

    const montoNum   = Number(monto);
    const saldoActual = Number(venta.saldo_pendiente);

    if (montoNum > saldoActual) {
      await t.rollback();
      return res.status(400).json({ error: `El monto supera el saldo pendiente ($${saldoActual.toFixed(2)})` });
    }

    await PagoCredito.create({
      venta_id, monto: montoNum, usuario_id: req.usuario.id, notas: notas || null, fecha: new Date()
    }, { transaction: t });

    const nuevoSaldo = Math.max(0, saldoActual - montoNum);
    await venta.update({ saldo_pendiente: nuevoSaldo }, { transaction: t });

    await t.commit();
    res.json({ mensaje: 'Pago registrado', saldo_pendiente: nuevoSaldo });
  } catch (err) {
    await t.rollback();
    res.status(500).json({ error: 'Error al registrar pago', detalle: err.message });
  }
};

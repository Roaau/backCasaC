import sequelize from '../config/database.js';
import { QueryTypes, Op } from 'sequelize';

// IMPORTS (Asegúrate de que coincidan con tus archivos)
import Caja from '../models/CajaModel.js'; 
import MovimientoCaja from '../models/MovimientoCaja.js';
import Venta from '../models/Venta.js'; 

// ==========================================
// 1. VERIFICAR ESTADO (GET)
// ==========================================
export const estadoCaja = async (req, res) => {
  try {
    const inicioDia = new Date();
    inicioDia.setHours(0, 0, 0, 0);
    const finDia = new Date();
    finDia.setHours(23, 59, 59, 999);

    const cajaHoy = await Caja.findOne({
      where: {
        fecha_cierre: null,
        fecha_apertura: { [Op.between]: [inicioDia, finDia] }
      }
    });
    
    if (cajaHoy) return res.json({ abierta: true, datos: cajaHoy });
    return res.json({ abierta: false });
  } catch (err) {
    console.error(err);
    return res.json({ abierta: false, error: err.message });
  }
};

// ==========================================
// 2. ABRIR CAJA (POST)
// ==========================================
export const abrirCaja = async (req, res) => {
    try {
        const { usuario_id, monto } = req.body;
        // Aceptamos usuario_id 0 si fuera necesario, validamos undefined
        if (usuario_id === undefined || monto === undefined) {
            return res.status(400).json({ error: 'Faltan datos requeridos' });
        }

        const cajaAbierta = await Caja.findOne({ where: { fecha_cierre: null } });
        if (cajaAbierta) {
            // ... lógica de auto-cierre ...
            const fechaCaja = new Date(cajaAbierta.fecha_apertura).toDateString();
            const fechaHoy = new Date().toDateString();

            if (fechaCaja === fechaHoy) {
                return res.status(400).json({ error: 'Ya existe una caja abierta hoy.' });
            } else {
                await cajaAbierta.update({
                    fecha_cierre: new Date(), 
                    monto_final: 0,
                    usuario_cierre_id: usuario_id, 
                });
            }
        }

        const nuevaCaja = await Caja.create({
            usuario_apertura_id: usuario_id,
            monto_inicial: monto,
            fecha_apertura: new Date()
        });
        res.status(201).json({ message: "Caja abierta", caja: nuevaCaja });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al abrir" });
    }
};

// ==========================================
// 3. OBTENER TOTALES (GET) - CORREGIDO CON SQL PURO 🚀
// ==========================================
export const obtenerTotalesCaja = async (req, res) => {
  try {
    const cajaId = Number(req.params.cajaId);
    if (!cajaId) return res.status(400).json({ error: 'cajaId requerido' });

    const caja = await Caja.findByPk(cajaId);
    if (!caja) return res.status(404).json({ error: 'Caja no encontrada' });
    
    const montoInicial = parseFloat(caja.monto_inicial) || 0;
    
    // ⚠️ SOLUCIÓN X2: Usamos SQL directo para sumar solo la tabla Ventas
    // Esto evita que Sequelize haga JOINS raros con DetalleVenta
    const ventasRaw = await sequelize.query(
        `SELECT COALESCE(SUM(total), 0) as total FROM "Ventas" 
         WHERE fecha >= :fechaInicio`,
        { 
            replacements: { fechaInicio: caja.fecha_apertura },
            type: QueryTypes.SELECT 
        }
    );
    // Nota: Si tu tabla en postgres es minúscula ("ventas"), cambia "Ventas" por "ventas" arriba
    
    const totalVentas = parseFloat(ventasRaw[0].total);

    // Sumar Ingresos y Egresos (Movimientos)
    const ingresosMov = await MovimientoCaja.sum('monto', {
        where: { caja_id: cajaId, tipo_movimiento: 'INGRESO' }
    }) || 0;

    const egresosMov = await MovimientoCaja.sum('monto', {
        where: { caja_id: cajaId, tipo_movimiento: 'EGRESO' }
    }) || 0;

    const entradaDineroTotal = totalVentas + ingresosMov; 

    return res.json({
      caja_id: caja.caja_id,
      montoInicial: montoInicial,
      totalVentasEfectivo: entradaDineroTotal, 
      totalEgresos: egresosMov,                
      montoEsperado: montoInicial + entradaDineroTotal - egresosMov,
      fecha_apertura: caja.fecha_apertura
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};

// ==========================================
// 4. REGISTRAR MOVIMIENTO (EGRESO)
// ==========================================
export const registrarMovimiento = async (req, res) => {
  try {
    const { caja_id, usuario_id, tipo_movimiento, monto, concepto } = req.body;
    const caja = await Caja.findOne({ where: { caja_id, fecha_cierre: null } });
    if (!caja) return res.status(400).json({ error: 'Caja cerrada' });

    const mov = await MovimientoCaja.create({
      caja_id, usuario_id, tipo_movimiento,
      monto: Math.abs(monto),
      concepto: concepto || '',
      fecha: new Date()
    });
    return res.json({ mensaje: 'Movimiento registrado', movimiento: mov });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};

// ==========================================
// 5. CERRAR CAJA (POST) - ACEPTA ID 0
// ==========================================
export const cerrarCaja = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    console.log("DATOS RECIBIDOS CIERRE:", req.body);

    const sanitizeMoney = (val) => {
        const num = parseFloat(val);
        return isNaN(num) ? 0 : num;
    };

    // 1. OBTENER VARIABLES
    const idCaja = req.body.caja_id || req.body.cajaId;
    
    // ⚠️ CAMBIO CRÍTICO: Usamos '??' o validación explícita para aceptar el 0
    let idUsuario = req.body.usuario_cierre_id;
    if (idUsuario === undefined) idUsuario = req.body.usuarioCierreId;
    
    const rawMonto = req.body.montoFinal !== undefined ? req.body.montoFinal : req.body.monto_final;
    const montoFinalDb = sanitizeMoney(rawMonto);
    const diferenciaDb = sanitizeMoney(req.body.diferencia);

    // Permitimos idUsuario === 0, solo fallamos si es undefined
    if (!idCaja || idUsuario === undefined) {
        throw new Error(`Datos faltantes. Caja: ${idCaja}, Usuario: ${idUsuario}`);
    }

    // Update Caja
    await Caja.update({ 
        usuario_cierre_id: Number(idUsuario), 
        monto_final: montoFinalDb, 
        fecha_cierre: new Date() 
    }, { where: { caja_id: Number(idCaja) }, transaction: t });

    // Insertar Movimiento
    if (diferenciaDb !== 0) {
        const tipo = diferenciaDb > 0 ? 'SOBRANTE' : 'FALTANTE';
        await MovimientoCaja.create({
            caja_id: Number(idCaja),
            usuario_id: Number(idUsuario),
            tipo_movimiento: tipo,
            monto: Math.abs(diferenciaDb),
            concepto: `Ajuste cierre. Diferencia: ${diferenciaDb.toFixed(2)}`,
            fecha: new Date()
        }, { transaction: t });
    }

    await t.commit();
    return res.json({ mensaje: 'Caja cerrada correctamente' });
  } catch (err) {
    await t.rollback();
    console.error("Error cerrarCaja:", err);
    return res.status(500).json({ error: err.message });
  }
};
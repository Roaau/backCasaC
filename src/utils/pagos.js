// Formas de cobro: efectivo, terminal (tarjeta), transferencia o mixto (varias a la vez).
// Las ventas nuevas guardan cuanto se cobro de cada forma en monto_efectivo / monto_tarjeta / monto_transferencia.
// Las ventas anteriores no tienen esas columnas: se reparten segun tipo_pago (todo el total en una sola forma).

export const METODOS_PAGO = ['efectivo', 'tarjeta', 'transferencia'];
export const TIPOS_PAGO = [...METODOS_PAGO, 'mixto'];

// Forma de pago SAT por metodo (la mixta usa la del monto mayor)
export const FORMA_PAGO_SAT = { efectivo: '01', transferencia: '03', tarjeta: '04' };

const redondear2 = (n) => Math.round(Number(n || 0) * 100) / 100;

/** Expresiones SQL del monto cobrado por metodo para la venta con alias `a`. */
export const sqlMonto = (metodo, a = 'v') => {
  const tipo = `LOWER(COALESCE(${a}.tipo_pago, 'efectivo'))`;
  return `COALESCE(${a}.monto_${metodo}, CASE WHEN ${tipo} = '${metodo}' THEN ${a}.total ELSE 0 END)`;
};
export const sqlEfectivo = (a = 'v') => sqlMonto('efectivo', a);
export const sqlTarjeta = (a = 'v') => sqlMonto('tarjeta', a);
export const sqlTransferencia = (a = 'v') => sqlMonto('transferencia', a);

/** Montos cobrados por metodo de una venta (objeto con total, tipo_pago y monto_*). */
export const montosDeVenta = (venta) => {
  const tipo = String(venta?.tipo_pago || 'efectivo').toLowerCase();
  const total = Number(venta?.total || 0);
  const resultado = {};
  for (const m of METODOS_PAGO) {
    const guardado = venta?.[`monto_${m}`];
    resultado[m] = guardado !== null && guardado !== undefined
      ? redondear2(guardado)
      : (tipo === m ? redondear2(total) : 0);
  }
  return resultado;
};

/**
 * Valida y normaliza el cobro que manda la caja.
 * - Pago simple: { tipo_pago: 'efectivo' | 'tarjeta' | 'transferencia' }
 * - Pago mixto:  { tipo_pago: 'mixto', pagos: [{ metodo, monto }, ...] }
 * Regresa { tipo_pago, monto_efectivo, monto_tarjeta, monto_transferencia, forma_pago_sat }.
 * Lanza error con status 400 si los montos no cuadran con el total.
 */
export const normalizarCobro = ({ tipo_pago, pagos }, total) => {
  const tipo = String(tipo_pago || 'efectivo').toLowerCase();
  const totalVenta = redondear2(total);
  const montos = { efectivo: 0, tarjeta: 0, transferencia: 0 };
  const error = (msg) => Object.assign(new Error(msg), { status: 400 });

  if (!TIPOS_PAGO.includes(tipo)) throw error('Forma de cobro no válida');

  if (tipo !== 'mixto') {
    montos[tipo] = totalVenta;
  } else {
    if (!Array.isArray(pagos) || pagos.length < 2) throw error('El pago mixto necesita al menos dos formas de cobro');
    for (const p of pagos) {
      const metodo = String(p?.metodo || '').toLowerCase();
      const monto = Number(p?.monto);
      if (!METODOS_PAGO.includes(metodo)) throw error('Forma de cobro no válida en el pago mixto');
      if (!Number.isFinite(monto) || monto <= 0) throw error('Cada parte del pago mixto debe ser mayor a 0');
      montos[metodo] = redondear2(montos[metodo] + monto);
    }
    const suma = redondear2(montos.efectivo + montos.tarjeta + montos.transferencia);
    if (Math.abs(suma - totalVenta) > 0.01) {
      throw error(`El pago mixto suma $${suma.toFixed(2)} y el total es $${totalVenta.toFixed(2)}`);
    }
    // Si solo quedo una forma con monto, no es mixto
    const usados = METODOS_PAGO.filter(m => montos[m] > 0);
    if (usados.length < 2) throw error('El pago mixto necesita al menos dos formas de cobro');
  }

  const principal = METODOS_PAGO.reduce((a, b) => (montos[b] > montos[a] ? b : a), 'efectivo');
  return {
    tipo_pago: tipo,
    monto_efectivo: montos.efectivo,
    monto_tarjeta: montos.tarjeta,
    monto_transferencia: montos.transferencia,
    forma_pago_sat: FORMA_PAGO_SAT[principal]
  };
};

/**
 * Cuanto efectivo se regresa del cajon en una devolucion o cancelacion.
 * Se regresa primero en efectivo hasta lo que se cobro en efectivo; el resto va por terminal/transferencia.
 */
export const efectivoADevolver = (venta, totalDevuelto, yaDevueltoEnEfectivo = 0) => {
  const disponible = Math.max(0, montosDeVenta(venta).efectivo - Number(yaDevueltoEnEfectivo || 0));
  return redondear2(Math.min(Number(totalDevuelto || 0), disponible));
};

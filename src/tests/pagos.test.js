const { normalizarCobro, montosDeVenta, efectivoADevolver, sqlEfectivo } = require('../utils/pagos.js');

describe('Pagos - transferencia y mixto', () => {
  test('pago simple pone todo el total en su forma', () => {
    expect(normalizarCobro({ tipo_pago: 'transferencia' }, 150)).toEqual({
      tipo_pago: 'transferencia', monto_efectivo: 0, monto_tarjeta: 0, monto_transferencia: 150, forma_pago_sat: '03'
    });
    expect(normalizarCobro({}, 80).monto_efectivo).toBe(80);
  });

  test('pago mixto reparte y elige la forma SAT del monto mayor', () => {
    const r = normalizarCobro({ tipo_pago: 'mixto', pagos: [{ metodo: 'efectivo', monto: 200 }, { metodo: 'tarjeta', monto: 150 }] }, 350);
    expect(r).toEqual(expect.objectContaining({ tipo_pago: 'mixto', monto_efectivo: 200, monto_tarjeta: 150, monto_transferencia: 0, forma_pago_sat: '01' }));
  });

  test('pago mixto que no cuadra con el total se rechaza', () => {
    expect(() => normalizarCobro({ tipo_pago: 'mixto', pagos: [{ metodo: 'efectivo', monto: 100 }, { metodo: 'tarjeta', monto: 100 }] }, 350))
      .toThrow(/suma/);
  });

  test('pago mixto con una sola forma se rechaza', () => {
    expect(() => normalizarCobro({ tipo_pago: 'mixto', pagos: [{ metodo: 'efectivo', monto: 100 }, { metodo: 'efectivo', monto: 50 }] }, 150))
      .toThrow(/dos formas/);
  });

  test('forma de cobro desconocida se rechaza', () => {
    expect(() => normalizarCobro({ tipo_pago: 'credito' }, 10)).toThrow();
  });

  test('ventas anteriores (sin montos guardados) se reparten por tipo_pago', () => {
    expect(montosDeVenta({ total: '90', tipo_pago: 'tarjeta' })).toEqual({ efectivo: 0, tarjeta: 90, transferencia: 0 });
    expect(montosDeVenta({ total: '90', tipo_pago: null })).toEqual({ efectivo: 90, tarjeta: 0, transferencia: 0 });
  });

  test('devolucion de venta mixta saca del cajon solo hasta lo cobrado en efectivo', () => {
    const venta = { total: 350, tipo_pago: 'mixto', monto_efectivo: 200, monto_tarjeta: 150, monto_transferencia: 0 };
    expect(efectivoADevolver(venta, 350)).toBe(200);
    expect(efectivoADevolver(venta, 100)).toBe(100);
    expect(efectivoADevolver(venta, 100, 150)).toBe(50);
    expect(efectivoADevolver({ total: 100, tipo_pago: 'transferencia' }, 100)).toBe(0);
  });

  test('la expresion SQL respeta ventas viejas y nuevas', () => {
    expect(sqlEfectivo('v')).toContain('COALESCE(v.monto_efectivo');
    expect(sqlEfectivo('v')).toContain("= 'efectivo' THEN v.total");
  });
});

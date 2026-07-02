const { rangoFechasReporte } = require('../utils/fechas.js');

describe('rangoFechasReporte', () => {
  test('convierte dia local Mexico a rango UTC para Supabase', () => {
    const rango = rangoFechasReporte('2026-07-01', '2026-07-01');

    expect(rango.inicio.toISOString()).toBe('2026-07-01T06:00:00.000Z');
    expect(rango.fin.toISOString()).toBe('2026-07-02T05:59:59.999Z');
  });

  test('rechaza fechas sin formato YYYY-MM-DD', () => {
    expect(() => rangoFechasReporte('01/07/2026', '2026-07-01')).toThrow('fechaInicio');
  });
});

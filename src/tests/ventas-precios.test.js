const { validarLineaVenta, calcularTotalVenta, precioUnitarioServidor } = require('../utils/ventas.js');
const { fechaLocalISO, esMismoDiaLocal } = require('../utils/fechas.js');

const producto = { nombre: 'Refresco', precio_menudeo: '20.00', precio_mayoreo: '17.50', minimo_mayoreo: 6 };

describe('Ventas - precios calculados en servidor', () => {
  test('usa menudeo debajo del minimo de mayoreo y mayoreo al alcanzarlo', () => {
    expect(precioUnitarioServidor(producto, 5)).toBe(20);
    expect(precioUnitarioServidor(producto, 6)).toBe(17.5);
  });

  test('acepta el precio correcto y calcula el subtotal', () => {
    expect(validarLineaVenta(producto, 3, 20)).toEqual({ precio_unitario: 20, subtotal: 60 });
  });

  test('rechaza un precio manipulado desde el navegador', () => {
    expect(() => validarLineaVenta(producto, 3, 1)).toThrow('cambio');
  });

  test('total con IVA aparte y descuento', () => {
    const total = calcularTotalVenta({ subtotal: 100, ivaPorcentaje: 16, descuentoPorcentaje: 10, totalEnviado: 104.4 });
    expect(total).toBe(104.4);
  });

  test('sin iva_porcentaje acepta total sin IVA o con 16% (front anterior)', () => {
    expect(calcularTotalVenta({ subtotal: 100, totalEnviado: 100 })).toBe(100);
    expect(calcularTotalVenta({ subtotal: 100, totalEnviado: 116 })).toBe(116);
  });

  test('rechaza un total que no coincide', () => {
    expect(() => calcularTotalVenta({ subtotal: 100, ivaPorcentaje: 0, totalEnviado: 10 })).toThrow('no coincide');
  });
});

describe('Fechas en zona horaria del negocio', () => {
  test('a las 19:00 de Mexico (01:00 UTC del dia siguiente) sigue siendo el mismo dia local', () => {
    expect(fechaLocalISO(new Date('2026-07-02T01:00:00Z'))).toBe('2026-07-01');
    expect(esMismoDiaLocal('2026-07-01T15:00:00Z', new Date('2026-07-02T01:00:00Z'))).toBe(true);
  });

  test('despues de medianoche local cambia el dia', () => {
    expect(esMismoDiaLocal('2026-07-01T15:00:00Z', new Date('2026-07-02T06:30:00Z'))).toBe(false);
  });
});

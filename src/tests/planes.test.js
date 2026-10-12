const { cotizar, nivelDeGiro, NIVELES, catalogoPublico } = require('../utils/planes.js');
const { GIROS } = require('../utils/giros.js');

describe('Planes por giro', () => {
  test('cada giro pertenece a un solo nivel', () => {
    const asignados = Object.values(NIVELES).flatMap(n => n.giros);
    expect(new Set(asignados).size).toBe(asignados.length);
    expect(Object.keys(GIROS).every(g => asignados.includes(g))).toBe(true);
  });

  test('el plan de 1 sucursal cuesta segun el giro', () => {
    expect(cotizar({ giro: 'abarrotes' })).toEqual(expect.objectContaining({ nivel: 'esencial', precio_mensual: 349, limite_sucursales: 1, limite_usuarios: 2 }));
    expect(cotizar({ giro: 'farmacia' })).toEqual(expect.objectContaining({ nivel: 'catalogo_grande', precio_mensual: 849, limite_usuarios: 5 }));
    expect(nivelDeGiro('giro-inventado')).toBe('especializado');
  });

  test('Pro y Multi cuestan lo mismo para todos los giros', () => {
    expect(cotizar({ plan: 'pro', giro: 'abarrotes' }).precio_mensual).toBe(cotizar({ plan: 'pro', giro: 'farmacia' }).precio_mensual);
    const multi = cotizar({ plan: 'multisucursal', giro: 'ropa', sucursales: 1 });
    expect(multi).toEqual(expect.objectContaining({ limite_sucursales: 3, limite_usuarios: 15, precio_mensual: 1647 }));
  });

  test('extras: segunda sucursal solo en Esencial/Comercio y usuarios extra con tope', () => {
    expect(cotizar({ giro: 'abarrotes', segunda_sucursal: true })).toEqual(expect.objectContaining({ limite_sucursales: 2, precio_mensual: 798 }));
    expect(cotizar({ giro: 'farmacia', segunda_sucursal: true }).limite_sucursales).toBe(1);
    const muchos = cotizar({ giro: 'abarrotes', usuarios_extra: 999 });
    expect(muchos.usuarios_extra).toBe(20);
    expect(muchos.precio_mensual).toBe(349 + 20 * 99);
  });

  test('pago anual cobra 10 meses y cubre 12', () => {
    const anual = cotizar({ giro: 'abarrotes', periodo: 'anual' });
    expect(anual).toEqual(expect.objectContaining({ total_periodo: 3490, meses_cubiertos: 12, ahorro: 698 }));
  });

  test('el catalogo publico trae los 4 niveles con sus giros', () => {
    const c = catalogoPublico();
    expect(c.niveles).toHaveLength(4);
    expect(c.niveles[0].giros[0]).toEqual(expect.objectContaining({ clave: 'abarrotes' }));
  });
});

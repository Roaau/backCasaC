const XLSX = require('xlsx');
const {
  mapearEncabezados, parsearNumero, parsearFecha, parsearUnidad, leerFilasInventario
} = require('../utils/importarExcel.js');
const { cantidadValida, normalizarGiro } = require('../utils/giros.js');

const excel = (filas) => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(filas), 'Hoja1');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
};

describe('Importador de Excel - encabezados flexibles', () => {
  test('reconoce encabezados en español con acentos y sinónimos', () => {
    const { mapa } = mapearEncabezados(['Código', 'Producto', 'Precio Venta', 'Existencia', 'Laboratorio', 'Caducidad', 'Departamento']);
    expect(mapa).toEqual(expect.objectContaining({
      codigo_barras: 0, nombre: 1, precio_menudeo: 2, stock_actual: 3, marca: 4, fecha_caducidad: 5, categoria: 6
    }));
  });

  test('usa Descripcion como nombre cuando no hay columna de nombre', () => {
    const { mapa } = mapearEncabezados(['Clave', 'Descripción', 'Precio']);
    expect(mapa.nombre).toBe(1);
    expect(mapa.descripcion).toBeUndefined();
  });

  test('convierte precios, fechas y unidades comunes', () => {
    expect(parsearNumero('$1,234.50')).toBe(1234.5);
    expect(parsearNumero('12,5')).toBe(12.5);
    expect(parsearFecha('31/12/2027')).toBe('2027-12-31');
    expect(parsearFecha('02/2027')).toBe('2027-02-28');
    expect(parsearUnidad('Kilo')).toBe('kg');
    expect(parsearUnidad('PZA')).toBe('pieza');
    expect(parsearUnidad('mts')).toBe('metro');
  });

  test('lee un Excel con filas de titulo antes de los encabezados', () => {
    const buffer = excel([
      ['Inventario Tienda Don Pepe'],
      [],
      ['Código', 'Producto', 'Precio', 'Existencia', 'Unidad'],
      [7501055300075, 'Refresco 600 ml', '$18.00', 24, 'pza'],
      [null, 'Frijol', 32, 10.5, 'kg'],
    ]);
    const { filas, reconocidas } = leerFilasInventario(buffer);
    expect(reconocidas).toEqual(expect.arrayContaining(['codigo_barras', 'nombre', 'precio_menudeo', 'stock_actual', 'unidad_venta']));
    expect(filas).toHaveLength(2);
    expect(filas[0].datos).toEqual(expect.objectContaining({ codigo_barras: '7501055300075', nombre: 'Refresco 600 ml', precio_menudeo: 18, stock_actual: 24, unidad_venta: 'pieza' }));
    expect(filas[1].datos).toEqual(expect.objectContaining({ codigo_barras: null, nombre: 'Frijol', stock_actual: 10.5, unidad_venta: 'kg' }));
  });

  test('rechaza un archivo sin encabezados reconocibles', () => {
    expect(() => leerFilasInventario(excel([['a', 'b'], [1, 2]]))).toThrow('encabezados');
  });
});

describe('Giros y venta a granel', () => {
  test('pieza solo acepta enteros; kg/litro/metro aceptan hasta 3 decimales', () => {
    expect(cantidadValida(2, 'pieza')).toBe(true);
    expect(cantidadValida(1.5, 'pieza')).toBe(false);
    expect(cantidadValida(0.25, 'kg')).toBe(true);
    expect(cantidadValida(1.2345, 'kg')).toBe(false);
    expect(cantidadValida(0, 'kg')).toBe(false);
  });

  test('giro desconocido cae en general', () => {
    expect(normalizarGiro('Farmacia')).toBe('farmacia');
    expect(normalizarGiro('restaurante-x')).toBe('general');
  });
});

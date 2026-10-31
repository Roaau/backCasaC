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

  test('reconoce el Excel que exporta Eleventa', () => {
    const { mapa } = mapearEncabezados(['Código', 'Descripción', 'Tipo de Venta', 'Precio Costo', 'Precio Venta', 'Precio Mayoreo', 'Departamento', 'Existencia', 'Inv. Mínimo']);
    expect(mapa).toEqual(expect.objectContaining({
      codigo_barras: 0, nombre: 1, unidad_venta: 2, precio_compra: 3, precio_menudeo: 4, precio_mayoreo: 5, categoria: 6, stock_actual: 7, stock_minimo: 8
    }));
    expect(parsearUnidad('Granel')).toBe('kg');
    expect(parsearUnidad('Unidad')).toBe('pieza');
  });

  test('reconoce SICAR (Precio 1 / Precio 2) y Loyverse (columnas por tienda)', () => {
    const sicar = mapearEncabezados(['Clave', 'Descripción', 'Unidad', 'Precio 1', 'Precio 2', 'Costo', 'Existencia', 'Mínimo']).mapa;
    expect(sicar).toEqual(expect.objectContaining({ codigo_barras: 0, nombre: 1, unidad_venta: 2, precio_menudeo: 3, precio_mayoreo: 4, precio_compra: 5, stock_actual: 6, stock_minimo: 7 }));
    const loyverse = mapearEncabezados(['Handle', 'SKU', 'Name', 'Category', 'Sold by weight', 'Cost', 'Barcode', 'Price [Mi tienda]', 'In stock [Mi tienda]', 'Low stock [Mi tienda]']).mapa;
    expect(loyverse).toEqual(expect.objectContaining({ nombre: 2, categoria: 3, unidad_venta: 4, precio_compra: 5, codigo_barras: 6, stock_actual: 8, stock_minimo: 9 }));
  });

  test('reconoce Shopify', () => {
    const { mapa } = mapearEncabezados(['Handle', 'Title', 'Type', 'Variant SKU', 'Variant Price', 'Variant Barcode', 'Variant Inventory Qty', 'Cost per item']);
    expect(mapa).toEqual(expect.objectContaining({ nombre: 1, categoria: 2, precio_menudeo: 4, codigo_barras: 5, stock_actual: 6, precio_compra: 7 }));
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

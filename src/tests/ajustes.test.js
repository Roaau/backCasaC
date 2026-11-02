jest.mock('../config/database.js', () => ({ __esModule: true, default: { query: jest.fn() } }));
jest.mock('sequelize', () => ({ QueryTypes: { SELECT: 'SELECT' }, Op: {} }));
// scope.js (via filtros.js) carga el modelo de sucursales; aqui no se usa
jest.mock('../models/SucursalModel.js', () => ({ __esModule: true, default: {} }));

const { default: sequelize } = require('../config/database.js');
const { filasPrecio, getReporteAjustes } = require('../controllers/ajustesController.js');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('Reporte de cambios y ajustes', () => {
  test('cambio de precio desde compra y desde inventario', () => {
    const filas = filasPrecio([
      { accion: 'PRECIO_CAMBIO', entidad_id: '6', fecha: '2026-11-01', usuario: 'Ana', detalle: { nombre: 'Coca', antes: 18, despues: 20, motivo: 'Subió con el proveedor', origen: 'compra', folio: 'F-1' } },
      { accion: 'PRODUCTO_EDITAR', entidad_id: '7', fecha: '2026-11-01', usuario: 'Luis', detalle: { antes: { nombre: 'Pan', precio_menudeo: '5.00' }, despues: { precio_menudeo: 6 } } },
      { accion: 'PRODUCTO_EDITAR', entidad_id: '8', fecha: '2026-11-01', usuario: 'Luis', detalle: { antes: { nombre: 'Sal', precio_menudeo: '9.00' }, despues: { nombre: 'Sal fina' } } }
    ]);
    expect(filas).toHaveLength(2);
    expect(filas[0]).toEqual(expect.objectContaining({ tipo: 'precio', descripcion: 'Coca', antes: 18, despues: 20, monto: 2, motivo: 'Subió con el proveedor · en compra F-1' }));
    expect(filas[1]).toEqual(expect.objectContaining({ descripcion: 'Pan', antes: 5, despues: 6, monto: 1, motivo: 'Editado en inventario' }));
  });

  test('descuento calcula lo que se dejo de cobrar y respeta el filtro de tipo', async () => {
    sequelize.query.mockResolvedValue([{ folio: 'V1', fecha: '2026-11-01T10:00:00Z', total: 90, descuento_porcentaje: 10, usuario: 'Ana', sucursal: 'Centro' }]);
    const res = mockRes();
    await getReporteAjustes({ usuario: { id: 1, rol: 1, empresa_id: 3, sucursal_id: 4 }, body: { fechaInicio: '2026-11-01', fechaFin: '2026-11-01', tipo: 'descuento' } }, res);
    expect(sequelize.query).toHaveBeenCalledTimes(1);
    const { datos, resumen } = res.json.mock.calls[0][0];
    expect(datos[0]).toEqual(expect.objectContaining({ tipo: 'descuento', antes: 100, despues: 90, monto: -10 }));
    expect(resumen.descuento).toEqual({ cantidad: 1, monto: -10 });
  });
});

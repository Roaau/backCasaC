jest.mock('sequelize', () => ({
  QueryTypes: { SELECT: 'SELECT', UPDATE: 'UPDATE' },
  DataTypes: {
    INTEGER: jest.fn(), STRING: jest.fn(), DECIMAL: jest.fn(),
    TEXT: jest.fn(), BOOLEAN: jest.fn(), DATE: jest.fn(), FLOAT: jest.fn(), NOW: 'NOW'
  },
  Op: { or: Symbol('or'), iLike: Symbol('iLike'), like: Symbol('like') }
}));
jest.mock('../config/database.js', () => ({
  __esModule: true, default: { query: jest.fn() }
}));
jest.mock('../models/Producto.js', () => ({
  __esModule: true,
  default: {
    findAll: jest.fn(), findAndCountAll: jest.fn(),
    findOne: jest.fn(), create: jest.fn(),
    update: jest.fn(), destroy: jest.fn(), count: jest.fn()
  }
}));
jest.mock('../models/StockSucursalModel.js', () => ({
  __esModule: true,
  default: { findOne: jest.fn(), create: jest.fn(), findAll: jest.fn(), update: jest.fn() }
}));
jest.mock('../models/SucursalModel.js', () => ({
  __esModule: true,
  default: { findAll: jest.fn(), findOne: jest.fn(), findByPk: jest.fn() }
}));
jest.mock('multer', () => {
  const m = () => ({ single: () => jest.fn() });
  m.memoryStorage = jest.fn();
  return m;
});
jest.mock('xlsx', () => ({ readFile: jest.fn(), utils: { sheet_to_json: jest.fn() } }));

const { default: Producto } = require('../models/Producto.js');
const { default: Sucursal } = require('../models/SucursalModel.js');
const { getAll }            = require('../controllers/productosController.js');

const makeRow = (data) => ({ toJSON: () => data, ...data, StockSucursals: [] });

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
};

describe('Productos — getAll()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Sucursal.findOne.mockResolvedValue({ sucursal_id: 1, empresa_id: 1 });
  });

  test('devuelve lista de productos con paginación', async () => {
    Producto.findAndCountAll.mockResolvedValue({
      count: 2,
      rows: [
        makeRow({ producto_id: 1, nombre: 'Tornillo', stock_actual: 100 }),
        makeRow({ producto_id: 2, nombre: 'Clavo',    stock_actual: 50 })
      ]
    });

    const req = {
      query: { page: '1', limit: '50' },
      usuario: { empresa_id: 1, sucursal_id: 1, es_admin: true }
    };
    const res = mockRes();
    await getAll(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      items: expect.arrayContaining([expect.objectContaining({ nombre: 'Tornillo' })]),
      total: 2
    }));
  });

  test('incluye empresa_id en el where de la query', async () => {
    Producto.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    const req = {
      query: { q: 'Martillo', page: '1', limit: '50' },
      usuario: { empresa_id: 5, sucursal_id: 1, es_admin: true }
    };
    const res = mockRes();
    await getAll(req, res);
    const [callArgs] = Producto.findAndCountAll.mock.calls;
    expect(callArgs[0].where).toMatchObject({ empresa_id: 5 });
  });
});

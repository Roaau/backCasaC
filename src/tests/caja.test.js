jest.mock('../models/CajaModel.js', () => ({
  __esModule: true,
  default: { findOne: jest.fn(), create: jest.fn(), update: jest.fn() }
}));
jest.mock('../models/MovimientoCaja.js', () => ({
  __esModule: true,
  default: { findAll: jest.fn(), create: jest.fn(), bulkCreate: jest.fn() }
}));
jest.mock('../models/SucursalModel.js', () => ({
  __esModule: true,
  default: { findOne: jest.fn() }
}));
jest.mock('../config/database.js', () => ({
  __esModule: true, default: { query: jest.fn() }
}));
jest.mock('sequelize', () => ({
  QueryTypes: { SELECT: 'SELECT' },
  DataTypes: {
    INTEGER: jest.fn(), STRING: jest.fn(), DECIMAL: jest.fn(),
    TEXT: jest.fn(), BOOLEAN: jest.fn(), DATE: jest.fn(), NOW: 'NOW'
  },
  Op: { and: Symbol('and'), or: Symbol('or'), gte: Symbol('gte'), lte: Symbol('lte') }
}));

const { default: Caja }         = require('../models/CajaModel.js');
const { default: Sucursal }     = require('../models/SucursalModel.js');
const { estadoCaja, abrirCaja } = require('../controllers/cajaController.js');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
};

describe('Caja — estadoCaja()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Sucursal.findOne.mockResolvedValue({ sucursal_id: 1, empresa_id: 1 });
  });

  test('devuelve abierta: false cuando no hay caja activa', async () => {
    Caja.findOne.mockResolvedValue(null);
    const req = { query: { usuario_id: '1', sucursal_id: '1' }, usuario: { empresa_id: 1, sucursal_id: 1, rol: 1 } };
    const res = mockRes();
    await estadoCaja(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ abierta: false }));
  });

  test('devuelve abierta: true cuando hay caja abierta', async () => {
    Caja.findOne.mockResolvedValue({ caja_id: 42, estado: 'ABIERTA', monto_inicial: 500 });
    const req = { query: { usuario_id: '1', sucursal_id: '1' }, usuario: { empresa_id: 1, sucursal_id: 1, rol: 1 } };
    const res = mockRes();
    await estadoCaja(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ abierta: true }));
  });
});

describe('Caja — abrirCaja()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Sucursal.findOne.mockResolvedValue({ sucursal_id: 1, empresa_id: 1 });
  });

  test('devuelve 400 si ya hay una caja abierta hoy', async () => {
    const hoy = new Date();
    Caja.findOne.mockResolvedValue({
      caja_id: 1, fecha_apertura: hoy.toISOString(),
      update: jest.fn()
    });
    const req = { body: { usuario_id: 1, monto: 500, sucursal_id: 1 }, usuario: { empresa_id: 1, sucursal_id: 1, rol: 1 } };
    const res = mockRes();
    await abrirCaja(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('crea una caja nueva si no hay caja activa', async () => {
    Caja.findOne.mockResolvedValue(null);
    Caja.create.mockResolvedValue({ caja_id: 10, monto_inicial: 300 });
    const req = { body: { usuario_id: 1, monto: 300, sucursal_id: 1 }, usuario: { empresa_id: 1, sucursal_id: 1, id: 1, rol: 1 } };
    const res = mockRes();
    await abrirCaja(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      caja: expect.objectContaining({ caja_id: 10 })
    }));
  });
});

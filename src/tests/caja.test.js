jest.mock('../models/CajaModel.js', () => ({
  __esModule: true,
  default: { findOne: jest.fn(), findByPk: jest.fn(), create: jest.fn(), update: jest.fn() }
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
  __esModule: true,
  default: {
    query: jest.fn(),
    transaction: jest.fn(() => ({ commit: jest.fn(), rollback: jest.fn() }))
  }
}));
jest.mock('../utils/auditoria.js', () => ({
  registrarAuditoria: jest.fn()
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
const { estadoCaja, abrirCaja, cerrarCaja } = require('../controllers/cajaController.js');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
};

describe('Caja - estadoCaja()', () => {
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
    Caja.findOne.mockResolvedValue({ caja_id: 42, estado: 'ABIERTA', fecha_apertura: new Date().toISOString(), monto_inicial: 500 });
    const req = { query: { usuario_id: '1', sucursal_id: '1' }, usuario: { empresa_id: 1, sucursal_id: 1, rol: 1 } };
    const res = mockRes();
    await estadoCaja(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ abierta: true }));
  });
  test('marca caja de dia anterior como pendiente de cierre', async () => {
    const ayer = new Date();
    ayer.setDate(ayer.getDate() - 1);
    Caja.findOne.mockResolvedValue({ caja_id: 41, fecha_apertura: ayer.toISOString(), monto_inicial: 500 });
    const req = { query: { usuario_id: '1', sucursal_id: '1' }, usuario: { empresa_id: 1, sucursal_id: 1, rol: 1 } };
    const res = mockRes();
    await estadoCaja(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      abierta: true,
      requiere_cierre: true,
      pendiente_cierre: true
    }));
  });
});

describe('Caja - abrirCaja()', () => {
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


  test('no autocierra caja anterior al abrir una nueva', async () => {
    const ayer = new Date();
    ayer.setDate(ayer.getDate() - 1);
    const update = jest.fn();
    Caja.findOne.mockResolvedValue({ caja_id: 1, fecha_apertura: ayer.toISOString(), update });
    const req = { body: { usuario_id: 1, monto: 500, sucursal_id: 1 }, usuario: { empresa_id: 1, sucursal_id: 1, rol: 1 } };
    const res = mockRes();
    await abrirCaja(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ requiere_cierre: true }));
    expect(update).not.toHaveBeenCalled();
    expect(Caja.create).not.toHaveBeenCalled();
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

describe('Caja - cerrarCaja()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Sucursal.findOne.mockResolvedValue({ sucursal_id: 1, empresa_id: 1 });
  });

  test('rechaza cierre con checklist incompleto', async () => {
    const req = {
      body: { caja_id: 10, usuario_cierre_id: 1, montoFinal: 500, diferencia: 0, checklist: { efectivo_contado: true } },
      usuario: { empresa_id: 1, sucursal_id: 1, rol: 1, id: 1 }
    };
    const res = mockRes();

    await cerrarCaja(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Checklist de cierre incompleto' }));
    expect(Caja.update).not.toHaveBeenCalled();
  });

  test('rechaza cierre con diferencia sin observacion', async () => {
    const req = {
      body: {
        caja_id: 10,
        usuario_cierre_id: 1,
        montoFinal: 450,
        diferencia: -50,
        checklist: {
          efectivo_contado: true,
          movimientos_revisados: true,
          facturas_revisadas: true
        }
      },
      usuario: { empresa_id: 1, sucursal_id: 1, rol: 1, id: 1 }
    };
    const res = mockRes();

    await cerrarCaja(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Agrega una observacion para explicar la diferencia de caja' }));
    expect(Caja.update).not.toHaveBeenCalled();
  });
});

jest.mock('../models/Cotizacion.js', () => ({
  __esModule: true,
  default: { create: jest.fn(), count: jest.fn(), findOne: jest.fn(), update: jest.fn(), findAll: jest.fn() }
}));
jest.mock('../models/DetalleCotizacion.js', () => ({
  __esModule: true,
  default: { bulkCreate: jest.fn(), findAll: jest.fn().mockResolvedValue([]) }
}));
jest.mock('../models/SucursalModel.js', () => ({
  __esModule: true,
  default: { findOne: jest.fn(), findAll: jest.fn() }
}));
jest.mock('../config/database.js', () => ({
  __esModule: true, default: { query: jest.fn(), transaction: jest.fn() }
}));
jest.mock('sequelize', () => ({
  QueryTypes: { SELECT: 'SELECT' },
  DataTypes: {
    INTEGER: jest.fn(), STRING: jest.fn(), DECIMAL: jest.fn(),
    TEXT: jest.fn(), BOOLEAN: jest.fn(), DATE: jest.fn(), NOW: 'NOW'
  },
  Op: {}
}));

const { default: Cotizacion }        = require('../models/Cotizacion.js');
const { default: DetalleCotizacion } = require('../models/DetalleCotizacion.js');
const { default: Sucursal }          = require('../models/SucursalModel.js');
const { default: db }                = require('../config/database.js');
const { crear, actualizarEstado }    = require('../controllers/cotizacionesController.js');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
};

describe('Cotizaciones - crear()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const t = { commit: jest.fn(), rollback: jest.fn() };
    db.transaction.mockResolvedValue(t);
    Sucursal.findOne.mockResolvedValue({ sucursal_id: 1, empresa_id: 1 });
  });

  test('devuelve 400 si no hay items', async () => {
    const req = { body: { items: [] }, usuario: { empresa_id: 1, sucursal_id: 1, id: 1, rol: 2 } };
    const res = mockRes();
    await crear(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('crea cotizacion con folio correcto cuando hay items', async () => {
    Cotizacion.count.mockResolvedValue(5);
    Cotizacion.create.mockResolvedValue({ cotizacion_id: 10 });
    DetalleCotizacion.bulkCreate.mockResolvedValue([]);

    const req = {
      body: {
        cliente_nombre: 'Juan',
        items: [{ nombre_producto: 'Tornillo', cantidad: 10, precio_unitario: 1, descuento_pct: 0, subtotal: 10 }]
      },
      usuario: { empresa_id: 1, sucursal_id: 1, id: 1, rol: 2 }
    };
    const res = mockRes();
    await crear(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(Cotizacion.create).toHaveBeenCalledWith(expect.objectContaining({
      empresa_id: 1,
      sucursal_id: 1,
      usuario_id: 1
    }), expect.any(Object));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      folio: 'COT-0006',
      cotizacion_id: 10
    }));
  });
});

describe('Cotizaciones - actualizarEstado()', () => {
  beforeEach(() => jest.clearAllMocks());

  test('devuelve 400 si el estado no es valido', async () => {
    const req = { params: { id: '1' }, body: { estado: 'INVALIDO' }, usuario: { empresa_id: 1, sucursal_id: 1, rol: 2 } };
    const res = mockRes();
    await actualizarEstado(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('empleado actualiza solo cotizacion de su sucursal', async () => {
    Cotizacion.update.mockResolvedValue([1]);
    const req = { params: { id: '1' }, body: { estado: 'ACEPTADA' }, usuario: { empresa_id: 1, sucursal_id: 1, rol: 2 } };
    const res = mockRes();
    await actualizarEstado(req, res);
    expect(Cotizacion.update).toHaveBeenCalledWith(
      { estado: 'ACEPTADA' },
      { where: { cotizacion_id: '1', empresa_id: 1, sucursal_id: 1 } }
    );
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  test('admin actualiza cotizacion de su empresa sin abrir otras empresas', async () => {
    Cotizacion.update.mockResolvedValue([1]);
    const req = { params: { id: '2' }, body: { estado: 'ENVIADA' }, usuario: { empresa_id: 1, sucursal_id: 1, rol: 1 } };
    const res = mockRes();
    await actualizarEstado(req, res);
    expect(Cotizacion.update).toHaveBeenCalledWith(
      { estado: 'ENVIADA' },
      { where: { cotizacion_id: '2', empresa_id: 1 } }
    );
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });
});

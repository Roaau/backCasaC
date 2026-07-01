jest.mock('../models/SucursalModel.js', () => ({
  __esModule: true,
  default: { findAll: jest.fn(), create: jest.fn(), update: jest.fn() }
}));
jest.mock('../models/StockSucursalModel.js', () => ({
  __esModule: true,
  default: { bulkCreate: jest.fn() }
}));
jest.mock('../models/Producto.js', () => ({
  __esModule: true,
  default: { findAll: jest.fn() }
}));
jest.mock('../config/database.js', () => ({
  __esModule: true,
  default: { transaction: jest.fn() }
}));

const { default: Sucursal } = require('../models/SucursalModel.js');
const { default: StockSucursal } = require('../models/StockSucursalModel.js');
const { default: Producto } = require('../models/Producto.js');
const { default: db } = require('../config/database.js');
const { getSucursales, createSucursal, updateSucursal } = require('../controllers/sucursalesController.js');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('Sucursales - seguridad multiempresa', () => {
  let tx;

  beforeEach(() => {
    jest.clearAllMocks();
    tx = { commit: jest.fn(), rollback: jest.fn() };
    db.transaction.mockResolvedValue(tx);
  });

  test('lista solo sucursales activas de la empresa del token', async () => {
    Sucursal.findAll.mockResolvedValue([{ sucursal_id: 1, empresa_id: 10 }]);
    const req = { usuario: { empresa_id: 10, sucursal_id: 1, rol: 2 } };
    const res = mockRes();

    await getSucursales(req, res);

    expect(Sucursal.findAll).toHaveBeenCalledWith(expect.objectContaining({
      where: { empresa_id: 10, activa: true }
    }));
    expect(res.json).toHaveBeenCalledWith([{ sucursal_id: 1, empresa_id: 10 }]);
  });

  test('empleado no puede crear sucursal aunque mande datos validos', async () => {
    const req = {
      usuario: { empresa_id: 10, sucursal_id: 1, rol: 2 },
      body: { nombre: 'Nueva', empresa_id: 999 }
    };
    const res = mockRes();

    await createSucursal(req, res);

    expect(Sucursal.create).not.toHaveBeenCalled();
    expect(tx.rollback).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('admin crea sucursal amarrada a su empresa e ignora empresa_id del body', async () => {
    Sucursal.create.mockResolvedValue({ sucursal_id: 22, empresa_id: 10 });
    Producto.findAll.mockResolvedValue([{ producto_id: 7 }]);
    StockSucursal.bulkCreate.mockResolvedValue([]);

    const req = {
      usuario: { empresa_id: 10, sucursal_id: 1, rol: 1 },
      body: { nombre: 'Sucursal Norte', empresa_id: 999, cp_sat: '64000' }
    };
    const res = mockRes();

    await createSucursal(req, res);

    expect(Sucursal.create).toHaveBeenCalledWith(expect.objectContaining({
      nombre: 'Sucursal Norte',
      empresa_id: 10
    }), { transaction: tx });
    expect(Sucursal.create.mock.calls[0][0]).not.toHaveProperty('empresa_id', 999);
    expect(tx.commit).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('update de admin queda limitado por empresa_id del token', async () => {
    Sucursal.update.mockResolvedValue([1]);
    const req = {
      params: { id: '5' },
      usuario: { empresa_id: 10, sucursal_id: 1, rol: 1 },
      body: { nombre: 'Centro', empresa_id: 999 }
    };
    const res = mockRes();

    await updateSucursal(req, res);

    expect(Sucursal.update).toHaveBeenCalledWith(expect.objectContaining({
      nombre: 'Centro'
    }), { where: { sucursal_id: '5', empresa_id: 10 } });
    expect(Sucursal.update.mock.calls[0][0]).not.toHaveProperty('empresa_id');
    expect(res.json).toHaveBeenCalledWith({ mensaje: 'Sucursal actualizada' });
  });
});

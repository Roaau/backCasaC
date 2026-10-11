jest.mock('sequelize', () => ({
  Op: { between: Symbol('between') }
}));
jest.mock('../config/database.js', () => ({
  __esModule: true,
  default: { transaction: jest.fn() }
}));
jest.mock('../models/Compra.js', () => ({
  __esModule: true,
  default: { findAll: jest.fn(), create: jest.fn() }
}));
jest.mock('../models/DetalleCompra.js', () => ({
  __esModule: true,
  default: { findAll: jest.fn(), create: jest.fn() }
}));
jest.mock('../models/Proveedor.js', () => ({
  __esModule: true,
  default: { findAll: jest.fn(), findOne: jest.fn() }
}));
jest.mock('../models/Producto.js', () => ({
  __esModule: true,
  default: { update: jest.fn(), findOne: jest.fn(), increment: jest.fn() }
}));
jest.mock('../models/StockSucursalModel.js', () => ({
  __esModule: true,
  default: { findOne: jest.fn(), create: jest.fn() }
}));
jest.mock('../models/CajaModel.js', () => ({
  __esModule: true,
  default: { findOne: jest.fn() }
}));
jest.mock('../models/MovimientoCaja.js', () => ({
  __esModule: true,
  default: { create: jest.fn() }
}));
jest.mock('../models/MovimientoInventario.js', () => ({
  __esModule: true,
  default: { create: jest.fn() }
}));
jest.mock('../utils/scope.js', () => ({
  resolverScopeSucursales: jest.fn(),
  resolverSucursalOperativa: jest.fn(),
  responderErrorScope: (res, err) => res.status(err.status || 500).json({ error: err.message })
}));

const { Op } = require('sequelize');
const { default: db } = require('../config/database.js');
const { default: Compra } = require('../models/Compra.js');
const { default: DetalleCompra } = require('../models/DetalleCompra.js');
const { default: Producto } = require('../models/Producto.js');
const { default: Proveedor } = require('../models/Proveedor.js');
const { default: StockSucursal } = require('../models/StockSucursalModel.js');
const { default: MovimientoInventario } = require('../models/MovimientoInventario.js');
const { resolverScopeSucursales, resolverSucursalOperativa } = require('../utils/scope.js');
const { listarCompras, crearCompra } = require('../controllers/comprasController.js');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('Compras - aislamiento multiempresa/sucursal', () => {
  let tx;

  beforeEach(() => {
    jest.clearAllMocks();
    tx = { commit: jest.fn(), rollback: jest.fn() };
    db.transaction.mockResolvedValue(tx);
  });

  test('listar usa scope central para limitar empresa y sucursal', async () => {
    resolverScopeSucursales.mockResolvedValue({
      empresa_id: 12,
      whereSucursal: 5
    });
    Compra.findAll.mockResolvedValue([]);
    DetalleCompra.findAll.mockResolvedValue([]);

    const req = {
      query: { fechaInicio: '2026-06-01', fechaFin: '2026-06-30', sucursal_id: '999' },
      usuario: { empresa_id: 12, sucursal_id: 5, rol: 2 }
    };
    const res = mockRes();

    await listarCompras(req, res);

    expect(resolverScopeSucursales).toHaveBeenCalledWith(req);
    expect(Compra.findAll).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        empresa_id: 12,
        sucursal_id: 5,
        fecha: { [Op.between]: [expect.any(Date), expect.any(Date)] }
      })
    }));
    expect(res.json).toHaveBeenCalledWith([]);
  });

  test('crear compra fuerza sucursal operativa y empresa del token', async () => {
    resolverSucursalOperativa.mockResolvedValue(4);
    Compra.create.mockResolvedValue({ compra_id: 30 });
    DetalleCompra.create.mockResolvedValue({});
    StockSucursal.findOne.mockResolvedValue({ stock_actual: 2, update: jest.fn().mockResolvedValue(true) });
    MovimientoInventario.create.mockResolvedValue({});
    Producto.update.mockResolvedValue([1]);
    Producto.findOne.mockResolvedValue({ producto_id: 6, nombre: 'Cemento', codigo_barras: '750', unidad_venta: 'pieza' });
    Proveedor.findOne.mockResolvedValue({ proveedor_id: 1 });

    const req = {
      usuario: { id: 9, empresa_id: 15, sucursal_id: 4, rol: 2 },
      body: {
        sucursal_id: 999,
        proveedor_id: 1,
        items: [{ producto_id: 6, nombre_producto: 'Cemento', cantidad: 3, costo_unitario: 100 }]
      }
    };
    const res = mockRes();

    await crearCompra(req, res);

    expect(resolverSucursalOperativa).toHaveBeenCalledWith(req);
    expect(Compra.create).toHaveBeenCalledWith(expect.objectContaining({
      empresa_id: 15,
      sucursal_id: 4,
      usuario_id: 9
    }), { transaction: tx });
    expect(Producto.update).toHaveBeenCalledWith(
      { precio_compra: 100 },
      { where: { producto_id: 6, empresa_id: 15 }, transaction: tx }
    );
    expect(MovimientoInventario.create).toHaveBeenCalledWith(expect.objectContaining({
      producto_id: 6,
      sucursal_id: 4,
      usuario_id: 9,
      tipo_movimiento: 'ENTRADA',
      motivo: 'COMPRA',
      cantidad: 3,
      stock_anterior: 2,
      stock_nuevo: 5
    }), { transaction: tx });
    expect(tx.commit).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('rechaza compra de un producto de otra empresa sin tocar stock', async () => {
    resolverSucursalOperativa.mockResolvedValue(4);
    Producto.findOne.mockResolvedValue(null);
    StockSucursal.findOne.mockClear();

    const req = {
      usuario: { id: 9, empresa_id: 15, sucursal_id: 4, rol: 2 },
      body: { items: [{ producto_id: 77, nombre_producto: 'Ajeno', cantidad: 3, costo_unitario: 10 }] }
    };
    const res = mockRes();

    await crearCompra(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(StockSucursal.findOne).not.toHaveBeenCalled();
    expect(tx.rollback).toHaveBeenCalled();
  });
});

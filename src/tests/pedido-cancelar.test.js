const modelo = (...metodos) => ({ __esModule: true, default: Object.fromEntries(metodos.map(m => [m, jest.fn()])) });

jest.mock('../config/database.js', () => ({ __esModule: true, default: { transaction: jest.fn(), query: jest.fn() } }));
jest.mock('../models/Venta.js', () => modelo('update', 'create', 'findOne'));
jest.mock('../models/DetalleVenta.js', () => modelo('findAll', 'create'));
jest.mock('../models/Producto.js', () => modelo('increment', 'findOne'));
jest.mock('../models/StockSucursalModel.js', () => modelo('findOne', 'create'));
jest.mock('../models/SucursalModel.js', () => modelo('findByPk'));
jest.mock('../models/EmpresaModel.js', () => modelo('findByPk'));
jest.mock('../models/CajaModel.js', () => modelo('findOne'));
jest.mock('../models/MovimientoInventario.js', () => modelo('create'));
jest.mock('../models/MovimientoCaja.js', () => modelo('create'));
jest.mock('../models/Devolucion.js', () => modelo('findAll', 'create'));
jest.mock('../models/DetalleDevolucion.js', () => modelo('findAll', 'create'));
jest.mock('../models/CfdiVenta.js', () => modelo('create'));
jest.mock('../models/ClienteFiscal.js', () => modelo('findOrCreate'));
jest.mock('../utils/auditoria.js', () => ({ __esModule: true, registrarAuditoria: jest.fn() }));

const { default: db } = require('../config/database.js');
const { default: Venta } = require('../models/Venta.js');
const { default: DetalleVenta } = require('../models/DetalleVenta.js');
const { default: Producto } = require('../models/Producto.js');
const { default: StockSucursal } = require('../models/StockSucursalModel.js');
const { default: Caja } = require('../models/CajaModel.js');
const { default: MovimientoInventario } = require('../models/MovimientoInventario.js');
const { default: MovimientoCaja } = require('../models/MovimientoCaja.js');
const { default: Devolucion } = require('../models/Devolucion.js');
const { default: DetalleDevolucion } = require('../models/DetalleDevolucion.js');
const { actualizarEstadoPedido } = require('../controllers/ventasController.js');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const req = (estado) => ({ params: { id: '50' }, body: { estado }, usuario: { id: 7, empresa_id: 3, sucursal_id: 2, rol: 1 } });

describe('Cancelar pedido regresa mercancia y dinero', () => {
  let t;
  let stock;

  beforeEach(() => {
    jest.clearAllMocks();
    t = { commit: jest.fn(), rollback: jest.fn() };
    db.transaction.mockResolvedValue(t);
    db.query.mockResolvedValue([{ venta_id: 50, folio: 'P-1', sucursal_id: 2, estado_pedido: 'PENDIENTE', total: 100, tipo_pago: 'efectivo', empresa_id: 3 }]);
    DetalleVenta.findAll.mockResolvedValue([
      { producto_id: 1, nombre_producto: 'Arroz', codigo_barras: '111', cantidad: '2', precio_unitario: '30' },
      { producto_id: 2, nombre_producto: 'Frijol', codigo_barras: '222', cantidad: '1', precio_unitario: '40' }
    ]);
    Devolucion.findAll.mockResolvedValue([]);
    Devolucion.create.mockResolvedValue({ devolucion_id: 9 });
    stock = { stock_actual: '5', increment: jest.fn() };
    StockSucursal.findOne.mockResolvedValue(stock);
    Caja.findOne.mockResolvedValue({ caja_id: 4 });
  });

  test('pedido en efectivo: regresa stock y saca el dinero de la caja', async () => {
    const res = mockRes();
    await actualizarEstadoPedido(req('CANCELADO'), res);

    expect(stock.increment).toHaveBeenCalledWith('stock_actual', expect.objectContaining({ by: 2 }));
    expect(stock.increment).toHaveBeenCalledWith('stock_actual', expect.objectContaining({ by: 1 }));
    expect(Producto.increment).toHaveBeenCalledTimes(2);
    expect(MovimientoInventario.create).toHaveBeenCalledWith(expect.objectContaining({ tipo_movimiento: 'ENTRADA', motivo: 'CANCELACION' }), expect.anything());
    expect(Devolucion.create).toHaveBeenCalledWith(expect.objectContaining({ venta_id: 50, total_devuelto: 100 }), expect.anything());
    expect(MovimientoCaja.create).toHaveBeenCalledWith(expect.objectContaining({ caja_id: 4, tipo_movimiento: 'DEVOLUCION', monto: 100 }), expect.anything());
    expect(Venta.update).toHaveBeenCalledWith({ estado_pedido: 'CANCELADO' }, expect.anything());
    expect(t.commit).toHaveBeenCalled();
  });

  test('pedido con terminal: regresa stock pero no saca efectivo', async () => {
    db.query.mockResolvedValue([{ venta_id: 50, folio: 'P-1', sucursal_id: 2, estado_pedido: 'ENVIADO', total: 100, tipo_pago: 'tarjeta', empresa_id: 3 }]);
    const res = mockRes();
    await actualizarEstadoPedido(req('CANCELADO'), res);

    expect(stock.increment).toHaveBeenCalledTimes(2);
    expect(MovimientoCaja.create).not.toHaveBeenCalled();
    expect(t.commit).toHaveBeenCalled();
  });

  test('solo regresa lo que no se habia devuelto antes', async () => {
    Devolucion.findAll.mockResolvedValue([{ devolucion_id: 1 }]);
    DetalleDevolucion.findAll.mockResolvedValue([{ producto_id: 1, cantidad: '2' }]);
    const res = mockRes();
    await actualizarEstadoPedido(req('CANCELADO'), res);

    expect(stock.increment).toHaveBeenCalledTimes(1);
    expect(stock.increment).toHaveBeenCalledWith('stock_actual', expect.objectContaining({ by: 1 }));
    expect(Devolucion.create).toHaveBeenCalledWith(expect.objectContaining({ total_devuelto: 40 }), expect.anything());
  });

  test('efectivo sin caja abierta: no cancela', async () => {
    Caja.findOne.mockResolvedValue(null);
    const res = mockRes();
    await actualizarEstadoPedido(req('CANCELADO'), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(t.rollback).toHaveBeenCalled();
    expect(Venta.update).not.toHaveBeenCalled();
  });

  test('no se puede cancelar un pedido entregado ni reactivar uno cancelado', async () => {
    db.query.mockResolvedValue([{ venta_id: 50, folio: 'P-1', sucursal_id: 2, estado_pedido: 'ENTREGADO', total: 100, tipo_pago: 'efectivo', empresa_id: 3 }]);
    let res = mockRes();
    await actualizarEstadoPedido(req('CANCELADO'), res);
    expect(res.status).toHaveBeenCalledWith(409);

    db.query.mockResolvedValue([{ venta_id: 50, folio: 'P-1', sucursal_id: 2, estado_pedido: 'CANCELADO', total: 100, tipo_pago: 'efectivo', empresa_id: 3 }]);
    res = mockRes();
    await actualizarEstadoPedido(req('PENDIENTE'), res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(stock.increment).not.toHaveBeenCalled();
    expect(Venta.update).not.toHaveBeenCalled();
  });
});

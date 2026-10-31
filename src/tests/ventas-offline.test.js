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
jest.mock('../utils/scope.js', () => ({
  __esModule: true,
  esAdminEmpresa: () => false,
  resolverSucursalOperativa: jest.fn().mockResolvedValue(2),
  responderErrorScope: (res, e) => res.status(e.status || 400).json({ error: e.message })
}));

const { default: db } = require('../config/database.js');
const { default: Venta } = require('../models/Venta.js');
const { default: Producto } = require('../models/Producto.js');
const { default: StockSucursal } = require('../models/StockSucursalModel.js');
const { default: Empresa } = require('../models/EmpresaModel.js');
const { default: Caja } = require('../models/CajaModel.js');
const { registrarAuditoria } = require('../utils/auditoria.js');
const { crearVenta } = require('../controllers/ventasController.js');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const cuerpo = (extra = {}) => ({
  folio: 'F-OFF001', total: 30, tipo_venta: 'Tienda', tipo_pago: 'efectivo',
  detalles: [{ producto_id: 9, cantidad: 2, precio_unitario: 15, subtotal: 30 }],
  ...extra
});
const req = (body) => ({ body, query: {}, usuario: { id: 7, empresa_id: 3, sucursal_id: 2, rol: 2 } });

describe('Ventas hechas sin internet', () => {
  let t;
  let venta;
  let stock;

  beforeEach(() => {
    jest.clearAllMocks();
    t = { commit: jest.fn(), rollback: jest.fn() };
    db.transaction.mockResolvedValue(t);
    venta = { venta_id: 77, update: jest.fn().mockResolvedValue(true) };
    Venta.create.mockResolvedValue(venta);
    Venta.findOne.mockResolvedValue(null);
    // Precio actual 20 (en la caja sin internet se cobro a 15) y solo 1 en existencia
    Producto.findOne.mockResolvedValue({ nombre: 'Refresco', precio_menudeo: '20.00', unidad_venta: 'pieza', stock_actual: 1, decrement: jest.fn() });
    stock = { stock_actual: 1, decrement: jest.fn() };
    StockSucursal.findOne.mockResolvedValue(stock);
    Empresa.findByPk.mockResolvedValue({ iva_activo: false, iva_porcentaje: 16 });
    Caja.findOne.mockResolvedValue({ caja_id: 4, fecha_apertura: new Date() });
  });

  test('en linea: un precio distinto se rechaza (sin cambios)', async () => {
    const res = mockRes();
    await crearVenta(req(cuerpo()), res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(t.rollback).toHaveBeenCalled();
  });

  test('sin internet: se acepta el precio del momento, la existencia queda negativa y se avisa', async () => {
    const res = mockRes();
    await crearVenta(req(cuerpo({ offline: true, id_local: 'a1b2c3d4-0001', fecha_local: new Date(Date.now() - 3600000).toISOString() })), res);
    expect(t.commit).toHaveBeenCalled();
    const respuesta = res.json.mock.calls[0][0];
    expect(respuesta.total).toBe(30);
    expect(respuesta.avisos.join(' ')).toMatch(/precio actual distinto/);
    expect(respuesta.avisos.join(' ')).toMatch(/existencia negativa/);
    expect(Venta.create).toHaveBeenCalledWith(expect.objectContaining({ id_local: 'a1b2c3d4-0001' }), expect.anything());
    expect(registrarAuditoria).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ accion: 'VENTA_OFFLINE' }));
  });

  test('si la misma venta se sube dos veces no se duplica', async () => {
    Venta.findOne.mockResolvedValue({ venta_id: 55, folio: 'F-OFF001', total: '30.00' });
    const res = mockRes();
    await crearVenta(req(cuerpo({ offline: true, id_local: 'a1b2c3d4-0001' })), res);
    expect(Venta.create).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ venta_id: 55, duplicada: true }));
  });

  test('offline sin id_local se trata como venta normal', async () => {
    const res = mockRes();
    await crearVenta(req(cuerpo({ offline: true })), res);
    expect(res.status).toHaveBeenCalledWith(409);
  });
});

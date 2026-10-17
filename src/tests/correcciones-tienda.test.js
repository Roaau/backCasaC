const modelo = (...metodos) => ({ __esModule: true, default: Object.fromEntries(metodos.map(m => [m, jest.fn()])) });

jest.mock('../config/database.js', () => ({ __esModule: true, default: { transaction: jest.fn(), query: jest.fn() } }));
jest.mock('../models/Venta.js', () => modelo('findOne'));
jest.mock('../models/DetalleVenta.js', () => modelo('findAll'));
jest.mock('../models/Producto.js', () => modelo('findAndCountAll', 'findAll'));
jest.mock('../models/StockSucursalModel.js', () => modelo('findOne'));
jest.mock('../models/SucursalModel.js', () => modelo('findOne', 'findByPk', 'findAll'));
jest.mock('../models/EmpresaModel.js', () => modelo('findByPk'));
jest.mock('../models/CajaModel.js', () => modelo('findOne'));
jest.mock('../models/MovimientoInventario.js', () => modelo('create'));
jest.mock('../models/MovimientoCaja.js', () => modelo('create'));
jest.mock('../models/Devolucion.js', () => modelo('findAll'));
jest.mock('../models/DetalleDevolucion.js', () => modelo('findAll'));
jest.mock('../models/CfdiVenta.js', () => modelo('create'));
jest.mock('../models/ClienteFiscal.js', () => modelo('findOrCreate'));
jest.mock('../utils/auditoria.js', () => ({ __esModule: true, registrarAuditoria: jest.fn() }));

const { default: db } = require('../config/database.js');
const { default: Sucursal } = require('../models/SucursalModel.js');
const { default: Producto } = require('../models/Producto.js');
const { ventasDeHoy } = require('../controllers/ventasController.js');
const { getAll } = require('../controllers/productosController.js');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('Ventas de hoy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Sucursal.findOne.mockResolvedValue({ sucursal_id: 5, empresa_id: 10, activa: true });
    db.query.mockResolvedValue([
      { venta_id: 1, total: '40.00', tipo_pago: 'efectivo', usuario_id: 7, nombre_cajero: 'Pedro' },
      { venta_id: 2, total: '60.50', tipo_pago: 'tarjeta', usuario_id: 7, nombre_cajero: 'Pedro' },
    ]);
  });

  test('el cajero solo consulta sus propias ventas', async () => {
    const res = mockRes();
    await ventasDeHoy({ usuario: { id: 7, empresa_id: 10, sucursal_id: 5, rol: 2 }, query: {} }, res);

    const [sql, opciones] = db.query.mock.calls[0];
    expect(sql).toContain('v.usuario_id = :usuario_id');
    expect(opciones.replacements).toEqual(expect.objectContaining({ usuario_id: 7, sucursal_id: 5 }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      solo_mias: true,
      resumen: { total: 100.5, conteo: 2, efectivo: 40, terminal: 60.5 },
      por_cajero: [expect.objectContaining({ nombre: 'Pedro', ventas: 2, total: 100.5 })]
    }));
  });

  test('el admin ve todas las de la sucursal', async () => {
    const res = mockRes();
    await ventasDeHoy({ usuario: { id: 1, empresa_id: 10, sucursal_id: 5, rol: 1 }, query: {} }, res);
    expect(db.query.mock.calls[0][0]).not.toContain('v.usuario_id = :usuario_id');
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ solo_mias: false }));
  });
});

describe('Inventario sin productos desactivados', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Sucursal.findOne.mockResolvedValue({ sucursal_id: 5, empresa_id: 10, activa: true });
    Producto.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });
  });

  test('por defecto excluye los desactivados', async () => {
    await getAll({ usuario: { id: 1, empresa_id: 10, sucursal_id: 5, rol: 1 }, query: {} }, mockRes());
    const where = Producto.findAndCountAll.mock.calls[0][0].where;
    expect(where.empresa_id).toBe(10);
    expect(where.activo).toBeDefined();
    expect(where.activo).not.toBe(false);
  });

  test('con inactivos=true lista solo los desactivados', async () => {
    await getAll({ usuario: { id: 1, empresa_id: 10, sucursal_id: 5, rol: 1 }, query: { inactivos: 'true' } }, mockRes());
    expect(Producto.findAndCountAll.mock.calls[0][0].where).toEqual(expect.objectContaining({ empresa_id: 10, activo: false }));
  });
});

describe('Venta por bulto', () => {
  const { cantidadValida, UNIDADES_VENTA } = require('../utils/giros.js');
  const { parsearUnidad } = require('../utils/importarExcel.js');

  test('bulto es una unidad valida y solo acepta enteros', () => {
    expect(UNIDADES_VENTA).toContain('bulto');
    expect(cantidadValida(2, 'bulto')).toBe(true);
    expect(cantidadValida(1.5, 'bulto')).toBe(false);
    expect(cantidadValida(1.5, 'kg')).toBe(true);
  });

  test('el Excel reconoce bulto, costal y saco', () => {
    expect(parsearUnidad('Costal')).toBe('bulto');
    expect(parsearUnidad('bultos')).toBe('bulto');
    expect(parsearUnidad('saco')).toBe('bulto');
  });
});

describe('Inventario: agotados y poca existencia', () => {
  const { Op } = require('sequelize');
  beforeEach(() => {
    jest.clearAllMocks();
    Sucursal.findOne.mockResolvedValue({ sucursal_id: 5, empresa_id: 10, activa: true });
    Producto.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });
    db.literal = jest.fn(sql => ({ sql }));
  });

  const filtro = async (existencia) => {
    await getAll({ usuario: { id: 1, empresa_id: 10, sucursal_id: 5, rol: 1 }, query: { existencia } }, mockRes());
    return Producto.findAndCountAll.mock.calls[0][0].where[Op.and]?.[0]?.sql;
  };

  test('agotados: existencia de la sucursal en 0 o menos', async () => {
    const sql = await filtro('agotados');
    expect(sql).toContain('ss.sucursal_id = 5');
    expect(sql).toMatch(/<= 0$/);
  });

  test('con existencia y poca existencia', async () => {
    expect(await filtro('con')).toMatch(/> 0$/);
    jest.clearAllMocks();
    expect(await filtro('bajo')).toContain('stock_minimo');
  });

  test('sin filtro no restringe la existencia', async () => {
    expect(await filtro(undefined)).toBeUndefined();
  });
});

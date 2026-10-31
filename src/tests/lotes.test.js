jest.mock('../config/database.js', () => ({ __esModule: true, default: { query: jest.fn().mockResolvedValue([]) } }));
jest.mock('../models/Lote.js', () => ({ __esModule: true, default: { findAll: jest.fn(), findOne: jest.fn(), create: jest.fn(), count: jest.fn() } }));
jest.mock('../models/Producto.js', () => ({ __esModule: true, default: { update: jest.fn(), findByPk: jest.fn() } }));
jest.mock('sequelize', () => ({ Op: { gt: Symbol('gt') }, QueryTypes: { SELECT: 'SELECT' } }));

const { default: Lote } = require('../models/Lote.js');
const { default: Producto } = require('../models/Producto.js');
const { descontarLotes, registrarEntradaLote } = require('../utils/lotes.js');
const { fechaLocalISO } = require('../utils/fechas.js');
const { sumarAFecha } = require('../utils/planes.js');

const lote = (lote_id, fecha_caducidad, cantidad) => {
  const l = { lote_id, lote: `L${lote_id}`, fecha_caducidad, cantidad };
  l.update = jest.fn(async (d) => Object.assign(l, d));
  return l;
};

describe('Lotes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Lote.count.mockResolvedValue(1);
  });

  test('la venta descuenta primero el lote vigente que caduca antes y deja los caducados al final', async () => {
    const hoy = fechaLocalISO();
    const caducado = lote(1, sumarAFecha(hoy, { dias: -3 }), 5);
    const pronto = lote(2, sumarAFecha(hoy, { dias: 10 }), 2);
    const despues = lote(3, sumarAFecha(hoy, { dias: 90 }), 10);
    Lote.findAll.mockResolvedValue([despues, caducado, pronto]);

    const usados = await descontarLotes({ producto_id: 1, sucursal_id: 1, cantidad: 4 });
    expect(usados.map(u => [u.lote_id, u.cantidad])).toEqual([[2, 2], [3, 2]]);
    expect(caducado.cantidad).toBe(5);
    expect(pronto.cantidad).toBe(0);
    expect(despues.cantidad).toBe(8);
  });

  test('una salida de un lote elegido que no alcanza se rechaza', async () => {
    Lote.findAll.mockResolvedValue([lote(7, '2027-01-01', 1)]);
    await expect(descontarLotes({ producto_id: 1, sucursal_id: 1, cantidad: 3, lote_id: 7 })).rejects.toThrow('suficiente');
  });

  test('el primer lote guarda lo que ya había con la caducidad anterior', async () => {
    Lote.count.mockResolvedValueOnce(0).mockResolvedValue(2);
    Lote.findOne.mockResolvedValue(null);
    Producto.findByPk.mockResolvedValue({ lote: 'VIEJO', fecha_caducidad: '2026-12-01' });
    await registrarEntradaLote({ empresa_id: 3, producto_id: 1, sucursal_id: 1, lote: 'A1', fecha_caducidad: '2027-06-01', cantidad: 10, existenciaPrevia: 4 });
    expect(Lote.create).toHaveBeenNthCalledWith(1, expect.objectContaining({ lote: 'VIEJO', fecha_caducidad: '2026-12-01', cantidad: 4 }), expect.anything());
    expect(Lote.create).toHaveBeenNthCalledWith(2, expect.objectContaining({ lote: 'A1', fecha_caducidad: '2027-06-01', cantidad: 10 }), expect.anything());
  });

  test('sin lote ni caducidad no crea nada', async () => {
    expect(await registrarEntradaLote({ empresa_id: 3, producto_id: 1, sucursal_id: 1, cantidad: 5 })).toBeNull();
    expect(Lote.create).not.toHaveBeenCalled();
  });
});

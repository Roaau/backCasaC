jest.mock('sequelize', () => ({
  Op: { or: 'OR', contains: 'CONTAINS' },
  QueryTypes: { SELECT: 'SELECT' }
}));

jest.mock('../config/database.js', () => ({
  __esModule: true,
  default: { query: jest.fn(), QueryTypes: { SELECT: 'SELECT' } }
}));

jest.mock('../models/EmpresaModel.js', () => ({
  __esModule: true,
  default: { findByPk: jest.fn(), findAll: jest.fn() }
}));

jest.mock('../models/SucursalModel.js', () => ({
  __esModule: true,
  default: { count: jest.fn(), findAll: jest.fn(), findByPk: jest.fn() }
}));

jest.mock('../models/Usuario.js', () => ({
  __esModule: true,
  default: { count: jest.fn(), findAll: jest.fn(), findByPk: jest.fn() }
}));

jest.mock('../models/Venta.js', () => ({
  __esModule: true,
  default: { findAll: jest.fn() }
}));

jest.mock('../models/MovimientoInventario.js', () => ({
  __esModule: true,
  default: { findAll: jest.fn() }
}));

jest.mock('../models/CatalogoMaestro.js', () => ({
  __esModule: true,
  default: { count: jest.fn(), destroy: jest.fn(), bulkCreate: jest.fn() }
}));

jest.mock('../models/CatalogoGiro.js', () => ({
  __esModule: true,
  default: { findAll: jest.fn(), findByPk: jest.fn(), create: jest.fn() }
}));

jest.mock('../models/Auditoria.js', () => ({
  __esModule: true,
  default: { findAll: jest.fn() }
}));

jest.mock('../services/emailService.js', () => ({
  notificarEmpresaAprobada: jest.fn(),
  notificarEmpresaRechazada: jest.fn(),
  notificarEmpresaSuspendida: jest.fn()
}));

jest.mock('../utils/auditoria.js', () => ({
  registrarAuditoria: jest.fn()
}));

jest.mock('multer', () => {
  const m = () => ({ single: () => jest.fn() });
  m.memoryStorage = jest.fn();
  return m;
});

jest.mock('xlsx', () => ({ read: jest.fn(), utils: { sheet_to_json: jest.fn() } }));

const { default: Empresa } = require('../models/EmpresaModel.js');
const { default: Auditoria } = require('../models/Auditoria.js');
const { registrarAuditoria } = require('../utils/auditoria.js');
const { actualizarComercial, listarAuditoriaSuperadmin, aprobarEmpresa, registrarPago } = require('../controllers/superadminController.js');
const { fechaLocalISO } = require('../utils/fechas.js');
const { sumarAFecha } = require('../utils/planes.js');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const empresaBase = () => ({
  empresa_id: 7,
  razon_social: 'Cliente Prueba',
  plan: 'basico',
  precio_mensual: '700.00',
  fecha_vencimiento: null,
  limite_sucursales: 1,
  limite_usuarios: 5,
  estado: 'activa',
  notas_admin: null,
  update: jest.fn().mockResolvedValue(true)
});

describe('Superadmin comercial', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('rechaza plan invalido', async () => {
    Empresa.findByPk.mockResolvedValue(empresaBase());
    const req = { params: { id: '7' }, body: { plan: 'gratis-total' }, usuario: { id: 1, es_superadmin: true } };
    const res = mockRes();

    await actualizarComercial(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Plan no valido' });
  });

  test('rechaza precio negativo', async () => {
    Empresa.findByPk.mockResolvedValue(empresaBase());
    const req = { params: { id: '7' }, body: { precio_mensual: -1 }, usuario: { id: 1, es_superadmin: true } };
    const res = mockRes();

    await actualizarComercial(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Precio mensual invalido' });
  });

  test('permite dar descuento en el precio (ya no hay minimo fijo)', async () => {
    const empresa = empresaBase();
    Empresa.findByPk.mockResolvedValue(empresa);
    const res = mockRes();
    await actualizarComercial({ params: { id: '7' }, body: { plan: 'basico', precio_mensual: 299, limite_sucursales: 1 }, usuario: { id: 1 } }, res);
    expect(empresa.update).toHaveBeenCalledWith(expect.objectContaining({ precio_mensual: 299 }));
  });

  test('rechaza multi-sucursal con menos de 3 sucursales', async () => {
    Empresa.findByPk.mockResolvedValue(empresaBase());
    const res = mockRes();
    await actualizarComercial({ params: { id: '7' }, body: { plan: 'multisucursal', limite_sucursales: 2 }, usuario: { id: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('al aprobar empieza la prueba de 30 dias y aplica el bono de referido a los dos', async () => {
    const hoy = fechaLocalISO();
    const nueva = { ...empresaBase(), estado: 'pendiente', referido_por: 3, bono_referido_aplicado: false };
    const quienRecomendo = { empresa_id: 3, razon_social: 'Amigo', fecha_vencimiento: null, update: jest.fn() };
    Empresa.findByPk.mockImplementation(async (id) => (String(id) === '3' ? quienRecomendo : nueva));
    const res = mockRes();

    await aprobarEmpresa({ params: { id: '7' }, body: {}, usuario: { id: 1 } }, res);

    expect(nueva.update).toHaveBeenCalledWith(expect.objectContaining({
      estado: 'activa',
      fecha_vencimiento: sumarAFecha(hoy, { dias: 60 }),
      bono_referido_aplicado: true
    }));
    expect(quienRecomendo.update).toHaveBeenCalledWith({ fecha_vencimiento: sumarAFecha(hoy, { dias: 30 }) });
  });

  test('registrar pago extiende desde el vencimiento si aun no vence y reactiva vencidas', async () => {
    const futura = sumarAFecha(fechaLocalISO(), { dias: 5 });
    const anual = { ...empresaBase(), periodo_pago: 'anual', fecha_vencimiento: futura };
    Empresa.findByPk.mockResolvedValue(anual);
    let res = mockRes();
    await registrarPago({ params: { id: '7' }, body: {}, usuario: { id: 1 } }, res);
    expect(anual.update).toHaveBeenCalledWith(expect.objectContaining({ fecha_vencimiento: sumarAFecha(futura, { meses: 12 }) }));

    const vencida = { ...empresaBase(), estado: 'vencida', fecha_vencimiento: '2020-01-01' };
    Empresa.findByPk.mockResolvedValue(vencida);
    res = mockRes();
    await registrarPago({ params: { id: '7' }, body: { meses: 1 }, usuario: { id: 1 } }, res);
    expect(vencida.update).toHaveBeenCalledWith(expect.objectContaining({
      estado: 'activa',
      fecha_vencimiento: sumarAFecha(fechaLocalISO(), { meses: 1 })
    }));
  });

  test('actualiza plan y registra auditoria', async () => {
    const empresa = empresaBase();
    Empresa.findByPk.mockResolvedValue(empresa);
    const req = {
      params: { id: '7' },
      body: {
        plan: 'pro',
        precio_mensual: 1400,
        fecha_vencimiento: '2026-08-04',
        limite_sucursales: 2,
        limite_usuarios: 10,
        estado: 'activa',
        notas: 'Pago mensual manual'
      },
      usuario: { id: 1, es_superadmin: true },
      headers: {}
    };
    const res = mockRes();

    await actualizarComercial(req, res);

    expect(empresa.update).toHaveBeenCalledWith(expect.objectContaining({
      plan: 'pro',
      precio_mensual: 1400,
      fecha_vencimiento: '2026-08-04',
      limite_sucursales: 2,
      limite_usuarios: 10,
      estado: 'activa',
      notas_admin: 'Pago mensual manual'
    }));
    expect(registrarAuditoria).toHaveBeenCalledWith(req, expect.objectContaining({
      accion: 'SUPERADMIN_EMPRESA_COMERCIAL',
      entidad: 'superadmin_empresas',
      entidad_id: 7
    }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      mensaje: 'Configuracion comercial actualizada'
    }));
  });

  test('lista auditoria global reciente para superadmin', async () => {
    Auditoria.findAll.mockResolvedValue([
      { toJSON: () => ({ auditoria_id: 1, accion: 'SUPERADMIN_EMPRESA_COMERCIAL' }) }
    ]);
    const req = { query: {}, usuario: { id: 1, es_superadmin: true } };
    const res = mockRes();

    await listarAuditoriaSuperadmin(req, res);

    expect(Auditoria.findAll).toHaveBeenCalledWith(expect.objectContaining({
      where: {},
      limit: 40,
      order: [['fecha', 'DESC']]
    }));
    expect(res.json).toHaveBeenCalledWith([{ auditoria_id: 1, accion: 'SUPERADMIN_EMPRESA_COMERCIAL' }]);
  });

  test('filtra auditoria por empresa y limita resultados', async () => {
    Auditoria.findAll.mockResolvedValue([]);
    const req = { query: { empresa_id: '7', limit: '200' }, usuario: { id: 1, es_superadmin: true } };
    const res = mockRes();

    await listarAuditoriaSuperadmin(req, res);

    expect(Auditoria.findAll).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        OR: [
          { empresa_id: 7 },
          { detalle: { CONTAINS: { empresa_id: 7 } } }
        ]
      }),
      limit: 100
    }));
    expect(res.json).toHaveBeenCalledWith([]);
  });
});

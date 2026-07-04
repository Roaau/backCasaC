jest.mock('sequelize', () => ({
  Op: {},
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

jest.mock('../services/emailService.js', () => ({
  notificarEmpresaAprobada: jest.fn(),
  notificarEmpresaRechazada: jest.fn()
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
const { registrarAuditoria } = require('../utils/auditoria.js');
const { actualizarComercial } = require('../controllers/superadminController.js');

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
  precio_mensual: '599.00',
  fecha_vencimiento: null,
  limite_sucursales: 1,
  limite_usuarios: 2,
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

  test('actualiza plan y registra auditoria', async () => {
    const empresa = empresaBase();
    Empresa.findByPk.mockResolvedValue(empresa);
    const req = {
      params: { id: '7' },
      body: {
        plan: 'pro',
        precio_mensual: 999,
        fecha_vencimiento: '2026-08-04',
        limite_sucursales: 3,
        limite_usuarios: 8,
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
      precio_mensual: 999,
      fecha_vencimiento: '2026-08-04',
      limite_sucursales: 3,
      limite_usuarios: 8,
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
});

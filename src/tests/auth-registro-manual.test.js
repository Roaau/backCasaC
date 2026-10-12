jest.mock('../models/Usuario.js', () => ({
  __esModule: true,
  default: { findOne: jest.fn(), create: jest.fn() }
}));

jest.mock('../models/EmpresaModel.js', () => ({
  __esModule: true,
  default: { findOne: jest.fn(), create: jest.fn(), findByPk: jest.fn() }
}));

jest.mock('../models/SucursalModel.js', () => ({
  __esModule: true,
  default: { findOne: jest.fn(), create: jest.fn(), findByPk: jest.fn() }
}));

jest.mock('../models/CodigoInvitacion.js', () => ({
  __esModule: true,
  default: { findOne: jest.fn(), update: jest.fn() }
}));

jest.mock('../models/SolicitudRegistro.js', () => ({
  __esModule: true,
  default: { findOne: jest.fn(), update: jest.fn(), destroy: jest.fn(), create: jest.fn() }
}));

jest.mock('../models/SolicitudReset.js', () => ({
  __esModule: true,
  default: { findOne: jest.fn(), update: jest.fn(), destroy: jest.fn(), create: jest.fn() }
}));

const mockTransaction = {
  commit: jest.fn(),
  rollback: jest.fn()
};

jest.mock('../config/database.js', () => ({
  __esModule: true,
  default: { transaction: jest.fn(() => mockTransaction), query: jest.fn(), authenticate: jest.fn() }
}));

jest.mock('bcrypt', () => ({
  __esModule: true,
  default: { compare: jest.fn(), hash: jest.fn().mockResolvedValue('hash') }
}));

jest.mock('jsonwebtoken', () => ({
  __esModule: true,
  default: { sign: jest.fn(), verify: jest.fn() }
}));

jest.mock('sequelize', () => ({
  Op: { gt: Symbol('gt'), lt: Symbol('lt') },
  QueryTypes: { SELECT: 'SELECT' }
}));

jest.mock('../services/emailService.js', () => ({
  enviarCodigoRegistro: jest.fn(),
  enviarCodigoReset: jest.fn(),
  notificarNuevaEmpresa: jest.fn().mockResolvedValue(true),
  notificarEmpresaRegistrada: jest.fn().mockResolvedValue(true)
}));

jest.mock('../utils/planLimits.js', () => ({
  validarLimiteUsuarios: jest.fn()
}));

const { default: Usuario } = require('../models/Usuario.js');
const { default: Empresa } = require('../models/EmpresaModel.js');
const { default: Sucursal } = require('../models/SucursalModel.js');
const { default: SolicitudRegistro } = require('../models/SolicitudRegistro.js');
const { registro } = require('../controllers/authController.js');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('Auth registro con aprobacion manual', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTransaction.commit.mockClear();
    mockTransaction.rollback.mockClear();
  });

  test('crea empresa pendiente y calcula el plan en el servidor aunque el navegador mande otros datos', async () => {
    Usuario.findOne.mockResolvedValue(null);
    Empresa.findOne.mockResolvedValue(null);
    SolicitudRegistro.findOne.mockResolvedValue({ id: 55 });
    Empresa.create.mockResolvedValue({
      empresa_id: 10,
      razon_social: 'Cliente Pro',
      rfc: null,
      email_contacto: 'cliente@test.com'
    });
    Sucursal.create.mockResolvedValue({ sucursal_id: 20 });
    Usuario.create.mockResolvedValue({ usuario_id: 30 });
    Empresa.findByPk.mockResolvedValue({
      razon_social: 'Cliente Pro',
      rfc: null,
      email_contacto: 'cliente@test.com',
      plan: 'pro',
      precio_mensual: 1400,
      limite_sucursales: 2,
      limite_usuarios: 10,
      estado: 'pendiente'
    });

    const res = mockRes();
    await registro({
      body: {
        nombre: 'Cliente Pro',
        usuario: 'clientepro',
        contrasena: 'Clave1234',
        email: 'cliente@test.com',
        codigo_verificacion: '123456',
        plan: 'pro',
        precio_mensual: 1,
        limite_sucursales: 99,
        limite_usuarios: 99,
        estado_inicial: 'prueba'
      }
    }, res);

    // Precio y limites de la lista (utils/planes.js), ignorando precio_mensual/limites del body
    expect(Empresa.create).toHaveBeenCalledWith(expect.objectContaining({
      estado: 'pendiente',
      plan: 'pro',
      precio_mensual: 1199,
      limite_sucursales: 2,
      limite_usuarios: 10,
      periodo_pago: 'mensual'
    }), expect.objectContaining({ transaction: mockTransaction }));
    expect(mockTransaction.commit).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

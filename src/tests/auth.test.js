// __esModule: true en cada mock para que Babel's _interopRequireDefault no doble-envuelva el default
jest.mock('../models/Usuario.js',          () => ({ __esModule: true, default: { findOne: jest.fn() } }));
jest.mock('../models/EmpresaModel.js',     () => ({ __esModule: true, default: { findByPk: jest.fn(), findOne: jest.fn() } }));
jest.mock('../models/SucursalModel.js',    () => ({ __esModule: true, default: { findOne: jest.fn(), findByPk: jest.fn(), findAll: jest.fn() } }));
jest.mock('../models/CodigoInvitacion.js', () => ({ __esModule: true, default: { findOne: jest.fn(), create: jest.fn(), update: jest.fn() } }));
jest.mock('../models/SolicitudRegistro.js',() => ({ __esModule: true, default: { findOne: jest.fn(), create: jest.fn(), update: jest.fn(), destroy: jest.fn() } }));
jest.mock('../models/SolicitudReset.js',   () => ({ __esModule: true, default: { findOne: jest.fn(), create: jest.fn(), update: jest.fn(), destroy: jest.fn() } }));
jest.mock('../config/database.js',         () => ({ __esModule: true, default: { query: jest.fn(), authenticate: jest.fn() } }));
jest.mock('bcrypt',                        () => ({ __esModule: true, default: { compare: jest.fn(), hash: jest.fn() } }));
jest.mock('jsonwebtoken',                  () => ({ __esModule: true, default: { sign: jest.fn(), verify: jest.fn() } }));
jest.mock('sequelize', () => ({
  Op: { or: Symbol('or'), like: Symbol('like'), gt: Symbol('gt'), lt: Symbol('lt'), iLike: Symbol('iLike') },
  DataTypes: {},
  QueryTypes: { SELECT: 'SELECT' }
}));
jest.mock('../services/emailService.js', () => ({
  enviarCodigoRegistro:  jest.fn().mockResolvedValue(true),
  enviarCodigoReset:     jest.fn().mockResolvedValue(true),
  notificarNuevaEmpresa: jest.fn().mockResolvedValue(true)
}));

const { default: Usuario }    = require('../models/Usuario.js');
const { default: Empresa }    = require('../models/EmpresaModel.js');
const { default: Sucursal }   = require('../models/SucursalModel.js');
const { default: bcrypt }     = require('bcrypt');
const { default: jwt }        = require('jsonwebtoken');
const { login }               = require('../controllers/authController.js');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
};

describe('Auth — login()', () => {
  beforeEach(() => jest.clearAllMocks());

  test('devuelve 400 si faltan credenciales', async () => {
    const res = mockRes();
    await login({ body: { usuario: '', contrasena: '' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('devuelve 401 si el usuario no existe', async () => {
    Usuario.findOne.mockResolvedValue(null);
    const res = mockRes();
    await login({ body: { usuario: 'noexiste', contrasena: '123' } }, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ mensaje: expect.any(String) }));
  });

  test('devuelve 401 si la contraseña es incorrecta', async () => {
    Usuario.findOne.mockResolvedValue({
      usuario_id: 1, usuario: 'admin', contrasena: 'hash', activo: true, empresa_id: 1, es_superadmin: false
    });
    bcrypt.compare.mockResolvedValue(false);
    const res = mockRes();
    await login({ body: { usuario: 'admin', contrasena: 'wrong' } }, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('retorna token si las credenciales son correctas', async () => {
    Usuario.findOne.mockResolvedValue({
      usuario_id: 1, usuario: 'admin', nombre: 'Administrador',
      contrasena: 'hash', activo: true, empresa_id: 1, sucursal_id: 1,
      rol_id: 1, es_admin: true, es_superadmin: false, foto_perfil: null, color_tema: null
    });
    bcrypt.compare.mockResolvedValue(true);
    jwt.sign.mockReturnValue('token-jwt-fake');
    Sucursal.findByPk.mockResolvedValue({ nombre: 'Principal', cp_sat: '06600', logo_b64: null });
    Empresa.findByPk.mockResolvedValue({ estado: 'activa', logo_empresa: null, razon_social: 'TestCo' });
    const res = mockRes();
    await login({ body: { usuario: 'admin', contrasena: 'correcta' } }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ token: 'token-jwt-fake' }));
  });
});

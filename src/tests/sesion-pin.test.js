jest.mock('../config/database.js', () => ({ __esModule: true, default: { query: jest.fn() } }));
jest.mock('../models/EmpresaModel.js', () => ({ __esModule: true, default: { findByPk: jest.fn() } }));
jest.mock('../models/SucursalModel.js', () => ({ __esModule: true, default: { findOne: jest.fn(), findAll: jest.fn() } }));
jest.mock('../utils/auditoria.js', () => ({ registrarAuditoria: jest.fn().mockResolvedValue(true) }));
jest.mock('jsonwebtoken', () => ({ __esModule: true, default: { verify: jest.fn() } }));
jest.mock('bcrypt', () => ({ __esModule: true, default: { compare: jest.fn() } }));
jest.mock('sequelize', () => ({ QueryTypes: { SELECT: 'SELECT' }, Op: {} }));

const { default: sequelize } = require('../config/database.js');
const { default: Empresa } = require('../models/EmpresaModel.js');
const { default: jwt } = require('jsonwebtoken');
const { default: bcrypt } = require('bcrypt');
const { verificarToken, limpiarCacheSesion } = require('../middleware/authMiddleware.js');
const { requierePin, limpiarCachePin, generarPin } = require('../middleware/pinAutorizacion.js');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const filaActiva = (extra = {}) => ({
  usuario_id: 7, activo: true, rol_id: 2, empresa_id: 10, sucursal_id: 3, es_superadmin: false,
  sesion_version: 0, empresa_estado: 'activa', fecha_vencimiento: null, ...extra
});

describe('verificarToken - revision de sesion en BD', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    limpiarCacheSesion();
  });

  const correr = async (fila, payload = { id: 7, sv: 0 }) => {
    jwt.verify.mockReturnValue(payload);
    sequelize.query.mockResolvedValue(fila ? [fila] : []);
    const req = { headers: { authorization: 'Bearer abc' } };
    const res = mockRes();
    const next = jest.fn();
    await verificarToken(req, res, next);
    return { req, res, next };
  };

  test('deja pasar y toma rol/empresa/sucursal de la BD', async () => {
    const { req, next } = await correr(filaActiva({ rol_id: 1, sucursal_id: 5 }), { id: 7, rol: 2, sucursal_id: 3, sv: 0 });
    expect(next).toHaveBeenCalled();
    expect(req.usuario).toEqual(expect.objectContaining({ id: 7, rol: 1, empresa_id: 10, sucursal_id: 5 }));
  });

  test('usuario desactivado sale de inmediato', async () => {
    const { res, next } = await correr(filaActiva({ activo: false }));
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ codigo: 'SESION_INVALIDA' }));
  });

  test('negocio suspendido sale de inmediato', async () => {
    const { res } = await correr(filaActiva({ empresa_estado: 'suspendida' }));
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('negocio vencido sale de inmediato', async () => {
    const { res } = await correr(filaActiva({ fecha_vencimiento: '2020-01-01' }));
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('token de una sesion cerrada (sesion_version distinta) se rechaza', async () => {
    const { res } = await correr(filaActiva({ sesion_version: 2 }), { id: 7, sv: 1 });
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('token vencido o invalido devuelve 401', async () => {
    jwt.verify.mockImplementation(() => { throw new Error('jwt expired'); });
    const res = mockRes();
    const next = jest.fn();
    await verificarToken({ headers: { authorization: 'Bearer x' } }, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('requierePin - PIN de autorizacion del dueno', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    limpiarCachePin();
  });

  const correr = async ({ usuario, pin, activo = true, condicion, id = Math.floor(Math.random() * 1e6) }) => {
    Empresa.findByPk.mockResolvedValue({ empresa_id: 10, pin_autorizacion_activo: activo, pin_autorizacion_hash: 'hash' });
    const req = { usuario: { id, rol: 2, empresa_id: 10, ...usuario }, headers: pin ? { 'x-pin-autorizacion': pin } : {}, body: {} };
    const res = mockRes();
    const next = jest.fn();
    await requierePin('Devolucion', condicion)(req, res, next);
    return { res, next };
  };

  test('admin nunca necesita PIN', async () => {
    const { next } = await correr({ usuario: { rol: 1 } });
    expect(next).toHaveBeenCalled();
    expect(Empresa.findByPk).not.toHaveBeenCalled();
  });

  test('si el PIN esta apagado el empleado pasa normal', async () => {
    const { next } = await correr({ activo: false });
    expect(next).toHaveBeenCalled();
  });

  test('si esta activo y no manda PIN responde PIN_REQUERIDO', async () => {
    const { res, next } = await correr({});
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ codigo: 'PIN_REQUERIDO' }));
  });

  test('PIN correcto deja pasar', async () => {
    bcrypt.compare.mockResolvedValue(true);
    const { next } = await correr({ pin: '123456' });
    expect(next).toHaveBeenCalled();
  });

  test('PIN incorrecto responde PIN_INCORRECTO', async () => {
    bcrypt.compare.mockResolvedValue(false);
    const { res } = await correr({ pin: '000000' });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ codigo: 'PIN_INCORRECTO' }));
  });

  test('5 PIN incorrectos bloquean al empleado', async () => {
    bcrypt.compare.mockResolvedValue(false);
    for (let i = 0; i < 5; i++) await correr({ pin: '000000', id: 99 });
    bcrypt.compare.mockResolvedValue(true);
    const { res, next } = await correr({ pin: '123456', id: 99 });
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(429);
  });

  test('la condicion decide si se pide el PIN', async () => {
    const { next } = await correr({ condicion: () => false });
    expect(next).toHaveBeenCalled();
  });

  test('generarPin siempre da 6 digitos', () => {
    for (let i = 0; i < 50; i++) expect(generarPin()).toMatch(/^\d{6}$/);
  });
});

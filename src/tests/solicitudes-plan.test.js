const modelo = (...metodos) => ({ __esModule: true, default: Object.fromEntries(metodos.map(m => [m, jest.fn()])) });

jest.mock('../config/database.js', () => ({ __esModule: true, default: { transaction: jest.fn() } }));
jest.mock('../models/EmpresaModel.js', () => modelo('findByPk', 'count'));
jest.mock('../models/Usuario.js', () => modelo('count'));
jest.mock('../models/SucursalModel.js', () => modelo('count'));
jest.mock('../models/SolicitudPlan.js', () => modelo('findOne', 'findAll', 'create'));
jest.mock('../models/PagoEmpresa.js', () => modelo('findOne'));
jest.mock('../models/PlataformaConfig.js', () => ({ __esModule: true, default: {}, CLAVES_PAGO: [], datosDePago: jest.fn() }));
jest.mock('../utils/auditoria.js', () => ({ __esModule: true, registrarAuditoria: jest.fn() }));
jest.mock('../services/emailService.js', () => ({ __esModule: true, notificarNuevaSolicitudPlan: jest.fn(() => Promise.resolve()) }));

const { default: Empresa } = require('../models/EmpresaModel.js');
const { default: SolicitudPlan } = require('../models/SolicitudPlan.js');
const { calcularSolicitud, crearSolicitud, montoPorPeriodo } = require('../controllers/planClienteController.js');

const tiendita = () => ({
  empresa_id: 4, razon_social: 'Abarrotes Lupita', giro: 'abarrotes', nivel: 'esencial',
  plan: 'basico', periodo_pago: 'mensual', limite_sucursales: 1, limite_usuarios: 2, usuarios_extra: 0, precio_mensual: '349.00'
});

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('Solicitudes de plan', () => {
  beforeEach(() => jest.clearAllMocks());

  test('usuarios extra suman al precio actual (respeta descuentos) y al limite', () => {
    const calc = calcularSolicitud({ ...tiendita(), precio_mensual: '300.00' }, { tipo: 'usuarios_extra', cantidad: 2 });
    expect(calc).toEqual(expect.objectContaining({ limite_usuarios_nuevo: 4, usuarios_extra_nuevo: 2, precio_nuevo: 498 }));
  });

  test('cambiar a Pro usa el precio de lista y conserva los usuarios extra que ya pagaba', () => {
    const calc = calcularSolicitud({ ...tiendita(), usuarios_extra: 1, limite_usuarios: 3 }, { tipo: 'cambio_plan', plan: 'pro' });
    expect(calc).toEqual(expect.objectContaining({ plan_nuevo: 'pro', limite_sucursales_nuevo: 2, limite_usuarios_nuevo: 11, precio_nuevo: 1199 + 99 }));
  });

  test('no permite bajar de plan ni pedir lo mismo', () => {
    expect(() => calcularSolicitud({ ...tiendita(), plan: 'pro' }, { tipo: 'cambio_plan', plan: 'pro' })).toThrow('no aumenta');
    expect(() => calcularSolicitud({ ...tiendita(), plan: 'multisucursal', limite_sucursales: 3 }, { tipo: 'cambio_plan', plan: 'pro' })).toThrow('no aumenta');
  });

  test('pago anual: mismo precio mensual, paga 10 meses', () => {
    const calc = calcularSolicitud(tiendita(), { tipo: 'periodo' });
    expect(calc).toEqual(expect.objectContaining({ periodo_nuevo: 'anual', precio_nuevo: 349 }));
    expect(montoPorPeriodo(349, 'anual')).toBe(3490);
    expect(() => calcularSolicitud({ ...tiendita(), periodo_pago: 'anual' }, { tipo: 'periodo' })).toThrow('anual');
  });

  test('tope de usuarios extra', () => {
    expect(() => calcularSolicitud({ ...tiendita(), usuarios_extra: 19 }, { tipo: 'usuarios_extra', cantidad: 2 })).toThrow('hasta 20');
  });

  test('solo una solicitud pendiente a la vez', async () => {
    Empresa.findByPk.mockResolvedValue(tiendita());
    SolicitudPlan.findOne.mockResolvedValue({ descripcion: 'Agregar 1 usuario extra' });
    const res = mockRes();
    await crearSolicitud({ usuario: { id: 9, empresa_id: 4, rol: 1 }, body: { tipo: 'periodo' } }, res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(SolicitudPlan.create).not.toHaveBeenCalled();
  });

  test('crea la solicitud con lo calculado en el servidor, no con precios del navegador', async () => {
    Empresa.findByPk.mockResolvedValue(tiendita());
    SolicitudPlan.findOne.mockResolvedValue(null);
    SolicitudPlan.create.mockImplementation(async (d) => ({ solicitud_id: 1, ...d }));
    const res = mockRes();
    await crearSolicitud({ usuario: { id: 9, empresa_id: 4, rol: 1 }, body: { tipo: 'usuarios_extra', cantidad: 1, precio_nuevo: 1 } }, res);
    expect(SolicitudPlan.create).toHaveBeenCalledWith(expect.objectContaining({ empresa_id: 4, precio_nuevo: 448 }));
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

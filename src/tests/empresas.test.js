jest.mock('../models/EmpresaModel.js', () => ({
  __esModule: true,
  default: { findAll: jest.fn(), findOne: jest.fn(), update: jest.fn() }
}));

const { default: Empresa } = require('../models/EmpresaModel.js');
const { getMiPlan, updateEmpresa } = require('../controllers/empresasController.js');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('Empresas - panel cliente y seguridad', () => {
  beforeEach(() => jest.clearAllMocks());

  test('mi-plan consulta solo la empresa del token', async () => {
    Empresa.findOne.mockResolvedValue({
      empresa_id: 12,
      razon_social: 'Cliente',
      estado: 'activa',
      plan: 'pro',
      precio_mensual: '1400.00',
      fecha_vencimiento: '2026-08-01',
      limite_sucursales: 2,
      limite_usuarios: 10,
      email_contacto: 'cliente@test.com'
    });
    const req = { usuario: { empresa_id: 12 } };
    const res = mockRes();

    await getMiPlan(req, res);

    expect(Empresa.findOne).toHaveBeenCalledWith(expect.objectContaining({
      where: { empresa_id: 12, activo: true }
    }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      empresa_id: 12,
      plan: 'pro'
    }));
  });

  test('updateEmpresa solo permite campos editables por cliente', async () => {
    Empresa.update.mockResolvedValue([1]);
    const req = {
      usuario: { empresa_id: 12 },
      body: {
        logo_empresa: 'data:image/png;base64,abc',
        plan: 'multisucursal',
        precio_mensual: 1,
        estado: 'activa'
      }
    };
    const res = mockRes();

    await updateEmpresa(req, res);

    expect(Empresa.update).toHaveBeenCalledWith(
      { logo_empresa: 'data:image/png;base64,abc' },
      { where: { empresa_id: 12 } }
    );
    expect(res.json).toHaveBeenCalledWith({ mensaje: 'Empresa actualizada' });
  });

  test('updateEmpresa rechaza requests sin campos permitidos', async () => {
    const req = {
      usuario: { empresa_id: 12 },
      body: { plan: 'pro', precio_mensual: 1400 }
    };
    const res = mockRes();

    await updateEmpresa(req, res);

    expect(Empresa.update).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'No hay campos validos para actualizar' });
  });
});

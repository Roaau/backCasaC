jest.mock('../models/EmpresaModel.js', () => ({
  __esModule: true,
  default: { findByPk: jest.fn() }
}));

jest.mock('../models/SucursalModel.js', () => ({
  __esModule: true,
  default: { count: jest.fn() }
}));

jest.mock('../models/Usuario.js', () => ({
  __esModule: true,
  default: { count: jest.fn() }
}));

const { default: Empresa } = require('../models/EmpresaModel.js');
const { default: Usuario } = require('../models/Usuario.js');
const { validarLimiteUsuarios } = require('../utils/planLimits.js');

describe('Limites comerciales por plan', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('permite crear usuario si la empresa sigue dentro del limite', async () => {
    Empresa.findByPk.mockResolvedValue({ empresa_id: 10, plan: 'pro', limite_usuarios: 10 });
    Usuario.count.mockResolvedValue(3);

    await expect(validarLimiteUsuarios(10, 1)).resolves.toBeUndefined();

    expect(Usuario.count).toHaveBeenCalledWith(expect.objectContaining({
      where: { empresa_id: 10, es_superadmin: false, activo: true }
    }));
  });

  test('bloquea crear usuario si rebasa el limite del plan', async () => {
    Empresa.findByPk.mockResolvedValue({ empresa_id: 10, plan: 'basico', limite_usuarios: 5 });
    Usuario.count.mockResolvedValue(5);

    await expect(validarLimiteUsuarios(10, 1)).rejects.toMatchObject({
      status: 403,
      message: 'Tu plan llego al limite de usuarios activos.'
    });
  });
});

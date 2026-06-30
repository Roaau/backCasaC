jest.mock('sequelize', () => ({
  Op: { in: Symbol('in') }
}));

jest.mock('../models/SucursalModel.js', () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
    findAll: jest.fn()
  }
}));

const { Op } = require('sequelize');
const { default: Sucursal } = require('../models/SucursalModel.js');
const {
  resolverSucursalOperativa,
  resolverScopeSucursales,
  validarSucursalEmpresa
} = require('../utils/scope.js');
const { filtroEmpresa } = require('../utils/filtros.js');

describe('Seguridad multisucursal - scope central', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('empleado no puede operar una sucursal distinta a la asignada', async () => {
    Sucursal.findOne.mockResolvedValue({ sucursal_id: 2, empresa_id: 10 });

    await expect(validarSucursalEmpresa(
      { id: 7, rol: 2, empresa_id: 10, sucursal_id: 1 },
      2
    )).rejects.toMatchObject({
      status: 403,
      message: 'No tienes permiso para operar esta sucursal'
    });
  });

  test('admin puede operar otra sucursal solo si pertenece a su empresa', async () => {
    Sucursal.findOne.mockResolvedValue({ sucursal_id: 2, empresa_id: 10 });

    const sucursalId = await resolverSucursalOperativa({
      body: { sucursal_id: 2 },
      query: {},
      usuario: { id: 7, rol: 1, empresa_id: 10, sucursal_id: 1 }
    });

    expect(sucursalId).toBe(2);
    expect(Sucursal.findOne).toHaveBeenCalledWith(expect.objectContaining({
      where: { sucursal_id: 2, empresa_id: 10, activa: true }
    }));
  });

  test('admin no puede operar sucursal inexistente o de otra empresa', async () => {
    Sucursal.findOne.mockResolvedValue(null);

    await expect(resolverSucursalOperativa({
      body: { sucursal_id: 99 },
      query: {},
      usuario: { id: 7, rol: 1, empresa_id: 10, sucursal_id: 1 }
    })).rejects.toMatchObject({
      status: 403,
      message: 'La sucursal no pertenece a tu empresa o esta inactiva'
    });
  });

  test('empleado no puede activar modo todas_sucursales', async () => {
    await expect(resolverScopeSucursales({
      body: { todas_sucursales: true },
      query: {},
      usuario: { id: 9, rol: 2, empresa_id: 10, sucursal_id: 1 }
    })).rejects.toMatchObject({
      status: 403,
      message: 'Solo el administrador puede consultar todas sus sucursales'
    });
  });

  test('admin puede activar modo todas_sucursales solo dentro de su empresa', async () => {
    Sucursal.findAll.mockResolvedValue([{ sucursal_id: 1 }, { sucursal_id: 2 }]);

    const scope = await resolverScopeSucursales({
      body: { todas_sucursales: 'true' },
      query: {},
      usuario: { id: 3, rol: 1, empresa_id: 10, sucursal_id: 1 }
    });

    expect(scope).toMatchObject({
      empresa_id: 10,
      todas: true,
      sucursalIds: [1, 2]
    });
    expect(scope.whereSucursal).toEqual({ [Op.in]: [1, 2] });
    expect(Sucursal.findAll).toHaveBeenCalledWith(expect.objectContaining({
      where: { empresa_id: 10, activa: true }
    }));
  });

  test('token sin empresa_id se rechaza para usuarios normales', async () => {
    await expect(resolverSucursalOperativa({
      body: { sucursal_id: 1 },
      query: {},
      usuario: { id: 4, rol: 2, sucursal_id: 1 }
    })).rejects.toMatchObject({
      status: 401,
      message: 'El token no incluye empresa_id valido'
    });
  });
});

describe('Seguridad multisucursal - filtros SQL', () => {
  test('empleado queda forzado a su sucursal aunque mande otra', () => {
    const filtro = filtroEmpresa(
      { id: 2, rol: 2, empresa_id: 10, sucursal_id: 1 },
      'v.sucursal_id',
      's',
      { sucursal_id: 2 }
    );

    expect(filtro.clausula).toContain('v.sucursal_id = :sucursal_id');
    expect(filtro.clausula).toContain('s.empresa_id = :empresa_id');
    expect(filtro.params).toEqual({ sucursal_id: 1, empresa_id: 10 });
  });

  test('admin con todas_sucursales filtra por empresa, no por una sucursal', () => {
    const filtro = filtroEmpresa(
      { id: 2, rol: 1, empresa_id: 10, sucursal_id: 1 },
      'v.sucursal_id',
      's',
      { todas_sucursales: true }
    );

    expect(filtro.clausula).toBe('AND s.empresa_id = :empresa_id');
    expect(filtro.params).toEqual({ empresa_id: 10 });
  });

  test('admin sin todas_sucursales usa sucursal solicitada dentro de su empresa', () => {
    const filtro = filtroEmpresa(
      { id: 2, rol: 1, empresa_id: 10, sucursal_id: 1 },
      'v.sucursal_id',
      's',
      { sucursal_id: 2 }
    );

    expect(filtro.clausula).toContain('v.sucursal_id = :sucursal_id');
    expect(filtro.clausula).toContain('s.empresa_id = :empresa_id');
    expect(filtro.params).toEqual({ sucursal_id: 2, empresa_id: 10 });
  });
});

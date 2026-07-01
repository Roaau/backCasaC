jest.mock('../models/Proveedor.js', () => ({
  __esModule: true,
  default: { findAll: jest.fn(), findOne: jest.fn(), create: jest.fn() }
}));

const { default: Proveedor } = require('../models/Proveedor.js');
const {
  listarProveedores,
  crearProveedor,
  actualizarProveedor,
  eliminarProveedor
} = require('../controllers/proveedoresController.js');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('Proveedores - aislamiento por empresa', () => {
  beforeEach(() => jest.clearAllMocks());

  test('listar filtra proveedores por empresa del token', async () => {
    Proveedor.findAll.mockResolvedValue([{ proveedor_id: 1, empresa_id: 3 }]);
    const req = { usuario: { empresa_id: 3, sucursal_id: 1, rol: 2 } };
    const res = mockRes();

    await listarProveedores(req, res);

    expect(Proveedor.findAll).toHaveBeenCalledWith({
      where: { empresa_id: 3, activo: true },
      order: [['nombre', 'ASC']]
    });
    expect(res.json).toHaveBeenCalledWith([{ proveedor_id: 1, empresa_id: 3 }]);
  });

  test('crear ignora empresa_id enviado por el cliente', async () => {
    Proveedor.create.mockResolvedValue({ proveedor_id: 9, empresa_id: 4, nombre: 'Proveedor' });
    const req = {
      usuario: { empresa_id: 4, sucursal_id: 1, rol: 1 },
      body: { empresa_id: 999, nombre: 'Proveedor', contacto: 'Ana' }
    };
    const res = mockRes();

    await crearProveedor(req, res);

    expect(Proveedor.create).toHaveBeenCalledWith(expect.objectContaining({
      empresa_id: 4,
      nombre: 'Proveedor'
    }));
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('actualizar busca proveedor por id y empresa del token', async () => {
    const proveedor = { update: jest.fn().mockResolvedValue(true), proveedor_id: 2, empresa_id: 7 };
    Proveedor.findOne.mockResolvedValue(proveedor);
    const req = {
      params: { id: '2' },
      usuario: { empresa_id: 7, sucursal_id: 1, rol: 1 },
      body: { nombre: 'Actualizado' }
    };
    const res = mockRes();

    await actualizarProveedor(req, res);

    expect(Proveedor.findOne).toHaveBeenCalledWith({ where: { proveedor_id: '2', empresa_id: 7 } });
    expect(proveedor.update).toHaveBeenCalledWith(expect.objectContaining({ nombre: 'Actualizado' }));
    expect(res.json).toHaveBeenCalledWith(proveedor);
  });

  test('eliminar no toca proveedor si pertenece a otra empresa', async () => {
    Proveedor.findOne.mockResolvedValue(null);
    const req = { params: { id: '99' }, usuario: { empresa_id: 8, sucursal_id: 1, rol: 1 } };
    const res = mockRes();

    await eliminarProveedor(req, res);

    expect(Proveedor.findOne).toHaveBeenCalledWith({ where: { proveedor_id: '99', empresa_id: 8 } });
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

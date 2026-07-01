jest.mock('sequelize', () => ({
  QueryTypes: { SELECT: 'SELECT' }
}));
jest.mock('../config/database.js', () => ({
  __esModule: true,
  default: { query: jest.fn() }
}));
jest.mock('../models/CfdiVenta.js', () => ({
  __esModule: true,
  default: { update: jest.fn() }
}));
jest.mock('../services/emailService.js', () => ({
  enviarFacturaPorCorreo: jest.fn()
}));
jest.mock('../utils/filtros.js', () => ({
  filtroEmpresa: jest.fn((usuario) => ({
    clausula: 'AND s.empresa_id = :empresa_id AND v.sucursal_id = :sucursal_id',
    params: { empresa_id: usuario.empresa_id, sucursal_id: usuario.sucursal_id }
  }))
}));
jest.mock('../utils/scope.js', () => ({
  esAdminEmpresa: jest.fn((usuario) => usuario?.rol === 1 || usuario?.rol_id === 1)
}));

const { default: sequelize } = require('../config/database.js');
const { default: CfdiVenta } = require('../models/CfdiVenta.js');
const { filtroEmpresa } = require('../utils/filtros.js');
const { getCfdis, timbrarCfdi, cancelarCfdi } = require('../controllers/cfdiController.js');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('CFDI - aislamiento por empresa/sucursal', () => {
  beforeEach(() => jest.clearAllMocks());

  test('listar CFDI de empleado fuerza su sucursal y empresa', async () => {
    sequelize.query.mockResolvedValue([{ cfdi_id: 1, total_venta: '150.50' }]);
    const req = {
      query: { todas_sucursales: 'true', sucursal_id: '99' },
      usuario: { empresa_id: 20, sucursal_id: 3, rol: 2 }
    };
    const res = mockRes();

    await getCfdis(req, res);

    expect(filtroEmpresa).toHaveBeenCalledWith(req.usuario, 'v.sucursal_id', 's', req.query);
    const [, options] = sequelize.query.mock.calls[0];
    expect(options.replacements).toMatchObject({ empresa_id: 20, sucursal_id: 3 });
    expect(options.replacements).not.toMatchObject({ sucursal_id: 99 });
    expect(res.json).toHaveBeenCalledWith([{ cfdi_id: 1, total_venta: 150.50 }]);
  });

  test('timbrar CFDI busca por empresa y sucursal si no es admin', async () => {
    sequelize.query.mockResolvedValue([{ cfdi_id: 7, estado: 'PENDIENTE' }]);
    CfdiVenta.update.mockResolvedValue([1]);
    const req = {
      params: { cfdiId: '7' },
      usuario: { empresa_id: 21, sucursal_id: 4, rol: 2 },
      body: {
        receptor_rfc: 'xaxx010101000',
        receptor_nombre: 'PUBLICO EN GENERAL',
        receptor_cp: '64000',
        receptor_regimen: '616',
        uso_cfdi: 'S01'
      }
    };
    const res = mockRes();

    await timbrarCfdi(req, res);

    const [, options] = sequelize.query.mock.calls[0];
    expect(options.replacements).toMatchObject({
      cfdiId: '7',
      empresa_id: 21,
      esAdmin: false,
      sucursal_id: 4
    });
    expect(CfdiVenta.update).toHaveBeenCalledWith(expect.objectContaining({
      receptor_rfc: 'XAXX010101000',
      estado: 'TIMBRADO'
    }), { where: { cfdi_id: '7' } });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ estado: 'TIMBRADO' }));
  });

  test('cancelar CFDI de otra empresa responde 404 porque el query no encuentra registro', async () => {
    sequelize.query.mockResolvedValue([]);
    const req = {
      params: { cfdiId: '999' },
      usuario: { empresa_id: 22, sucursal_id: 1, rol: 1 },
      body: { motivo: '02' }
    };
    const res = mockRes();

    await cancelarCfdi(req, res);

    const [, options] = sequelize.query.mock.calls[0];
    expect(options.replacements).toMatchObject({ cfdiId: '999', empresa_id: 22, esAdmin: true });
    expect(CfdiVenta.update).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

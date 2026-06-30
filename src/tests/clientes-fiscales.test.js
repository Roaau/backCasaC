jest.mock('../models/ClienteFiscal.js', () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
    create: jest.fn()
  }
}));

const { default: ClienteFiscal } = require('../models/ClienteFiscal.js');
const {
  buscarClienteFiscal,
  crearClienteFiscal
} = require('../controllers/clientesFiscalesController.js');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('Clientes fiscales - aislamiento por empresa', () => {
  beforeEach(() => jest.clearAllMocks());

  test('busca cliente fiscal por RFC dentro de la empresa del token', async () => {
    ClienteFiscal.findOne.mockResolvedValue({ cliente_id: 8, empresa_id: 2, rfc: 'XAXX010101000' });

    const req = {
      query: { rfc: 'xaxx010101000' },
      usuario: { empresa_id: 2, sucursal_id: 1, rol: 2 }
    };
    const res = mockRes();

    await buscarClienteFiscal(req, res);

    expect(ClienteFiscal.findOne).toHaveBeenCalledWith({
      where: { empresa_id: 2, rfc: 'XAXX010101000', activo: true }
    });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ empresa_id: 2 }));
  });

  test('crea cliente fiscal amarrado a la empresa del token', async () => {
    ClienteFiscal.create.mockResolvedValue({ cliente_id: 9, empresa_id: 3, rfc: 'COSC8001137NA' });

    const req = {
      body: {
        rfc: 'cosc8001137na',
        nombre_fiscal: 'Cliente Demo',
        cp_fiscal: '06600',
        regimen_fiscal: '612'
      },
      usuario: { empresa_id: 3, sucursal_id: 1, rol: 1 }
    };
    const res = mockRes();

    await crearClienteFiscal(req, res);

    expect(ClienteFiscal.create).toHaveBeenCalledWith(expect.objectContaining({
      empresa_id: 3,
      rfc: 'COSC8001137NA'
    }));
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

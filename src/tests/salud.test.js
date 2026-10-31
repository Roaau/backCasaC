jest.mock('../config/database.js', () => ({ __esModule: true, default: { query: jest.fn().mockResolvedValue([]) } }));
jest.mock('sequelize', () => ({ QueryTypes: { SELECT: 'SELECT' } }));

const { default: sequelize } = require('../config/database.js');
const { normalizarRuta, registrarUso } = require('../controllers/saludController.js');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.end = jest.fn().mockReturnValue(res);
  return res;
};

describe('Panel de salud y uso', () => {
  beforeEach(() => jest.clearAllMocks());

  test('agrupa rutas con ids y quita la query', () => {
    expect(normalizarRuta('/api/ventas/123/pedido-estado?x=1')).toBe('/api/ventas/:id/pedido-estado');
    expect(normalizarRuta('/api/caja/totales/9')).toBe('/api/caja/totales/:id');
  });

  test('registra la visita de una pantalla para la empresa del usuario', async () => {
    const res = mockRes();
    await registrarUso({ body: { ruta: '/inventario' }, usuario: { id: 7, empresa_id: 3 } }, res);
    expect(sequelize.query).toHaveBeenCalledWith(expect.stringContaining('ON CONFLICT'), expect.objectContaining({
      replacements: expect.objectContaining({ empresa_id: 3, usuario_id: 7, ruta: '/inventario' })
    }));
    expect(res.status).toHaveBeenCalledWith(204);
  });

  test('ignora rutas raras sin tocar la base', async () => {
    const res = mockRes();
    await registrarUso({ body: { ruta: 'javascript:alert(1)' }, usuario: { id: 7, empresa_id: 3 } }, res);
    expect(sequelize.query).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(204);
  });
});

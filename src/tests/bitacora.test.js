jest.mock('../config/database.js', () => ({ __esModule: true, default: { query: jest.fn() } }));
jest.mock('../models/SucursalModel.js', () => ({ __esModule: true, default: { findOne: jest.fn(), findAll: jest.fn() } }));
jest.mock('sequelize', () => ({ QueryTypes: { SELECT: 'SELECT' }, Op: {} }));

const { default: sequelize } = require('../config/database.js');
const { listarBitacora } = require('../controllers/bitacoraController.js');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('Bitacora del dueño', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sequelize.query.mockImplementation((sql) => Promise.resolve(sql.includes('COUNT(*)') ? [{ total: 1 }] : [{ accion: 'DEVOLUCION', detalle: {} }]));
  });

  test('solo consulta la empresa del usuario aunque mande otra', async () => {
    const res = mockRes();
    await listarBitacora({ usuario: { id: 1, rol: 1, empresa_id: 10 }, query: { empresa_id: '99', desde: '2026-10-01', hasta: '2026-10-31' } }, res);
    const [sql, opciones] = sequelize.query.mock.calls[0];
    expect(sql).toContain('a.empresa_id = :empresa_id');
    expect(opciones.replacements.empresa_id).toBe(10);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      datos: [expect.objectContaining({ accion_texto: 'Devolución' })], total: 1
    }));
  });

  test('ignora acciones que no son de la bitacora', async () => {
    const res = mockRes();
    await listarBitacora({ usuario: { id: 1, rol: 1, empresa_id: 10 }, query: { accion: 'IA_CONSULTA' } }, res);
    const [sql] = sequelize.query.mock.calls[0];
    expect(sql).not.toContain('a.accion = :accion');
  });
});

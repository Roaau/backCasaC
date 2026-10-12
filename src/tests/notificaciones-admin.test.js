jest.mock('../config/database.js', () => ({
  __esModule: true,
  default: { query: jest.fn(), literal: jest.fn() }
}));
jest.mock('../models/Notificacion.js', () => ({
  __esModule: true,
  default: { findAll: jest.fn(), findOne: jest.fn(), create: jest.fn() }
}));
jest.mock('../models/SucursalModel.js', () => ({
  __esModule: true,
  default: { findAll: jest.fn() }
}));
jest.mock('../utils/auditoria.js', () => ({
  __esModule: true,
  registrarAuditoria: jest.fn()
}));

const { Op } = require('sequelize');
const { default: Sucursal } = require('../models/SucursalModel.js');
const { scopeConStockDeTodas, whereVisibles } = require('../controllers/notificacionesController.js');

describe('Notificaciones - stock bajo de todas las sucursales para el admin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Sucursal.findAll.mockResolvedValue([{ sucursal_id: 1 }, { sucursal_id: 2 }, { sucursal_id: 3 }]);
  });

  const scopeUna = { empresa_id: 10, todas: false, sucursal_id: 1, sucursalIds: [1] };

  test('el admin con una sucursal seleccionada recibe stock bajo de todas', async () => {
    const scope = await scopeConStockDeTodas({ usuario: { empresa_id: 10, rol: 1 } }, scopeUna);

    expect(Sucursal.findAll).toHaveBeenCalledWith(expect.objectContaining({ where: { empresa_id: 10, activa: true } }));
    expect(scope.sucursalesStock).toEqual([1, 2, 3]);
    expect(whereVisibles(scope)).toEqual({
      [Op.or]: [
        { sucursal_id: 1 },
        { tipo: 'stock_bajo', sucursal_id: { [Op.in]: [1, 2, 3] } }
      ]
    });
  });

  test('el empleado solo ve lo de su sucursal', async () => {
    const scope = await scopeConStockDeTodas({ usuario: { empresa_id: 10, rol: 2 } }, scopeUna);

    expect(Sucursal.findAll).not.toHaveBeenCalled();
    expect(whereVisibles(scope)).toEqual({ sucursal_id: 1 });
  });

  test('con todas las sucursales seleccionadas no cambia el alcance', async () => {
    const todas = { empresa_id: 10, todas: true, sucursalIds: [1, 2] };
    const scope = await scopeConStockDeTodas({ usuario: { empresa_id: 10, rol: 1 } }, todas);

    expect(Sucursal.findAll).not.toHaveBeenCalled();
    expect(whereVisibles(scope)).toEqual({ sucursal_id: { [Op.in]: [1, 2] } });
  });
});

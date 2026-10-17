jest.mock('../models/Cliente.js', () => ({ __esModule: true, default: { findOne: jest.fn(), findAll: jest.fn(), create: jest.fn() } }));

const { default: Cliente } = require('../models/Cliente.js');
const { guardarCliente, actualizarCliente, listarClientes } = require('../controllers/clientesController.js');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};
const usuario = { id: 1, empresa_id: 10, rol: 2 };

describe('Clientes guardados', () => {
  beforeEach(() => jest.clearAllMocks());

  test('crea un cliente nuevo con el telefono solo en digitos', async () => {
    Cliente.findOne.mockResolvedValue(null);
    Cliente.create.mockImplementation(async d => d);
    const res = mockRes();
    await guardarCliente({ usuario, body: { nombre: ' Doña Mary ', telefono: '228 123-4567', direccion: 'Calle 5' } }, res);
    expect(Cliente.create).toHaveBeenCalledWith(expect.objectContaining({ empresa_id: 10, nombre: 'Doña Mary', telefono: '2281234567', direccion: 'Calle 5', referencia: null }));
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('si el telefono ya existe actualiza sin borrar lo que no viene', async () => {
    const existente = { update: jest.fn() };
    Cliente.findOne.mockResolvedValue(existente);
    await guardarCliente({ usuario, body: { nombre: 'Mary', telefono: '2281234567', direccion: 'Calle 6' } }, mockRes());
    expect(Cliente.findOne.mock.calls[0][0].where).toEqual(expect.objectContaining({ empresa_id: 10, telefono: '2281234567' }));
    expect(existente.update).toHaveBeenCalledWith({ nombre: 'Mary', telefono: '2281234567', direccion: 'Calle 6' });
    expect(Cliente.create).not.toHaveBeenCalled();
  });

  test('sin nombre no se guarda', async () => {
    const res = mockRes();
    await guardarCliente({ usuario, body: { nombre: '  ', telefono: '123' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('editar solo dentro de la misma empresa', async () => {
    Cliente.findOne.mockResolvedValue(null);
    const res = mockRes();
    await actualizarCliente({ usuario, params: { id: '7' }, body: { nombre: 'X' } }, res);
    expect(Cliente.findOne.mock.calls[0][0].where).toEqual({ cliente_id: 7, empresa_id: 10, activo: true });
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('buscar limita resultados y filtra por empresa', async () => {
    Cliente.findAll.mockResolvedValue([]);
    await listarClientes({ usuario, query: { q: 'mar' } }, mockRes());
    const opciones = Cliente.findAll.mock.calls[0][0];
    expect(opciones.where).toEqual(expect.objectContaining({ empresa_id: 10, activo: true }));
    expect(opciones.limit).toBe(10);
  });
});

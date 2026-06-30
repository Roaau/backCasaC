import Empresa from '../models/EmpresaModel.js';
import { obtenerEmpresaId, responderErrorScope } from '../utils/scope.js';

export const getEmpresas = async (req, res) => {
  try {
    const empresa_id = obtenerEmpresaId(req.usuario);
    const empresas = await Empresa.findAll({ where: { empresa_id, activo: true } });
    res.json(empresas);
  } catch (e) {
    responderErrorScope(res, e);
  }
};

export const updateEmpresa = async (req, res) => {
  try {
    const empresa_id = obtenerEmpresaId(req.usuario);
    await Empresa.update(req.body, { where: { empresa_id } });
    res.json({ mensaje: 'Empresa actualizada' });
  } catch (e) {
    responderErrorScope(res, e);
  }
};

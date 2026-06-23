import Empresa from '../models/EmpresaModel.js';
import Sucursal from '../models/SucursalModel.js';

export const getEmpresas = async (req, res) => {
  try {
    const empresa_id = req.usuario.empresa_id;
    const empresas = await Empresa.findAll({ where: { empresa_id, activo: true } });
    res.json(empresas);
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener empresas' });
  }
};

export const updateEmpresa = async (req, res) => {
  try {
    const empresa_id = req.usuario.empresa_id;
    await Empresa.update(req.body, { where: { empresa_id } });
    res.json({ mensaje: 'Empresa actualizada' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

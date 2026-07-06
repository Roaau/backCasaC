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

export const getMiPlan = async (req, res) => {
  try {
    const empresa_id = obtenerEmpresaId(req.usuario);
    const empresa = await Empresa.findOne({
      where: { empresa_id, activo: true },
      attributes: [
        'empresa_id',
        'razon_social',
        'estado',
        'plan',
        'precio_mensual',
        'fecha_vencimiento',
        'limite_sucursales',
        'limite_usuarios',
        'email_contacto'
      ]
    });
    if (!empresa) return res.status(404).json({ error: 'Empresa no encontrada' });
    res.json(empresa);
  } catch (e) {
    responderErrorScope(res, e);
  }
};

export const updateEmpresa = async (req, res) => {
  try {
    const empresa_id = obtenerEmpresaId(req.usuario);
    const camposPermitidos = ['logo_empresa'];
    const datos = {};
    for (const campo of camposPermitidos) {
      if (req.body[campo] !== undefined) datos[campo] = req.body[campo];
    }
    if (Object.keys(datos).length === 0) {
      return res.status(400).json({ error: 'No hay campos validos para actualizar' });
    }
    await Empresa.update(datos, { where: { empresa_id } });
    res.json({ mensaje: 'Empresa actualizada' });
  } catch (e) {
    responderErrorScope(res, e);
  }
};

import Empresa from '../models/EmpresaModel.js';
import { obtenerEmpresaId, responderErrorScope } from '../utils/scope.js';
import { normalizarGiro } from '../utils/giros.js';

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
        'email_contacto',
        'giro',
        'nivel',
        'periodo_pago',
        'codigo_referido'
      ]
    });
    if (!empresa) return res.status(404).json({ error: 'Empresa no encontrada' });
    res.json(empresa);
  } catch (e) {
    responderErrorScope(res, e);
  }
};

// GET /api/auth/negocio (cualquier usuario con sesion): datos del negocio que necesita la caja
export const getConfigNegocio = async (req, res) => {
  try {
    const empresa_id = obtenerEmpresaId(req.usuario);
    const empresa = await Empresa.findByPk(empresa_id, { attributes: ['razon_social', 'giro', 'iva_activo', 'iva_porcentaje'] });
    if (!empresa) return res.status(404).json({ error: 'Empresa no encontrada' });
    res.json({
      nombre: empresa.razon_social,
      giro: empresa.giro,
      iva_activo: empresa.iva_activo === true,
      iva_porcentaje: Number(empresa.iva_porcentaje ?? 16)
    });
  } catch (e) {
    responderErrorScope(res, e);
  }
};

export const updateEmpresa = async (req, res) => {
  try {
    const empresa_id = obtenerEmpresaId(req.usuario);
    const camposPermitidos = ['logo_empresa', 'giro'];
    const datos = {};
    for (const campo of camposPermitidos) {
      if (req.body[campo] !== undefined) datos[campo] = campo === 'giro' ? normalizarGiro(req.body[campo]) : req.body[campo];
    }
    if (req.body.iva_activo !== undefined) datos.iva_activo = req.body.iva_activo === true || req.body.iva_activo === 'true';
    if (req.body.iva_porcentaje !== undefined) {
      const pct = Number(req.body.iva_porcentaje);
      if (!Number.isFinite(pct) || pct <= 0 || pct > 30) {
        return res.status(400).json({ error: 'El IVA debe estar entre 1 y 30%' });
      }
      datos.iva_porcentaje = Math.round(pct * 100) / 100;
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

import Proveedor from "../models/Proveedor.js";
import { obtenerEmpresaId, responderErrorScope } from "../utils/scope.js";

export const listarProveedores = async (req, res) => {
  try {
    const empresa_id = obtenerEmpresaId(req.usuario);
    const proveedores = await Proveedor.findAll({
      where: { empresa_id, activo: true },
      order: [['nombre', 'ASC']]
    });
    res.json(proveedores);
  } catch (err) {
    responderErrorScope(res, err);
  }
};

export const crearProveedor = async (req, res) => {
  const { nombre, contacto, telefono, email, direccion } = req.body;
  if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre es requerido' });
  try {
    const empresa_id = obtenerEmpresaId(req.usuario);
    const p = await Proveedor.create({
      empresa_id,
      nombre: nombre.trim(), contacto, telefono, email, direccion
    });
    res.status(201).json(p);
  } catch (err) {
    responderErrorScope(res, err);
  }
};

export const actualizarProveedor = async (req, res) => {
  const { id } = req.params;
  const { nombre, contacto, telefono, email, direccion } = req.body;
  try {
    const empresa_id = obtenerEmpresaId(req.usuario);
    const p = await Proveedor.findOne({ where: { proveedor_id: id, empresa_id } });
    if (!p) return res.status(404).json({ error: 'Proveedor no encontrado' });
    await p.update({ nombre, contacto, telefono, email, direccion });
    res.json(p);
  } catch (err) {
    responderErrorScope(res, err);
  }
};

export const eliminarProveedor = async (req, res) => {
  const { id } = req.params;
  try {
    const empresa_id = obtenerEmpresaId(req.usuario);
    const p = await Proveedor.findOne({ where: { proveedor_id: id, empresa_id } });
    if (!p) return res.status(404).json({ error: 'Proveedor no encontrado' });
    await p.update({ activo: false });
    res.json({ mensaje: 'Proveedor eliminado' });
  } catch (err) {
    responderErrorScope(res, err);
  }
};

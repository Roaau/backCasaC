import Usuario from "../models/Usuario.js";
import bcrypt from "bcrypt";
import { resolverSucursalOperativa, responderErrorScope, validarSucursalEmpresa } from "../utils/scope.js";

const CAMPOS_PUBLICOS = ['usuario_id', 'nombre', 'usuario', 'rol_id', 'sucursal_id', 'empresa_id', 'foto_perfil', 'color_tema', 'activo'];

export const getUsuarios = async (req, res) => {
  try {
    const empresa_id = req.usuario.empresa_id;
    const usuarios = await Usuario.findAll({
      attributes: CAMPOS_PUBLICOS,
      where: { empresa_id }
    });
    res.json(usuarios);
  } catch (err) {
    responderErrorScope(res, err);
  }
};

export const createUsuario = async (req, res) => {
  const { nombre, usuario, contrasena, rol, sucursal_id } = req.body;
  if (!nombre || !usuario || !contrasena) {
    return res.status(400).json({ error: "Nombre, usuario y contraseña son requeridos" });
  }
  try {
    const sucursalId = await resolverSucursalOperativa(req, { sucursal_id });
    const hash = await bcrypt.hash(contrasena, 10);
    const nuevo = await Usuario.create({
      nombre,
      usuario,
      contrasena: hash,
      rol_id:      rol === 'ADMINISTRADOR' ? 1 : 2,
      sucursal_id: sucursalId,
      empresa_id:  req.usuario.empresa_id,
      activo:      true
    });
    res.json({ usuario_id: nuevo.usuario_id, nombre: nuevo.nombre, usuario: nuevo.usuario, rol_id: nuevo.rol_id });
  } catch (err) {
    responderErrorScope(res, err);
  }
};

export const updateUsuario = async (req, res) => {
  const { id } = req.params;
  const empresa_id = req.usuario.empresa_id;
  const { nombre, usuario, contrasena, rol, sucursal_id, activo } = req.body;
  try {
    const sucursalId = sucursal_id !== undefined
      ? (await validarSucursalEmpresa(req.usuario, sucursal_id)).sucursal_id
      : undefined;
    const datos = {
      ...(nombre       !== undefined && { nombre }),
      ...(usuario      !== undefined && { usuario }),
      ...(rol          !== undefined && { rol_id: rol === 'ADMINISTRADOR' ? 1 : 2 }),
      ...(sucursalId   !== undefined && { sucursal_id: sucursalId }),
      ...(activo       !== undefined && { activo })
    };
    if (contrasena?.trim()) {
      datos.contrasena = await bcrypt.hash(contrasena, 10);
    }
    const [updated] = await Usuario.update(datos, { where: { usuario_id: id, empresa_id } });
    if (!updated) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json({ msg: "Usuario actualizado" });
  } catch (err) {
    responderErrorScope(res, err);
  }
};

export const deleteUsuario = async (req, res) => {
  const { id } = req.params;
  const empresa_id = req.usuario.empresa_id;
  try {
    const eliminado = await Usuario.destroy({ where: { usuario_id: id, empresa_id } });
    if (!eliminado) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json({ msg: "Usuario eliminado" });
  } catch {
    res.status(500).json({ error: "Error al eliminar" });
  }
};

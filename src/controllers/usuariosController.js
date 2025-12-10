import Usuario from "../models/Usuario.js";
import bcrypt from "bcrypt";

// GET: Obtener todos
export const getUsuarios = async (req, res) => {
  try {
    const usuarios = await Usuario.findAll();
    // (Opcional) Podrías mapear aquí para devolver el nombre del rol en vez del ID,
    // pero lo haremos en el frontend para no complicar la consulta.
    res.json(usuarios);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener usuarios" });
  }
};

// POST: Crear usuario (CON ENCRIPTACIÓN)
export const createUsuario = async (req, res) => {
  try {
    const { nombre, usuario, contrasena, rol } = req.body;

    // 1. Encriptar contraseña
    const hashedPassword = await bcrypt.hash(contrasena, 10);

    // 2. Convertir Texto a ID de Rol
    // Si viene "ADMINISTRADOR" guardamos 1, si no, 2
    const rol_id = (rol === 'ADMINISTRADOR') ? 1 : 2;

    const nuevo = await Usuario.create({
      nombre,
      usuario,
      contrasena: hashedPassword,
      rol_id
    });

    res.json(nuevo);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al crear usuario. Posible usuario duplicado." });
  }
};

// PUT: Editar usuario
export const updateUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, usuario, contrasena, rol } = req.body;

    let datosActualizar = { 
        nombre, 
        usuario,
        rol_id: (rol === 'ADMINISTRADOR') ? 1 : 2
    };

    // Solo si enviaron una contraseña nueva, la encriptamos y la agregamos
    if (contrasena && contrasena.trim() !== "") {
        datosActualizar.contrasena = await bcrypt.hash(contrasena, 10);
    }

    const [updated] = await Usuario.update(datosActualizar, { where: { usuario_id: id } });

    if(updated) {
        res.json({ msg: "Usuario actualizado" });
    } else {
        res.status(404).json({ msg: "Usuario no encontrado" });
    }
    
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al actualizar" });
  }
};

// DELETE: Eliminar físico (Destroy)
// Si prefieres borrado lógico, tendrías que agregar una columna 'activo' a tu modelo Usuario.js
export const deleteUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    await Usuario.destroy({ where: { usuario_id: id } });
    res.json({ msg: "Usuario eliminado" });
  } catch (error) {
    res.status(500).json({ error: "Error al eliminar" });
  }
};
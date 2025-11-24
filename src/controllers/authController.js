import Usuario from "../models/Usuario.js";
import bcrypt from "bcrypt"; 

// Función de login
export const login = async (req, res) => {
  const { usuario, contrasena } = req.body;

  console.log("📥 BACKEND RECIBE:");
  console.log("Usuario:", usuario);
  console.log("Contraseña enviada:", contrasena);

  try {
    // Buscar usuario en la base de datos
    const user = await Usuario.findOne({ where: { usuario } });

    if (!user) {
      console.log("❌ Usuario no encontrado");
      return res.status(401).json({ mensaje: "Usuario no encontrado" });
    }

    console.log("🔑 Hash guardado en BD:", user.contrasena);

    // Comparar contraseña ingresada con hash de la BD
    const passwordMatch = await bcrypt.compare(contrasena, user.contrasena);
    console.log("🔍 ¿Coinciden?:", passwordMatch);

    if (!passwordMatch) {
      return res.status(401).json({ mensaje: "Contraseña incorrecta" });
    }

    return res.json({ mensaje: "Login correcto" });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ mensaje: "Error en login" });
  }
};

// Función de registro (opcional, para guardar hash en la BD)
export const registrarUsuario = async (req, res) => {
  const { usuario, contrasena } = req.body;

  try {
    // Generar hash de la contraseña
    const hashedPassword = await bcrypt.hash(contrasena, 10);

    // Crear usuario en la BD con hash
    const nuevoUsuario = await Usuario.create({
      usuario,
      contrasena: hashedPassword,
    });

    return res.json({ mensaje: "Usuario registrado", usuario: nuevoUsuario });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ mensaje: "Error al registrar usuario" });
  }
};

import Usuario from "../models/Usuario.js";
import bcrypt from "bcrypt"; 
import jwt from "jsonwebtoken"; // ⚠️ Asegúrate de tener esto importado

// Función de login
export const login = async (req, res) => {
  const { usuario, contrasena } = req.body;

  console.log("📥 BACKEND RECIBE LOGIN:");
  console.log("Usuario:", usuario);

  try {
    // 1. Buscar usuario en la base de datos
    // Usamos 'user' para referirnos al objeto de la BD
    const user = await Usuario.findOne({ where: { usuario } });

    if (!user) {
      console.log("❌ Usuario no encontrado");
      return res.status(401).json({ mensaje: "Usuario no encontrado" });
    }

    // 2. Comparar contraseña
    const passwordMatch = await bcrypt.compare(contrasena, user.contrasena);

    if (!passwordMatch) {
      return res.status(401).json({ mensaje: "Contraseña incorrecta" });
    }

    // 3. Generar Token (JWT) - IMPORTANTE PARA EL FRONTEND
    // Usa tu palabra secreta (idealmente en process.env.JWT_SECRET)
    const token = jwt.sign(
        { id: user.usuario_id, rol: user.rol_id }, 
        process.env.JWT_SECRET || 'secreto_super_seguro', 
        { expiresIn: '8h' }
    );

    console.log("✅ Login Exitoso. ID:", user.usuario_id);

    // 4. Responder al Frontend
    return res.json({ 
        mensaje: "Login correcto", 
        token: token, // <--- EL FRONT LO NECESITA
        
        // ⚠️ AQUÍ ESTABA EL ERROR:
        // Antes tenías: usuario.usuario_id (incorrecto, 'usuario' es el string del input)
        // Ahora es: user.usuario_id (correcto, 'user' es el objeto de la BD)
        usuario_id: user.usuario_id,
        
        usuario: user.usuario,
        nombre: user.nombre,
        rol_id: user.rol_id
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ mensaje: "Error en login" });
  }
};

// Función de registro (opcional)
export const registrarUsuario = async (req, res) => {
  const { usuario, contrasena } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(contrasena, 10);
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
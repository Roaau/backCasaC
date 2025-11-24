import Usuario from "./src/models/Usuario.js"; 
import bcrypt from "bcrypt";

const migrarContrasenas = async () => {
  try {
    // Traer todos los usuarios
    const usuarios = await Usuario.findAll();

    for (const user of usuarios) {
      // Saltar si ya parece un hash (empieza con $2)
      if (!user.contrasena.startsWith("$2")) {
        const hashed = await bcrypt.hash(user.contrasena, 10);
        user.contrasena = hashed;
        await user.save();
        console.log(`✅ Contraseña de ${user.usuario} convertida a hash`);
      } else {
        console.log(`ℹ️ Contraseña de ${user.usuario} ya está en hash`);
      }
    }

    console.log("✅ Migración completada");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error al migrar contraseñas:", error);
    process.exit(1);
  }
};

migrarContrasenas();

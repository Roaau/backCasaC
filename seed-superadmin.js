import dotenv from "dotenv";
dotenv.config({ override: true });

import bcrypt from "bcrypt";
import sequelize from "./src/config/database.js";
import Usuario from "./src/models/Usuario.js";

const EMAIL = process.env.SUPERADMIN_EMAIL;
const USUARIO = process.env.SUPERADMIN_USUARIO || "Superadmin";
const PASSWORD = process.env.SUPERADMIN_PASSWORD;

async function seed() {
  if (!EMAIL || !PASSWORD) {
    console.error("Configura SUPERADMIN_EMAIL y SUPERADMIN_PASSWORD antes de ejecutar este seed.");
    process.exit(1);
  }

  await sequelize.authenticate();
  await sequelize.sync();

  const existing = await Usuario.findOne({ where: { es_superadmin: true } });
  const hash = await bcrypt.hash(PASSWORD, 10);

  if (existing) {
    await existing.update({ nombre: USUARIO, usuario: EMAIL, contrasena: hash });
    console.log(`Superadmin actualizado: ${EMAIL}`);
    process.exit(0);
  }

  await Usuario.create({
    nombre: USUARIO,
    usuario: EMAIL,
    contrasena: hash,
    rol_id: 1,
    empresa_id: null,
    sucursal_id: null,
    es_superadmin: true,
    activo: true
  });

  console.log(`Superadmin creado: ${EMAIL}`);
  console.log("Cambia la contrasena despues del primer login.");
  process.exit(0);
}

seed().catch(e => { console.error(e.message); process.exit(1); });

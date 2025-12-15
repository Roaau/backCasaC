import { Sequelize } from "sequelize";
import dotenv from "dotenv";

dotenv.config();

// Detecta si estamos en producción (Render)
const isProduction = process.env.NODE_ENV === "production";

// Configuración Sequelize
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: "postgres",
  logging: false,
  dialectOptions: isProduction
    ? {
        ssl: {
          require: true,
          rejectUnauthorized: false, // permite certificados autofirmados de Supabase
        },
      }
    : {},
});

export default sequelize;

// src/database.js
import { Sequelize } from "sequelize";
import dotenv from "dotenv";
import dns from "dns";

// Cargar variables de entorno
dotenv.config();

// Forzar resolución IPv4 primero para evitar problemas de conexión en Render
dns.setDefaultResultOrder("ipv4first");

// Crear la conexión a la base de datos
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: "postgres",
  protocol: "postgres",
  activo: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  logging: false, // poner true si quieres ver logs de SQL
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false, // necesario para Supabase
    },
  },
});

export default sequelize;

import { Sequelize, DataTypes } from "sequelize";
import pg from "pg";
import dotenv from "dotenv";
dotenv.config({ override: true });

// NUMERIC (precios y cantidades a granel) llega como string; se convierte a number
// para que comparaciones como stock < cantidad (back y front) no se hagan como texto.
// Sequelize usa su propio parser para DECIMAL, por eso se ajustan ambos.
const aNumero = (valor) => (valor === null || valor === undefined ? valor : parseFloat(valor));
pg.types.setTypeParser(1700, aNumero);
DataTypes.postgres.DECIMAL.parse = aNumero;

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: "postgres",
  logging: false,
  // Supabase exige SSL. DB_SSL=false solo para un PostgreSQL local de pruebas.
  dialectOptions: process.env.DB_SSL === "false"
    ? {}
    : { ssl: { require: true, rejectUnauthorized: false } }
});

export default sequelize;

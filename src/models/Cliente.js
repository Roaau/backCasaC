import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

// Clientes frecuentes (pedidos y mostrador): se guardan al cobrar para volver a usar sus datos
const Cliente = sequelize.define("Cliente", {
  cliente_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false },
  nombre:     { type: DataTypes.STRING(200), allowNull: false },
  telefono:   { type: DataTypes.STRING(30),  allowNull: true },
  direccion:  { type: DataTypes.TEXT,        allowNull: true },
  referencia: { type: DataTypes.TEXT,        allowNull: true },
  activo:     { type: DataTypes.BOOLEAN,     defaultValue: true }
}, {
  tableName: "clientes",
  timestamps: true,
  indexes: [{ fields: ["empresa_id"] }]
});

export default Cliente;

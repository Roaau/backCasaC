import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const Proveedor = sequelize.define("Proveedor", {
  proveedor_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id:   { type: DataTypes.INTEGER, allowNull: false },
  nombre:       { type: DataTypes.STRING(200), allowNull: false },
  contacto:     { type: DataTypes.STRING(150), allowNull: true },
  telefono:     { type: DataTypes.STRING(20),  allowNull: true },
  email:        { type: DataTypes.STRING(200), allowNull: true },
  direccion:    { type: DataTypes.TEXT,        allowNull: true },
  activo:       { type: DataTypes.BOOLEAN,     defaultValue: true }
}, { tableName: "proveedores", timestamps: true });

export default Proveedor;

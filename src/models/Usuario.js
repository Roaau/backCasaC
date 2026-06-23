import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const Usuario = sequelize.define("Usuario", {
  usuario_id:  { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nombre:      { type: DataTypes.STRING, allowNull: false },
  usuario:     { type: DataTypes.STRING, allowNull: false, unique: true },
  contrasena:  { type: DataTypes.STRING, allowNull: false },
  rol_id:      { type: DataTypes.INTEGER, allowNull: false },
  empresa_id:  { type: DataTypes.INTEGER, allowNull: true, defaultValue: 1 },
  sucursal_id: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 1 },
  foto_perfil: { type: DataTypes.TEXT, allowNull: true },
  color_tema:  { type: DataTypes.STRING(7), allowNull: true },
  activo:        { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  es_superadmin: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }
}, { tableName: "usuarios", timestamps: false });

export default Usuario;

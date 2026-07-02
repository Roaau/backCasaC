import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const Auditoria = sequelize.define("Auditoria", {
  auditoria_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  usuario_id:   { type: DataTypes.INTEGER, allowNull: true },
  empresa_id:   { type: DataTypes.INTEGER, allowNull: true },
  sucursal_id:  { type: DataTypes.INTEGER, allowNull: true },
  accion:       { type: DataTypes.STRING(80), allowNull: false },
  entidad:      { type: DataTypes.STRING(80), allowNull: false },
  entidad_id:   { type: DataTypes.STRING(80), allowNull: true },
  detalle:      { type: DataTypes.JSONB, allowNull: true },
  ip:           { type: DataTypes.STRING(80), allowNull: true },
  user_agent:   { type: DataTypes.TEXT, allowNull: true },
  fecha:        { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: "auditoria", timestamps: false });

export default Auditoria;

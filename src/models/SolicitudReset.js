import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const SolicitudReset = sequelize.define("SolicitudReset", {
  id:        { type: DataTypes.INTEGER,    primaryKey: true, autoIncrement: true },
  usuario:   { type: DataTypes.STRING(100), allowNull: false },
  codigo:    { type: DataTypes.STRING(6),   allowNull: false },
  expira_en: { type: DataTypes.DATE,        allowNull: false },
  usado:     { type: DataTypes.BOOLEAN,     defaultValue: false }
}, { tableName: "solicitudes_reset", timestamps: false });

export default SolicitudReset;

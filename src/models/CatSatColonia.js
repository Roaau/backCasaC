import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const CatSatColonia = sequelize.define("CatSatColonia", {
  id:                { type: DataTypes.INTEGER,    primaryKey: true, autoIncrement: true },
  cp:                { type: DataTypes.STRING(5),  allowNull: false },
  colonia:           { type: DataTypes.STRING(150), allowNull: false },
  tipo_asentamiento: { type: DataTypes.STRING(60),  allowNull: true }
}, {
  tableName: "cat_sat_colonia",
  timestamps: false,
  indexes: [{ fields: ["cp"] }]
});

export default CatSatColonia;

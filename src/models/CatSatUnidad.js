import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const CatSatUnidad = sequelize.define("CatSatUnidad", {
  clave:       { type: DataTypes.STRING(6),   primaryKey: true },
  nombre:      { type: DataTypes.STRING(150), allowNull: false },
  descripcion: { type: DataTypes.STRING(300), allowNull: true }
}, {
  tableName: "cat_sat_unidad",
  timestamps: false
});

export default CatSatUnidad;

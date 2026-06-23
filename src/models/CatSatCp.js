import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const CatSatCp = sequelize.define("CatSatCp", {
  cp:        { type: DataTypes.STRING(5),   primaryKey: true },
  estado:    { type: DataTypes.STRING(60),  allowNull: true },
  municipio: { type: DataTypes.STRING(120), allowNull: true }
}, {
  tableName: "cat_sat_cp",
  timestamps: false
});

export default CatSatCp;

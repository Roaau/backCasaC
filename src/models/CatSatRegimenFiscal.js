import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const CatSatRegimenFiscal = sequelize.define("CatSatRegimenFiscal", {
  clave:         { type: DataTypes.STRING(3),   primaryKey: true },
  descripcion:   { type: DataTypes.STRING(200), allowNull: false },
  aplica_fisica: { type: DataTypes.BOOLEAN,     allowNull: false, defaultValue: true },
  aplica_moral:  { type: DataTypes.BOOLEAN,     allowNull: false, defaultValue: true }
}, {
  tableName: "cat_sat_regimen_fiscal",
  timestamps: false
});

export default CatSatRegimenFiscal;

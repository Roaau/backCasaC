import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const CatSatUsoCfdi = sequelize.define("CatSatUsoCfdi", {
  clave:         { type: DataTypes.STRING(4),   primaryKey: true },
  descripcion:   { type: DataTypes.STRING(200), allowNull: false },
  aplica_fisica: { type: DataTypes.BOOLEAN,     allowNull: false, defaultValue: true },
  aplica_moral:  { type: DataTypes.BOOLEAN,     allowNull: false, defaultValue: true }
}, {
  tableName: "cat_sat_uso_cfdi",
  timestamps: false
});

export default CatSatUsoCfdi;

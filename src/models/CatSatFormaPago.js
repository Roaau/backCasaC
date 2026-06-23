import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const CatSatFormaPago = sequelize.define("CatSatFormaPago", {
  clave:       { type: DataTypes.STRING(2),   primaryKey: true },
  descripcion: { type: DataTypes.STRING(150), allowNull: false }
}, {
  tableName: "cat_sat_forma_pago",
  timestamps: false
});

export default CatSatFormaPago;

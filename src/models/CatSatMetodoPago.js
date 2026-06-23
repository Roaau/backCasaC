import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const CatSatMetodoPago = sequelize.define("CatSatMetodoPago", {
  clave:       { type: DataTypes.STRING(3),   primaryKey: true },
  descripcion: { type: DataTypes.STRING(150), allowNull: false }
}, {
  tableName: "cat_sat_metodo_pago",
  timestamps: false
});

export default CatSatMetodoPago;

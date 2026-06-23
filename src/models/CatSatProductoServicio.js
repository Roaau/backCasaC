import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const CatSatProductoServicio = sequelize.define("CatSatProductoServicio", {
  clave:       { type: DataTypes.STRING(8),   primaryKey: true },
  descripcion: { type: DataTypes.STRING(300), allowNull: false }
}, {
  tableName: "cat_sat_producto_servicio",
  timestamps: false
});

export default CatSatProductoServicio;

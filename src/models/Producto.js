import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const Producto = sequelize.define("Producto", {
  producto_id:      { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id:       { type: DataTypes.INTEGER, allowNull: true, defaultValue: 1 },
  codigo_barras:    { type: DataTypes.STRING },
  nombre:           { type: DataTypes.STRING },
  descripcion:      { type: DataTypes.STRING },
  categoria:        { type: DataTypes.STRING },
  precio_menudeo:   { type: DataTypes.DECIMAL(10, 2) },
  precio_mayoreo:   { type: DataTypes.DECIMAL(10, 2) },
  precio_oferta:    { type: DataTypes.DECIMAL(10, 2) },
  stock_actual:     { type: DataTypes.INTEGER },
  stock_minimo:     { type: DataTypes.INTEGER },
  activo:           { type: DataTypes.BOOLEAN },
  minimo_mayoreo:   { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },
  clave_sat:        { type: DataTypes.STRING(8), allowNull: false, defaultValue: "01010101" },
  clave_unidad_sat: { type: DataTypes.STRING(6), allowNull: false, defaultValue: "H87" },
  objeto_imp:       { type: DataTypes.STRING(3), allowNull: false, defaultValue: "02" }
}, { tableName: "productos", timestamps: false });

export default Producto;

import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const Producto = sequelize.define("Producto", {
  producto_id:      { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id:       { type: DataTypes.INTEGER, allowNull: false },
  codigo_barras:    { type: DataTypes.STRING },
  nombre:           { type: DataTypes.STRING },
  descripcion:      { type: DataTypes.STRING },
  categoria:        { type: DataTypes.STRING },
  precio_menudeo:   { type: DataTypes.DECIMAL(10, 2) },
  precio_mayoreo:   { type: DataTypes.DECIMAL(10, 2) },
  precio_oferta:    { type: DataTypes.DECIMAL(10, 2) },
  stock_actual:     { type: DataTypes.DECIMAL(12, 3) },
  stock_minimo:     { type: DataTypes.DECIMAL(12, 3) },
  activo:           { type: DataTypes.BOOLEAN },
  minimo_mayoreo:   { type: DataTypes.DECIMAL(12, 3), allowNull: true, defaultValue: null },
  // POS general: atributos opcionales segun el giro del negocio
  unidad_venta:     { type: DataTypes.STRING(10), allowNull: false, defaultValue: "pieza" },
  precio_compra:    { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  marca:            { type: DataTypes.STRING(100), allowNull: true },
  modelo:           { type: DataTypes.STRING(100), allowNull: true },
  talla:            { type: DataTypes.STRING(30), allowNull: true },
  color:            { type: DataTypes.STRING(50), allowNull: true },
  lote:             { type: DataTypes.STRING(60), allowNull: true },
  fecha_caducidad:  { type: DataTypes.DATEONLY, allowNull: true },
  requiere_receta:  { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  ubicacion:        { type: DataTypes.STRING(60), allowNull: true },
  clave_sat:        { type: DataTypes.STRING(8), allowNull: false, defaultValue: "01010101" },
  clave_unidad_sat: { type: DataTypes.STRING(6), allowNull: false, defaultValue: "H87" },
  objeto_imp:       { type: DataTypes.STRING(3), allowNull: false, defaultValue: "02" }
}, { tableName: "productos", timestamps: false });

export default Producto;

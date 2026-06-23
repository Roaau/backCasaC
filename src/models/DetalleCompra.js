import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const DetalleCompra = sequelize.define("DetalleCompra", {
  detalle_id:      { type: DataTypes.INTEGER,       primaryKey: true, autoIncrement: true },
  compra_id:       { type: DataTypes.INTEGER,       allowNull: false },
  producto_id:     { type: DataTypes.INTEGER,       allowNull: true },
  nombre_producto: { type: DataTypes.STRING(255),   allowNull: false },
  cantidad:        { type: DataTypes.INTEGER,       allowNull: false },
  costo_unitario:  { type: DataTypes.DECIMAL(10,2), allowNull: false },
  subtotal:        { type: DataTypes.DECIMAL(10,2), allowNull: false }
}, { tableName: "detalle_compras", timestamps: false });

export default DetalleCompra;

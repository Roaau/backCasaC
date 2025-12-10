import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const DetalleVenta = sequelize.define("DetalleVenta", {
  detalle_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  venta_id: { type: DataTypes.INTEGER, allowNull: false },
  producto_id: { type: DataTypes.INTEGER, allowNull: false },
  cantidad: { type: DataTypes.INTEGER, allowNull: false },
  precio_unitario: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  subtotal: { type: DataTypes.DECIMAL(10, 2), allowNull: false }
}, {
  tableName: "detalle_ventas",
  timestamps: false
});

export default DetalleVenta;

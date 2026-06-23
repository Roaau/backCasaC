import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const DetalleCotizacion = sequelize.define("DetalleCotizacion", {
  detalle_id:      { type: DataTypes.INTEGER,       primaryKey: true, autoIncrement: true },
  cotizacion_id:   { type: DataTypes.INTEGER,       allowNull: false },
  producto_id:     { type: DataTypes.INTEGER,       allowNull: true },
  nombre_producto: { type: DataTypes.STRING(300),   allowNull: false },
  cantidad:        { type: DataTypes.DECIMAL(10,2), allowNull: false },
  precio_unitario: { type: DataTypes.DECIMAL(10,2), allowNull: false },
  descuento_pct:   { type: DataTypes.DECIMAL(5,2),  defaultValue: 0 },
  subtotal:        { type: DataTypes.DECIMAL(10,2), allowNull: false }
}, { tableName: "detalle_cotizaciones", timestamps: false });

export default DetalleCotizacion;

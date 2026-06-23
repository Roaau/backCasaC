import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const DetalleDevolucion = sequelize.define('DetalleDevolucion', {
  detalle_dev_id:  { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  devolucion_id:   { type: DataTypes.INTEGER, allowNull: false },
  producto_id:     { type: DataTypes.INTEGER, allowNull: true },
  nombre_producto: { type: DataTypes.STRING(255), allowNull: true },
  cantidad:        { type: DataTypes.INTEGER, allowNull: false },
  precio_unitario: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  subtotal:        { type: DataTypes.DECIMAL(10, 2), allowNull: false }
}, { tableName: 'detalle_devoluciones', timestamps: false });

export default DetalleDevolucion;

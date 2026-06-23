import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const StockSucursal = sequelize.define('StockSucursal', {
  stock_id:     { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  producto_id:  { type: DataTypes.INTEGER, allowNull: false },
  sucursal_id:  { type: DataTypes.INTEGER, allowNull: false },
  stock_actual: { type: DataTypes.INTEGER, defaultValue: 0 },
  stock_minimo: { type: DataTypes.INTEGER, defaultValue: 0 }
}, {
  tableName: 'stock_sucursal',
  timestamps: false,
  indexes: [{ unique: true, fields: ['producto_id', 'sucursal_id'] }]
});

export default StockSucursal;

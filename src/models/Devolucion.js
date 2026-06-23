import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Devolucion = sequelize.define('Devolucion', {
  devolucion_id:  { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  venta_id:       { type: DataTypes.INTEGER, allowNull: true },
  folio_venta:    { type: DataTypes.STRING(20), allowNull: true },
  fecha:          { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  motivo:         { type: DataTypes.TEXT, allowNull: true },
  usuario_id:     { type: DataTypes.INTEGER, allowNull: true },
  sucursal_id:    { type: DataTypes.INTEGER, allowNull: true },
  total_devuelto: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 }
}, { tableName: 'devoluciones', timestamps: false });

export default Devolucion;

import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Caja = sequelize.define('Caja', {
  caja_id:             { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  sucursal_id:         { type: DataTypes.INTEGER, allowNull: false },
  usuario_apertura_id: { type: DataTypes.INTEGER, allowNull: false },
  usuario_cierre_id:   { type: DataTypes.INTEGER, allowNull: true },
  monto_inicial:       { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  monto_final:         { type: DataTypes.DECIMAL(12, 2), allowNull: true },
  fecha_apertura:      { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  fecha_cierre:        { type: DataTypes.DATE, allowNull: true }
}, { tableName: 'caja', timestamps: false });

export default Caja;

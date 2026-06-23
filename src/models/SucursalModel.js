import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Sucursal = sequelize.define('Sucursal', {
  sucursal_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id:  { type: DataTypes.INTEGER, allowNull: false },
  nombre:      { type: DataTypes.STRING(100), allowNull: false },
  direccion:   { type: DataTypes.STRING(255) },
  cp_sat:      { type: DataTypes.STRING(5), allowNull: false, defaultValue: '06600' },
  latitud:     { type: DataTypes.DECIMAL(10, 8) },
  longitud:    { type: DataTypes.DECIMAL(11, 8) },
  activa:      { type: DataTypes.BOOLEAN, defaultValue: true },
  logo_b64:    { type: DataTypes.TEXT, allowNull: true }
}, { tableName: 'sucursales', timestamps: false });

export default Sucursal;

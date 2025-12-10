// src/models/MovimientoCaja.js
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const MovimientoCaja = sequelize.define('MovimientoCaja', {
  movimiento_caja_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  caja_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  usuario_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  tipo_movimiento: {
    type: DataTypes.STRING(50),
    allowNull: false // 'INGRESO' | 'EGRESO'
  },
  monto: {
    type: DataTypes.DECIMAL(10,2),
    allowNull: false
  },
  concepto: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  fecha: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'movimiento_caja', // coincide con tu BD
  timestamps: false
});

export default MovimientoCaja;

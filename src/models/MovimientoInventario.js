import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const MovimientoInventario = sequelize.define('MovimientoInventario', {
  movimiento_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  producto_id: { // Qué producto se movió
    type: DataTypes.INTEGER,
    allowNull: false
  },
  usuario_id: { // Quién hizo el movimiento
    type: DataTypes.INTEGER,
    allowNull: false
  },
  tipo_movimiento: { 
    type: DataTypes.STRING(20), // 'ENTRADA' (Compra) o 'AJUSTE' (Corrección/Merma)
    allowNull: false
  },
  cantidad: { // Cuántos entraron o salieron
    type: DataTypes.INTEGER,
    allowNull: false
  },
  stock_anterior: { // Dato útil para auditoría: cuánto había antes
    type: DataTypes.INTEGER,
    allowNull: true
  },
  stock_nuevo: { // Cuánto quedó después
    type: DataTypes.INTEGER,
    allowNull: true
  },
  observaciones: { // "Factura 504", "Se rompió", "Conteo mensual"
    type: DataTypes.STRING(255)
  },
  fecha: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'movimientos_inventario',
  timestamps: false
});

export default MovimientoInventario;
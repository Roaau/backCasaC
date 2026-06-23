import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';
import Producto from './Producto.js';
import Usuario from './Usuario.js';

const MovimientoInventario = sequelize.define('MovimientoInventario', {
  movimiento_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  producto_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  nombre_producto: { type: DataTypes.STRING(255), allowNull: true },
  codigo_barras: { type: DataTypes.STRING(100), allowNull: true },
  usuario_id: { 
    type: DataTypes.INTEGER,
    allowNull: false
  },
  tipo_movimiento: { 
    type: DataTypes.STRING(20), 
    allowNull: false
  },
  cantidad: { 
    type: DataTypes.INTEGER,
    allowNull: false
  },
  stock_anterior: { 
    type: DataTypes.INTEGER,
    allowNull: true
  },
  stock_nuevo: { 
    type: DataTypes.INTEGER,
    allowNull: true
  },
  motivo: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  observaciones: {
    type: DataTypes.STRING(255)
  },
  sucursal_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  fecha: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'movimientos_inventario',
  timestamps: false
});

MovimientoInventario.belongsTo(Producto,  { foreignKey: 'producto_id', onDelete: 'SET NULL' });
MovimientoInventario.belongsTo(Usuario,   { foreignKey: 'usuario_id' });

export default MovimientoInventario;
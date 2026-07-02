import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Notificacion = sequelize.define('Notificacion', {
  notificacion_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id:      { type: DataTypes.INTEGER, allowNull: false },
  sucursal_id:     { type: DataTypes.INTEGER, allowNull: true },
  usuario_id:      { type: DataTypes.INTEGER, allowNull: true },
  tipo:            { type: DataTypes.STRING(40), allowNull: false },
  severidad:       { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'media' },
  titulo:          { type: DataTypes.STRING(160), allowNull: false },
  mensaje:         { type: DataTypes.TEXT, allowNull: false },
  entidad:         { type: DataTypes.STRING(80), allowNull: true },
  entidad_id:      { type: DataTypes.STRING(80), allowNull: true },
  estado:          { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'nueva' },
  detalle:         { type: DataTypes.JSONB, allowNull: true },
  creada_en:       { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  vista_en:        { type: DataTypes.DATE, allowNull: true },
  resuelta_en:     { type: DataTypes.DATE, allowNull: true }
}, { tableName: 'notificaciones', timestamps: false });

export default Notificacion;

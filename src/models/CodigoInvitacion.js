import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const CodigoInvitacion = sequelize.define('CodigoInvitacion', {
  codigo_id:      { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id:     { type: DataTypes.INTEGER, allowNull: false },
  sucursal_id:    { type: DataTypes.INTEGER, allowNull: true },
  codigo:         { type: DataTypes.STRING(12), allowNull: false, unique: true },
  usos_restantes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 5 },
  rol_id:         { type: DataTypes.INTEGER, allowNull: false, defaultValue: 2 },
  activo:         { type: DataTypes.BOOLEAN, defaultValue: true },
  creado_por:     { type: DataTypes.INTEGER, allowNull: false }
}, { tableName: 'codigos_invitacion', timestamps: true });

export default CodigoInvitacion;

import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Empresa = sequelize.define('Empresa', {
  empresa_id:      { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  rfc:             { type: DataTypes.STRING(13), allowNull: true, unique: true },
  razon_social:    { type: DataTypes.STRING(255), allowNull: true },
  regimen_fiscal:  { type: DataTypes.STRING(4), allowNull: true },
  logo_empresa:    { type: DataTypes.TEXT, allowNull: true },
  activo:          { type: DataTypes.BOOLEAN, defaultValue: true },
  estado:          { type: DataTypes.STRING(20), defaultValue: 'activa' },
  email_contacto:  { type: DataTypes.STRING(255), allowNull: true, unique: true },
  notas_admin:     { type: DataTypes.TEXT, allowNull: true },
  creado_en:       { type: DataTypes.DATE, allowNull: true, defaultValue: DataTypes.NOW }
}, { tableName: 'empresas', timestamps: false });

export default Empresa;

import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const ConfiguracionFiscal = sequelize.define("ConfiguracionFiscal", {
  empresa_id:       { type: DataTypes.INTEGER,    primaryKey: true, allowNull: false },
  rfc_emisor:       { type: DataTypes.STRING(13),  allowNull: true },
  nombre_emisor:    { type: DataTypes.STRING(300), allowNull: true },
  cp_emisor:        { type: DataTypes.STRING(5),   allowNull: true },
  regimen_emisor:   { type: DataTypes.STRING(3),   allowNull: true },
  csd_cert_b64:     { type: DataTypes.TEXT,        allowNull: true },
  csd_key_b64:      { type: DataTypes.TEXT,        allowNull: true },
  csd_password:     { type: DataTypes.STRING(300), allowNull: true },
  pac_nombre:       { type: DataTypes.STRING(50),  allowNull: true },
  pac_url:          { type: DataTypes.STRING(500), allowNull: true },
  pac_usuario:      { type: DataTypes.STRING(300), allowNull: true },
  pac_password:     { type: DataTypes.STRING(300), allowNull: true },
  email_host:       { type: DataTypes.STRING(100), allowNull: true },
  email_port:       { type: DataTypes.INTEGER,     allowNull: true, defaultValue: 587 },
  email_user:       { type: DataTypes.STRING(200), allowNull: true },
  email_pass:       { type: DataTypes.STRING(300), allowNull: true },
  email_from:       { type: DataTypes.STRING(200), allowNull: true },
  logo_b64:         { type: DataTypes.TEXT,        allowNull: true },
  nombre_negocio:   { type: DataTypes.STRING(200), allowNull: true },
  actualizado_en:   { type: DataTypes.DATE,        allowNull: true, defaultValue: DataTypes.NOW }
}, {
  tableName: "configuracion_fiscal",
  timestamps: false
});

export default ConfiguracionFiscal;

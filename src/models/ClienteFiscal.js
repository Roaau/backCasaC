import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const ClienteFiscal = sequelize.define("ClienteFiscal", {
  cliente_id:       { type: DataTypes.INTEGER,    primaryKey: true, autoIncrement: true },
  empresa_id:       { type: DataTypes.INTEGER,     allowNull: false },
  rfc:              { type: DataTypes.STRING(13),  allowNull: false },
  nombre_fiscal:    { type: DataTypes.STRING(300), allowNull: false },
  cp_fiscal:        { type: DataTypes.STRING(5),   allowNull: false },
  regimen_fiscal:   { type: DataTypes.STRING(3),   allowNull: false },
  uso_cfdi_default: { type: DataTypes.STRING(4),   allowNull: false, defaultValue: "G03" },
  email:            { type: DataTypes.STRING(150), allowNull: true },
  activo:           { type: DataTypes.BOOLEAN,     allowNull: false, defaultValue: true },
  creado_en:        { type: DataTypes.DATE,        allowNull: false, defaultValue: DataTypes.NOW }
}, {
  tableName: "clientes_fiscales",
  timestamps: false,
  indexes: [{ unique: true, fields: ["empresa_id", "rfc"] }]
});

export default ClienteFiscal;

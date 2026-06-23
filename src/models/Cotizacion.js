import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const Cotizacion = sequelize.define("Cotizacion", {
  cotizacion_id:    { type: DataTypes.INTEGER,       primaryKey: true, autoIncrement: true },
  empresa_id:       { type: DataTypes.INTEGER,       allowNull: false },
  sucursal_id:      { type: DataTypes.INTEGER,       allowNull: false },
  usuario_id:       { type: DataTypes.INTEGER,       allowNull: false },
  folio:            { type: DataTypes.STRING(30),    allowNull: true },
  cliente_nombre:   { type: DataTypes.STRING(200),   allowNull: true },
  cliente_telefono: { type: DataTypes.STRING(20),    allowNull: true },
  cliente_email:    { type: DataTypes.STRING(200),   allowNull: true },
  estado:           { type: DataTypes.STRING(20),    defaultValue: 'BORRADOR' }, // BORRADOR|ENVIADA|ACEPTADA|VENCIDA
  total:            { type: DataTypes.DECIMAL(10,2), allowNull: false, defaultValue: 0 },
  vigencia_dias:    { type: DataTypes.INTEGER,       defaultValue: 7 },
  notas:            { type: DataTypes.TEXT,          allowNull: true },
  fecha:            { type: DataTypes.DATE,          defaultValue: DataTypes.NOW }
}, { tableName: "cotizaciones", timestamps: false });

export default Cotizacion;

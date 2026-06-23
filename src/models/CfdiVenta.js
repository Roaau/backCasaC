import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const CfdiVenta = sequelize.define("CfdiVenta", {
  cfdi_id:         { type: DataTypes.INTEGER,    primaryKey: true, autoIncrement: true },
  venta_id:        { type: DataTypes.INTEGER,    allowNull: false },
  cliente_id:      { type: DataTypes.INTEGER,    allowNull: true },
  receptor_rfc:    { type: DataTypes.STRING(13),  allowNull: false },
  receptor_nombre: { type: DataTypes.STRING(300), allowNull: false },
  receptor_cp:     { type: DataTypes.STRING(5),   allowNull: false },
  receptor_regimen:{ type: DataTypes.STRING(3),   allowNull: false },
  uso_cfdi:        { type: DataTypes.STRING(4),   allowNull: false },
  cfdi_uuid:       { type: DataTypes.UUID,        allowNull: true },
  estado:          { type: DataTypes.STRING(20),  allowNull: false, defaultValue: "PENDIENTE" },
  xml_cfdi:        { type: DataTypes.TEXT,        allowNull: true },
  pdf_url:         { type: DataTypes.STRING(500), allowNull: true },
  creado_en:       { type: DataTypes.DATE,        allowNull: false, defaultValue: DataTypes.NOW }
}, {
  tableName: "cfdi_ventas",
  timestamps: false
});

export default CfdiVenta;

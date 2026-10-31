import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

// Varios lotes por producto y sucursal, cada uno con su caducidad y cantidad.
// productos.fecha_caducidad / productos.lote guardan el lote que caduca primero (para avisos y reportes).
const Lote = sequelize.define("Lote", {
  lote_id:         { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id:      { type: DataTypes.INTEGER, allowNull: false },
  producto_id:     { type: DataTypes.INTEGER, allowNull: false },
  sucursal_id:     { type: DataTypes.INTEGER, allowNull: false },
  lote:            { type: DataTypes.STRING(60), allowNull: true },
  fecha_caducidad: { type: DataTypes.DATEONLY, allowNull: true },
  cantidad:        { type: DataTypes.DECIMAL(12, 3), allowNull: false, defaultValue: 0 },
  creado_en:       { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
}, { tableName: "lotes", timestamps: false });

export default Lote;

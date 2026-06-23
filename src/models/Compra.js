import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const Compra = sequelize.define("Compra", {
  compra_id:    { type: DataTypes.INTEGER,      primaryKey: true, autoIncrement: true },
  empresa_id:   { type: DataTypes.INTEGER,      allowNull: false },
  sucursal_id:  { type: DataTypes.INTEGER,      allowNull: false },
  proveedor_id: { type: DataTypes.INTEGER,      allowNull: true },
  usuario_id:   { type: DataTypes.INTEGER,      allowNull: false },
  folio:        { type: DataTypes.STRING(30),   allowNull: true },
  total:        { type: DataTypes.DECIMAL(10,2), allowNull: false },
  notas:        { type: DataTypes.TEXT,         allowNull: true },
  fecha:        { type: DataTypes.DATE,         defaultValue: DataTypes.NOW }
}, { tableName: "compras", timestamps: false });

export default Compra;

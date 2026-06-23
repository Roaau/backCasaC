import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const PagoCredito = sequelize.define("PagoCredito", {
  pago_id:    { type: DataTypes.INTEGER,       primaryKey: true, autoIncrement: true },
  venta_id:   { type: DataTypes.INTEGER,       allowNull: false },
  monto:      { type: DataTypes.DECIMAL(10,2), allowNull: false },
  fecha:      { type: DataTypes.DATE,          defaultValue: DataTypes.NOW },
  usuario_id: { type: DataTypes.INTEGER,       allowNull: true },
  notas:      { type: DataTypes.STRING(300),   allowNull: true }
}, { tableName: "pagos_credito", timestamps: false });

export default PagoCredito;

import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const Venta = sequelize.define("Venta", {
  venta_id:      { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  folio:         { type: DataTypes.STRING(20), allowNull: false, unique: true },
  usuario_id:    { type: DataTypes.INTEGER, allowNull: false },
  sucursal_id:   { type: DataTypes.INTEGER, allowNull: true, defaultValue: 1 },
  fecha:         { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  total:         { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  tipo_venta:          { type: DataTypes.STRING(20),    allowNull: false, defaultValue: "Tienda" },
  pedido_numero:       { type: DataTypes.STRING(50),    allowNull: true },
  forma_pago:          { type: DataTypes.STRING(2),     allowNull: true },
  descuento_porcentaje:{ type: DataTypes.DECIMAL(5,2),  defaultValue: 0 },
  tipo_pago:           { type: DataTypes.STRING(20),    defaultValue: 'efectivo' },
  nombre_cliente:      { type: DataTypes.STRING(200),   allowNull: true },
  saldo_pendiente:     { type: DataTypes.DECIMAL(10,2), defaultValue: 0 }
}, { tableName: "ventas", timestamps: false });

export default Venta;

import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const Venta = sequelize.define("Venta", {
  venta_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  usuario_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  fecha: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  total: {
    type: DataTypes.DECIMAL(10,2),
    allowNull: false
  },
  tipo_venta: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: "Tienda"
  },
  pedido_numero: {
    type: DataTypes.STRING(50),
    allowNull: true
  }
}, {
  tableName: "ventas",
  timestamps: false
});

export default Venta;

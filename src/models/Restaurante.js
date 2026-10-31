import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

// Restaurantes: mesas, comandas (cuentas abiertas) y los platillos de cada comanda.
export const Mesa = sequelize.define("Mesa", {
  mesa_id:     { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id:  { type: DataTypes.INTEGER, allowNull: false },
  sucursal_id: { type: DataTypes.INTEGER, allowNull: false },
  nombre:      { type: DataTypes.STRING(40), allowNull: false },
  orden:       { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  activa:      { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
}, { tableName: "mesas", timestamps: false });

// estado: ABIERTA | CERRADA (cobrada) | CANCELADA
export const Comanda = sequelize.define("Comanda", {
  comanda_id:     { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id:     { type: DataTypes.INTEGER, allowNull: false },
  sucursal_id:    { type: DataTypes.INTEGER, allowNull: false },
  mesa_id:        { type: DataTypes.INTEGER, allowNull: true },   // null = para llevar
  nombre_cliente: { type: DataTypes.STRING(80), allowNull: true },
  personas:       { type: DataTypes.INTEGER, allowNull: true },
  usuario_id:     { type: DataTypes.INTEGER, allowNull: false },  // quien la abrio (mesero)
  estado:         { type: DataTypes.STRING(15), allowNull: false, defaultValue: "ABIERTA" },
  venta_id:       { type: DataTypes.INTEGER, allowNull: true },
  notas:          { type: DataTypes.STRING(200), allowNull: true },
  abierta_en:     { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  cerrada_en:     { type: DataTypes.DATE, allowNull: true }
}, { tableName: "comandas", timestamps: false });

// estado: CAPTURADO (aun no va a cocina) | EN_COCINA | LISTO | ENTREGADO | CANCELADO
export const ComandaItem = sequelize.define("ComandaItem", {
  item_id:           { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  comanda_id:        { type: DataTypes.INTEGER, allowNull: false },
  producto_id:       { type: DataTypes.INTEGER, allowNull: false },
  nombre:            { type: DataTypes.STRING(200), allowNull: false },
  cantidad:          { type: DataTypes.DECIMAL(10, 3), allowNull: false },
  precio_unitario:   { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  notas:             { type: DataTypes.STRING(200), allowNull: true },
  estado:            { type: DataTypes.STRING(15), allowNull: false, defaultValue: "CAPTURADO" },
  enviado_cocina_en: { type: DataTypes.DATE, allowNull: true },
  listo_en:          { type: DataTypes.DATE, allowNull: true }
}, { tableName: "comanda_items", timestamps: false });

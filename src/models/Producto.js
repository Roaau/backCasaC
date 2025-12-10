import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const Producto = sequelize.define("Producto", {
  producto_id: { 
    type: DataTypes.INTEGER, 
    primaryKey: true, 
    autoIncrement: true 
  },
  codigo_barras: { type: DataTypes.STRING },
  nombre: { type: DataTypes.STRING },
  descripcion: { type: DataTypes.STRING },
  
  categoria: { type: DataTypes.STRING }, 
  
  precio_menudeo: { type: DataTypes.DECIMAL(10, 2) },
  precio_mayoreo: { type: DataTypes.DECIMAL(10, 2) },
  precio_oferta: { type: DataTypes.DECIMAL(10, 2) },
  stock_actual: { type: DataTypes.INTEGER },
  stock_minimo: { type: DataTypes.INTEGER },
  activo: { type: DataTypes.BOOLEAN }
}, {
  tableName: "productos",
  timestamps: false
});

export default Producto;
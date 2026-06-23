import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const CatalogoMaestro = sequelize.define('CatalogoMaestro', {
  catalogo_id:          { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  codigo_barras:        { type: DataTypes.STRING(50),  allowNull: true },
  nombre:               { type: DataTypes.STRING(200), allowNull: false },
  descripcion:          { type: DataTypes.STRING(500), allowNull: true },
  categoria_sugerida:   { type: DataTypes.STRING(100), allowNull: true },
  precio_menudeo:       { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  precio_mayoreo:       { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  precio_oferta:        { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  stock_minimo:         { type: DataTypes.INTEGER, defaultValue: 0 },
  minimo_mayoreo:       { type: DataTypes.INTEGER, allowNull: true },
  clave_sat_sugerida:   { type: DataTypes.STRING(8),  defaultValue: '01010101' },
  unidad_sat_sugerida:  { type: DataTypes.STRING(6),  defaultValue: 'H87' },
  objeto_imp:           { type: DataTypes.STRING(3),  defaultValue: '02' },
}, { tableName: 'catalogo_maestro_ferreteria', timestamps: false });

export default CatalogoMaestro;

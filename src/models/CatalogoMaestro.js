import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

// Productos de los catalogos base. El nombre de la tabla es historico (empezo solo con ferreteria);
// cada fila pertenece a un catalogo por giro via catalogo_giro_id (ver CatalogoGiro).
const CatalogoMaestro = sequelize.define('CatalogoMaestro', {
  catalogo_id:          { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  catalogo_giro_id:     { type: DataTypes.INTEGER, allowNull: true },
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
  // POS general: atributos opcionales segun el giro
  unidad_venta:         { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'pieza' },
  precio_compra:        { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  marca:                { type: DataTypes.STRING(100), allowNull: true },
  modelo:               { type: DataTypes.STRING(100), allowNull: true },
  talla:                { type: DataTypes.STRING(30), allowNull: true },
  color:                { type: DataTypes.STRING(50), allowNull: true },
  requiere_receta:      { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
}, { tableName: 'catalogo_maestro_ferreteria', timestamps: false });

export default CatalogoMaestro;

import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

// Un catalogo base por archivo Excel (ej. "Abarrotes basico", giro abarrotes).
// Sus productos viven en catalogo_maestro_ferreteria con catalogo_giro_id.
const CatalogoGiro = sequelize.define('CatalogoGiro', {
  catalogo_giro_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nombre:           { type: DataTypes.STRING(120), allowNull: false },
  giro:             { type: DataTypes.STRING(40), allowNull: false, defaultValue: 'general' },
  archivo:          { type: DataTypes.STRING(255), allowNull: true },
  total_productos:  { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  creado_en:        { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, { tableName: 'catalogos_giro', timestamps: false });

export default CatalogoGiro;

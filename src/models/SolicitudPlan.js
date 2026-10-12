import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

// Peticion del admin de un negocio para cambiar su plan (usuarios extra, Pro/Multi, pago anual).
// Guarda como quedaria el plan; el superadmin la aprueba cuando recibe el pago.
const SolicitudPlan = sequelize.define('SolicitudPlan', {
  solicitud_id:      { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id:        { type: DataTypes.INTEGER, allowNull: false },
  tipo:              { type: DataTypes.STRING(20), allowNull: false },   // usuarios_extra | cambio_plan | periodo
  descripcion:       { type: DataTypes.STRING(200), allowNull: false },
  plan_nuevo:        { type: DataTypes.STRING(20), allowNull: false },
  periodo_nuevo:     { type: DataTypes.STRING(10), allowNull: false },
  limite_sucursales_nuevo: { type: DataTypes.INTEGER, allowNull: false },
  limite_usuarios_nuevo:   { type: DataTypes.INTEGER, allowNull: false },
  usuarios_extra_nuevo:    { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  precio_actual:     { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  precio_nuevo:      { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  estado:            { type: DataTypes.STRING(15), allowNull: false, defaultValue: 'pendiente' },
  motivo:            { type: DataTypes.STRING(300), allowNull: true },
  solicitado_por:    { type: DataTypes.INTEGER, allowNull: true },
  resuelta_por:      { type: DataTypes.INTEGER, allowNull: true },
  creada_en:         { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  resuelta_en:       { type: DataTypes.DATE, allowNull: true },
}, { tableName: 'solicitudes_plan', timestamps: false });

export default SolicitudPlan;

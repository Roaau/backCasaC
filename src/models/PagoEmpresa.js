import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

// Pago de mensualidad/anualidad recibido por transferencia (lo registra el superadmin)
const PagoEmpresa = sequelize.define('PagoEmpresa', {
  pago_id:        { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id:     { type: DataTypes.INTEGER, allowNull: false },
  fecha:          { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  monto:          { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  meses:          { type: DataTypes.INTEGER, allowNull: false },
  vence_hasta:    { type: DataTypes.DATEONLY, allowNull: false },
  registrado_por: { type: DataTypes.INTEGER, allowNull: true },
  notas:          { type: DataTypes.STRING(300), allowNull: true },
}, { tableName: 'pagos_empresa', timestamps: false });

export default PagoEmpresa;

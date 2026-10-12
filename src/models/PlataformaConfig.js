import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

// Ajustes de la plataforma que edita el superadmin (ej. datos para transferir el pago)
const PlataformaConfig = sequelize.define('PlataformaConfig', {
  clave: { type: DataTypes.STRING(60), primaryKey: true },
  valor: { type: DataTypes.TEXT, allowNull: true },
}, { tableName: 'plataforma_config', timestamps: false });

export const CLAVES_PAGO = ['pago_banco', 'pago_clabe', 'pago_titular'];

export async function datosDePago() {
  const filas = await PlataformaConfig.findAll({ where: { clave: CLAVES_PAGO } });
  const valor = (clave) => filas.find(f => f.clave === clave)?.valor || null;
  return { banco: valor('pago_banco'), clabe: valor('pago_clabe'), titular: valor('pago_titular') };
}

export default PlataformaConfig;

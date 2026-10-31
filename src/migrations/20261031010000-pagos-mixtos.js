'use strict';

// Cobro por transferencia y pago mixto: cuanto se cobro de cada forma en cada venta.
// Ventas anteriores quedan en NULL y se reparten segun tipo_pago (utils/pagos.js).
// El backend tambien agrega estas columnas al arrancar (ADD COLUMN IF NOT EXISTS).
module.exports = {
  async up(queryInterface) {
    const q = (sql) => queryInterface.sequelize.query(sql);
    await q('ALTER TABLE ventas ADD COLUMN IF NOT EXISTS monto_efectivo DECIMAL(10,2) NULL');
    await q('ALTER TABLE ventas ADD COLUMN IF NOT EXISTS monto_tarjeta DECIMAL(10,2) NULL');
    await q('ALTER TABLE ventas ADD COLUMN IF NOT EXISTS monto_transferencia DECIMAL(10,2) NULL');
    await q('ALTER TABLE ventas ADD COLUMN IF NOT EXISTS referencia_pago VARCHAR(60) NULL');
    await q('CREATE INDEX IF NOT EXISTS idx_auditoria_empresa_fecha ON auditoria (empresa_id, fecha DESC)');
  },

  async down(queryInterface) {
    const q = (sql) => queryInterface.sequelize.query(sql);
    await q('DROP INDEX IF EXISTS idx_auditoria_empresa_fecha');
    await q('ALTER TABLE ventas DROP COLUMN IF EXISTS referencia_pago');
    await q('ALTER TABLE ventas DROP COLUMN IF EXISTS monto_transferencia');
    await q('ALTER TABLE ventas DROP COLUMN IF EXISTS monto_tarjeta');
    await q('ALTER TABLE ventas DROP COLUMN IF EXISTS monto_efectivo');
  }
};

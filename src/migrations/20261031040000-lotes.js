'use strict';

// Varios lotes por producto y sucursal, cada uno con su caducidad y cantidad.
module.exports = {
  async up(queryInterface) {
    const q = (sql) => queryInterface.sequelize.query(sql);
    await q(`CREATE TABLE IF NOT EXISTS lotes (
      lote_id SERIAL PRIMARY KEY, empresa_id INTEGER NOT NULL, producto_id INTEGER NOT NULL, sucursal_id INTEGER NOT NULL,
      lote VARCHAR(60) NULL, fecha_caducidad DATE NULL, cantidad DECIMAL(12,3) NOT NULL DEFAULT 0,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
    await q('CREATE INDEX IF NOT EXISTS idx_lotes_producto_sucursal ON lotes (producto_id, sucursal_id)');
    await q('ALTER TABLE lotes ENABLE ROW LEVEL SECURITY');
  },
  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP TABLE IF EXISTS lotes');
  }
};

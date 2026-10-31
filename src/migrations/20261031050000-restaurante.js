'use strict';

// Restaurantes: mesas, comandas y platillos de cada comanda. El backend tambien las crea al arrancar (sync).
module.exports = {
  async up(queryInterface) {
    const q = (sql) => queryInterface.sequelize.query(sql);
    await q(`CREATE TABLE IF NOT EXISTS mesas (
      mesa_id SERIAL PRIMARY KEY, empresa_id INTEGER NOT NULL, sucursal_id INTEGER NOT NULL,
      nombre VARCHAR(40) NOT NULL, orden INTEGER NOT NULL DEFAULT 0, activa BOOLEAN NOT NULL DEFAULT true)`);
    await q(`CREATE TABLE IF NOT EXISTS comandas (
      comanda_id SERIAL PRIMARY KEY, empresa_id INTEGER NOT NULL, sucursal_id INTEGER NOT NULL, mesa_id INTEGER NULL,
      nombre_cliente VARCHAR(80) NULL, personas INTEGER NULL, usuario_id INTEGER NOT NULL,
      estado VARCHAR(15) NOT NULL DEFAULT 'ABIERTA', venta_id INTEGER NULL, notas VARCHAR(200) NULL,
      abierta_en TIMESTAMPTZ NOT NULL DEFAULT NOW(), cerrada_en TIMESTAMPTZ NULL)`);
    await q(`CREATE TABLE IF NOT EXISTS comanda_items (
      item_id SERIAL PRIMARY KEY, comanda_id INTEGER NOT NULL, producto_id INTEGER NOT NULL, nombre VARCHAR(200) NOT NULL,
      cantidad DECIMAL(10,3) NOT NULL, precio_unitario DECIMAL(10,2) NOT NULL, notas VARCHAR(200) NULL,
      estado VARCHAR(15) NOT NULL DEFAULT 'CAPTURADO', enviado_cocina_en TIMESTAMPTZ NULL, listo_en TIMESTAMPTZ NULL)`);
    for (const t of ['mesas', 'comandas', 'comanda_items']) await q(`ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY`);
    await q('CREATE INDEX IF NOT EXISTS idx_comandas_sucursal_estado ON comandas (sucursal_id, estado)');
    await q('CREATE INDEX IF NOT EXISTS idx_comanda_items_comanda ON comanda_items (comanda_id)');
  },
  async down(queryInterface) {
    for (const t of ['comanda_items', 'comandas', 'mesas']) await queryInterface.sequelize.query(`DROP TABLE IF EXISTS ${t}`);
  }
};

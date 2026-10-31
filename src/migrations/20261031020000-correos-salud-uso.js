'use strict';

// Correos automaticos (on/off por empresa), ultimo acceso de usuarios, errores del servidor y uso de pantallas.
// El backend tambien crea todo esto al arrancar (IF NOT EXISTS), asi que es idempotente.
module.exports = {
  async up(queryInterface) {
    const q = (sql) => queryInterface.sequelize.query(sql);
    await q('ALTER TABLE empresas ADD COLUMN IF NOT EXISTS correos_automaticos BOOLEAN NOT NULL DEFAULT true');
    await q('ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS ultimo_acceso TIMESTAMPTZ NULL');
    await q(`CREATE TABLE IF NOT EXISTS errores_servidor (
      error_id SERIAL PRIMARY KEY,
      fecha TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      metodo VARCHAR(10), ruta VARCHAR(200), status INTEGER,
      empresa_id INTEGER NULL, usuario_id INTEGER NULL)`);
    await q('CREATE INDEX IF NOT EXISTS idx_errores_servidor_fecha ON errores_servidor (fecha DESC)');
    await q(`CREATE TABLE IF NOT EXISTS uso_pantallas (
      fecha DATE NOT NULL, empresa_id INTEGER NOT NULL, usuario_id INTEGER NOT NULL,
      ruta VARCHAR(80) NOT NULL, visitas INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (fecha, empresa_id, usuario_id, ruta))`);
    await q('ALTER TABLE errores_servidor ENABLE ROW LEVEL SECURITY');
    await q('ALTER TABLE uso_pantallas ENABLE ROW LEVEL SECURITY');
  },

  async down(queryInterface) {
    const q = (sql) => queryInterface.sequelize.query(sql);
    await q('DROP TABLE IF EXISTS uso_pantallas');
    await q('DROP TABLE IF EXISTS errores_servidor');
    await q('ALTER TABLE usuarios DROP COLUMN IF EXISTS ultimo_acceso');
    await q('ALTER TABLE empresas DROP COLUMN IF EXISTS correos_automaticos');
  }
};

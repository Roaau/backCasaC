'use strict';

// Seguridad de sesion y PIN de autorizacion.
// - usuarios.intentos_fallidos / bloqueado_hasta: bloqueo de 15 min tras 5 contrasenas incorrectas.
// - usuarios.sesion_version: al subirla se invalidan todos los tokens del usuario ("cerrar sesion en todos los aparatos").
// - empresas.pin_autorizacion_*: codigo de 6 digitos que el empleado captura para tareas importantes.
// El backend tambien agrega estas columnas al arrancar (ADD COLUMN IF NOT EXISTS), asi que esta migracion es idempotente.
module.exports = {
  async up(queryInterface) {
    const q = (sql) => queryInterface.sequelize.query(sql);
    await q('ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS intentos_fallidos INTEGER NOT NULL DEFAULT 0');
    await q('ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS bloqueado_hasta TIMESTAMPTZ NULL');
    await q('ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS sesion_version INTEGER NOT NULL DEFAULT 0');
    await q('ALTER TABLE empresas ADD COLUMN IF NOT EXISTS pin_autorizacion_activo BOOLEAN NOT NULL DEFAULT false');
    await q('ALTER TABLE empresas ADD COLUMN IF NOT EXISTS pin_autorizacion_hash VARCHAR(100) NULL');
  },

  async down(queryInterface) {
    const q = (sql) => queryInterface.sequelize.query(sql);
    await q('ALTER TABLE usuarios DROP COLUMN IF EXISTS intentos_fallidos');
    await q('ALTER TABLE usuarios DROP COLUMN IF EXISTS bloqueado_hasta');
    await q('ALTER TABLE usuarios DROP COLUMN IF EXISTS sesion_version');
    await q('ALTER TABLE empresas DROP COLUMN IF EXISTS pin_autorizacion_activo');
    await q('ALTER TABLE empresas DROP COLUMN IF EXISTS pin_autorizacion_hash');
  }
};

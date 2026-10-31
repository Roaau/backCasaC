'use strict';

// Ventas sin internet: id_local generado en la caja para que al subirla no se duplique.
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query('ALTER TABLE ventas ADD COLUMN IF NOT EXISTS id_local VARCHAR(40) NULL');
    await queryInterface.sequelize.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_ventas_id_local ON ventas (sucursal_id, id_local) WHERE id_local IS NOT NULL');
  },
  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS idx_ventas_id_local');
    await queryInterface.sequelize.query('ALTER TABLE ventas DROP COLUMN IF EXISTS id_local');
  }
};

'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('clientes_fiscales');
    if (!table.empresa_id) {
      await queryInterface.addColumn('clientes_fiscales', 'empresa_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 1
      });
    }

    await queryInterface.sequelize.query('UPDATE clientes_fiscales SET empresa_id = COALESCE(empresa_id, 1)');

    await queryInterface.changeColumn('clientes_fiscales', 'empresa_id', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: null
    });

    await queryInterface.sequelize.query('ALTER TABLE clientes_fiscales DROP CONSTRAINT IF EXISTS clientes_fiscales_rfc_key');
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS clientes_fiscales_rfc');
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS clientes_fiscales_empresa_rfc
      ON clientes_fiscales (empresa_id, rfc)
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS clientes_fiscales_empresa_rfc');
    await queryInterface.changeColumn('clientes_fiscales', 'empresa_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: 1
    });
    await queryInterface.removeColumn('clientes_fiscales', 'empresa_id');
    await queryInterface.changeColumn('clientes_fiscales', 'rfc', {
      type: Sequelize.STRING(13),
      allowNull: false,
      unique: true
    });
  }
};

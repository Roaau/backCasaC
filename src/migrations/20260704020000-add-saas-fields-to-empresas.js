'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('empresas');

    if (!table.plan) {
      await queryInterface.addColumn('empresas', 'plan', {
        type: Sequelize.STRING(30),
        allowNull: false,
        defaultValue: 'basico'
      });
    }

    if (!table.precio_mensual) {
      await queryInterface.addColumn('empresas', 'precio_mensual', {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
      });
    }

    if (!table.fecha_vencimiento) {
      await queryInterface.addColumn('empresas', 'fecha_vencimiento', {
        type: Sequelize.DATEONLY,
        allowNull: true
      });
    }

    if (!table.limite_sucursales) {
      await queryInterface.addColumn('empresas', 'limite_sucursales', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1
      });
    }

    if (!table.limite_usuarios) {
      await queryInterface.addColumn('empresas', 'limite_usuarios', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 2
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('empresas');
    if (table.limite_usuarios) await queryInterface.removeColumn('empresas', 'limite_usuarios');
    if (table.limite_sucursales) await queryInterface.removeColumn('empresas', 'limite_sucursales');
    if (table.fecha_vencimiento) await queryInterface.removeColumn('empresas', 'fecha_vencimiento');
    if (table.precio_mensual) await queryInterface.removeColumn('empresas', 'precio_mensual');
    if (table.plan) await queryInterface.removeColumn('empresas', 'plan');
  }
};

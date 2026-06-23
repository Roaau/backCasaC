'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('movimientos_inventario');
    if (!tableInfo.sucursal_id) {
      await queryInterface.addColumn('movimientos_inventario', 'sucursal_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 1,
        references: { model: 'sucursales', key: 'sucursal_id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('movimientos_inventario', 'sucursal_id');
  }
};

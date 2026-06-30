"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query('UPDATE "ventas" SET sucursal_id = 1 WHERE sucursal_id IS NULL');
    await queryInterface.sequelize.query('UPDATE "caja" SET sucursal_id = 1 WHERE sucursal_id IS NULL');
    await queryInterface.sequelize.query('UPDATE "productos" SET empresa_id = 1 WHERE empresa_id IS NULL');
    await queryInterface.sequelize.query('UPDATE "movimientos_inventario" SET sucursal_id = 1 WHERE sucursal_id IS NULL');

    await queryInterface.changeColumn("usuarios", "empresa_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null
    });
    await queryInterface.changeColumn("usuarios", "sucursal_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null
    });
    await queryInterface.changeColumn("ventas", "sucursal_id", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: null
    });
    await queryInterface.changeColumn("caja", "sucursal_id", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: null
    });
    await queryInterface.changeColumn("productos", "empresa_id", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: null
    });
    await queryInterface.changeColumn("movimientos_inventario", "sucursal_id", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: null
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn("usuarios", "empresa_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: 1
    });
    await queryInterface.changeColumn("usuarios", "sucursal_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: 1
    });
    await queryInterface.changeColumn("ventas", "sucursal_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: 1
    });
    await queryInterface.changeColumn("caja", "sucursal_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: 1
    });
    await queryInterface.changeColumn("productos", "empresa_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: 1
    });
    await queryInterface.changeColumn("movimientos_inventario", "sucursal_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: 1
    });
  }
};

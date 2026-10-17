'use strict';

// Clientes frecuentes para pedidos y mostrador. El backend tambien la crea al arrancar (sequelize.sync).
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('clientes', {
      cliente_id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      empresa_id: { type: Sequelize.INTEGER, allowNull: false },
      nombre:     { type: Sequelize.STRING(200), allowNull: false },
      telefono:   { type: Sequelize.STRING(30), allowNull: true },
      direccion:  { type: Sequelize.TEXT, allowNull: true },
      referencia: { type: Sequelize.TEXT, allowNull: true },
      activo:     { type: Sequelize.BOOLEAN, defaultValue: true },
      createdAt:  { type: Sequelize.DATE, allowNull: false },
      updatedAt:  { type: Sequelize.DATE, allowNull: false }
    });
    await queryInterface.addIndex('clientes', ['empresa_id']);
    await queryInterface.sequelize.query('ALTER TABLE clientes ENABLE ROW LEVEL SECURITY');
  },

  async down(queryInterface) {
    await queryInterface.dropTable('clientes');
  }
};

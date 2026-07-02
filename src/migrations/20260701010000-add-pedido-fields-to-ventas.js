'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('ventas');
    if (!table.telefono_cliente) {
      await queryInterface.addColumn('ventas', 'telefono_cliente', { type: Sequelize.STRING(30), allowNull: true });
    }
    if (!table.direccion_entrega) {
      await queryInterface.addColumn('ventas', 'direccion_entrega', { type: Sequelize.STRING(500), allowNull: true });
    }
    if (!table.referencia_entrega) {
      await queryInterface.addColumn('ventas', 'referencia_entrega', { type: Sequelize.STRING(500), allowNull: true });
    }
    if (!table.estado_pedido) {
      await queryInterface.addColumn('ventas', 'estado_pedido', { type: Sequelize.STRING(20), allowNull: true });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('ventas');
    if (table.estado_pedido) await queryInterface.removeColumn('ventas', 'estado_pedido');
    if (table.referencia_entrega) await queryInterface.removeColumn('ventas', 'referencia_entrega');
    if (table.direccion_entrega) await queryInterface.removeColumn('ventas', 'direccion_entrega');
    if (table.telefono_cliente) await queryInterface.removeColumn('ventas', 'telefono_cliente');
  }
};

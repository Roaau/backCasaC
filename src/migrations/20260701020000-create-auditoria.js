'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('auditoria', {
      auditoria_id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      usuario_id:   { type: Sequelize.INTEGER, allowNull: true },
      empresa_id:   { type: Sequelize.INTEGER, allowNull: true },
      sucursal_id:  { type: Sequelize.INTEGER, allowNull: true },
      accion:       { type: Sequelize.STRING(80), allowNull: false },
      entidad:      { type: Sequelize.STRING(80), allowNull: false },
      entidad_id:   { type: Sequelize.STRING(80), allowNull: true },
      detalle:      { type: Sequelize.JSONB, allowNull: true },
      ip:           { type: Sequelize.STRING(80), allowNull: true },
      user_agent:   { type: Sequelize.TEXT, allowNull: true },
      fecha:        { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });
    await queryInterface.addIndex('auditoria', ['empresa_id', 'fecha'], { name: 'auditoria_empresa_fecha' });
    await queryInterface.addIndex('auditoria', ['sucursal_id', 'fecha'], { name: 'auditoria_sucursal_fecha' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('auditoria');
  }
};

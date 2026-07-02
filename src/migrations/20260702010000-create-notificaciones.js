'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('notificaciones', {
      notificacion_id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      empresa_id:      { type: Sequelize.INTEGER, allowNull: false },
      sucursal_id:     { type: Sequelize.INTEGER, allowNull: true },
      usuario_id:      { type: Sequelize.INTEGER, allowNull: true },
      tipo:            { type: Sequelize.STRING(40), allowNull: false },
      severidad:       { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'media' },
      titulo:          { type: Sequelize.STRING(160), allowNull: false },
      mensaje:         { type: Sequelize.TEXT, allowNull: false },
      entidad:         { type: Sequelize.STRING(80), allowNull: true },
      entidad_id:      { type: Sequelize.STRING(80), allowNull: true },
      estado:          { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'nueva' },
      detalle:         { type: Sequelize.JSONB, allowNull: true },
      creada_en:       { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      vista_en:        { type: Sequelize.DATE, allowNull: true },
      resuelta_en:     { type: Sequelize.DATE, allowNull: true }
    });
    await queryInterface.addIndex('notificaciones', ['empresa_id', 'sucursal_id', 'estado']);
    await queryInterface.addIndex('notificaciones', ['empresa_id', 'tipo', 'entidad', 'entidad_id']);
    await queryInterface.addIndex('notificaciones', ['creada_en']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('notificaciones');
  }
};

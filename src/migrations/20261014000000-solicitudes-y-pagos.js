'use strict';

// Solicitudes de cambio de plan (las aprueba el superadmin), historial de pagos
// y configuracion de la plataforma (datos para transferir).

module.exports = {
  async up(queryInterface, Sequelize) {
    const tablas = (await queryInterface.showAllTables()).map(t => (typeof t === 'string' ? t : t.tableName));

    const empresas = await queryInterface.describeTable('empresas');
    if (!empresas.usuarios_extra) {
      await queryInterface.addColumn('empresas', 'usuarios_extra', { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 });
    }

    if (!tablas.includes('solicitudes_plan')) {
      await queryInterface.createTable('solicitudes_plan', {
        solicitud_id:      { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        empresa_id:        { type: Sequelize.INTEGER, allowNull: false, references: { model: 'empresas', key: 'empresa_id' }, onDelete: 'CASCADE' },
        tipo:              { type: Sequelize.STRING(20), allowNull: false },
        descripcion:       { type: Sequelize.STRING(200), allowNull: false },
        plan_nuevo:        { type: Sequelize.STRING(20), allowNull: false },
        periodo_nuevo:     { type: Sequelize.STRING(10), allowNull: false },
        limite_sucursales_nuevo: { type: Sequelize.INTEGER, allowNull: false },
        limite_usuarios_nuevo:   { type: Sequelize.INTEGER, allowNull: false },
        usuarios_extra_nuevo:    { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        precio_actual:     { type: Sequelize.DECIMAL(10, 2), allowNull: false },
        precio_nuevo:      { type: Sequelize.DECIMAL(10, 2), allowNull: false },
        estado:            { type: Sequelize.STRING(15), allowNull: false, defaultValue: 'pendiente' },
        motivo:            { type: Sequelize.STRING(300), allowNull: true },
        solicitado_por:    { type: Sequelize.INTEGER, allowNull: true },
        resuelta_por:      { type: Sequelize.INTEGER, allowNull: true },
        creada_en:         { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        resuelta_en:       { type: Sequelize.DATE, allowNull: true },
      });
      await queryInterface.addIndex('solicitudes_plan', ['empresa_id', 'estado']);
    }

    if (!tablas.includes('pagos_empresa')) {
      await queryInterface.createTable('pagos_empresa', {
        pago_id:        { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        empresa_id:     { type: Sequelize.INTEGER, allowNull: false, references: { model: 'empresas', key: 'empresa_id' }, onDelete: 'CASCADE' },
        fecha:          { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        monto:          { type: Sequelize.DECIMAL(10, 2), allowNull: false },
        meses:          { type: Sequelize.INTEGER, allowNull: false },
        vence_hasta:    { type: Sequelize.DATEONLY, allowNull: false },
        registrado_por: { type: Sequelize.INTEGER, allowNull: true },
        notas:          { type: Sequelize.STRING(300), allowNull: true },
      });
      await queryInterface.addIndex('pagos_empresa', ['empresa_id', 'fecha']);
    }

    if (!tablas.includes('plataforma_config')) {
      await queryInterface.createTable('plataforma_config', {
        clave: { type: Sequelize.STRING(60), primaryKey: true },
        valor: { type: Sequelize.TEXT, allowNull: true },
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('plataforma_config').catch(() => {});
    await queryInterface.dropTable('pagos_empresa').catch(() => {});
    await queryInterface.dropTable('solicitudes_plan').catch(() => {});
    await queryInterface.removeColumn('empresas', 'usuarios_extra').catch(() => {});
  }
};

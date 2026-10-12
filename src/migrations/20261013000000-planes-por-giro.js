'use strict';

// Planes por giro: nivel de precio, pago mensual/anual, prueba gratis, referidos,
// IA por plan y control de recordatorios de vencimiento.

const COLUMNAS = (Sequelize) => ({
  nivel:                     { type: Sequelize.STRING(30), allowNull: true },
  periodo_pago:              { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'mensual' },
  giro_registro:             { type: Sequelize.STRING(40), allowNull: true },
  codigo_referido:           { type: Sequelize.STRING(12), allowNull: true, unique: true },
  referido_por:              { type: Sequelize.INTEGER, allowNull: true },
  bono_referido_aplicado:    { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
  ia_limite_diario:          { type: Sequelize.INTEGER, allowNull: true },
  aviso_vencimiento_enviado: { type: Sequelize.DATEONLY, allowNull: true },
});

module.exports = {
  async up(queryInterface, Sequelize) {
    const empresas = await queryInterface.describeTable('empresas');
    for (const [col, def] of Object.entries(COLUMNAS(Sequelize))) {
      if (!empresas[col]) await queryInterface.addColumn('empresas', col, def);
    }
    // Las empresas existentes conservan su precio; solo se les da codigo de referido y giro de registro
    await queryInterface.sequelize.query(`
      UPDATE empresas
      SET giro_registro = COALESCE(giro_registro, giro),
          codigo_referido = COALESCE(codigo_referido, UPPER(SUBSTRING(MD5(empresa_id::text || razon_social || NOW()::text) FROM 1 FOR 6)))
    `);
  },

  async down(queryInterface) {
    for (const col of Object.keys(COLUMNAS({ STRING: () => null }))) {
      await queryInterface.removeColumn('empresas', col).catch(() => {});
    }
  }
};

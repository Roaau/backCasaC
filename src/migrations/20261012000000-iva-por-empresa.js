'use strict';

// El IVA se configuraba solo en el navegador (localStorage) y se perdia al cambiar de equipo.
// Ahora es de la empresa y el servidor lo usa al calcular el total de cada venta.

module.exports = {
  async up(queryInterface, Sequelize) {
    const empresas = await queryInterface.describeTable('empresas');
    if (!empresas.iva_activo) {
      await queryInterface.addColumn('empresas', 'iva_activo', {
        type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false
      });
    }
    if (!empresas.iva_porcentaje) {
      await queryInterface.addColumn('empresas', 'iva_porcentaje', {
        type: Sequelize.DECIMAL(5, 2), allowNull: false, defaultValue: 16
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('empresas', 'iva_porcentaje').catch(() => {});
    await queryInterface.removeColumn('empresas', 'iva_activo').catch(() => {});
  }
};

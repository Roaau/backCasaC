'use strict';

// Catalogos base por giro: el superadmin sube un Excel por catalogo (abarrotes, farmacia, ropa...)
// y lo puede eliminar por separado. Los productos siguen en catalogo_maestro_ferreteria.

const COLUMNAS_ITEM = (Sequelize) => ({
  catalogo_giro_id: {
    type: Sequelize.INTEGER, allowNull: true,
    references: { model: 'catalogos_giro', key: 'catalogo_giro_id' }, onDelete: 'CASCADE'
  },
  unidad_venta:    { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'pieza' },
  precio_compra:   { type: Sequelize.DECIMAL(10, 2), allowNull: true },
  marca:           { type: Sequelize.STRING(100), allowNull: true },
  modelo:          { type: Sequelize.STRING(100), allowNull: true },
  talla:           { type: Sequelize.STRING(30), allowNull: true },
  color:           { type: Sequelize.STRING(50), allowNull: true },
  requiere_receta: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
});

module.exports = {
  async up(queryInterface, Sequelize) {
    const tablas = (await queryInterface.showAllTables()).map(t => (typeof t === 'string' ? t : t.tableName));
    if (!tablas.includes('catalogos_giro')) {
      await queryInterface.createTable('catalogos_giro', {
        catalogo_giro_id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        nombre:           { type: Sequelize.STRING(120), allowNull: false },
        giro:             { type: Sequelize.STRING(40), allowNull: false, defaultValue: 'general' },
        archivo:          { type: Sequelize.STRING(255), allowNull: true },
        total_productos:  { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        creado_en:        { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
      });
    }

    const items = await queryInterface.describeTable('catalogo_maestro_ferreteria');
    for (const [col, def] of Object.entries(COLUMNAS_ITEM(Sequelize))) {
      if (!items[col]) await queryInterface.addColumn('catalogo_maestro_ferreteria', col, def);
    }
    await queryInterface.sequelize.query(
      'CREATE INDEX IF NOT EXISTS idx_catalogo_maestro_giro ON catalogo_maestro_ferreteria (catalogo_giro_id)'
    );

    // El catalogo que ya existia era de ferreteria: se conserva como su propio catalogo
    const [[{ sueltos }]] = await queryInterface.sequelize.query(
      'SELECT COUNT(*)::int AS sueltos FROM catalogo_maestro_ferreteria WHERE catalogo_giro_id IS NULL'
    );
    if (sueltos > 0) {
      const [[cat]] = await queryInterface.sequelize.query(`
        INSERT INTO catalogos_giro (nombre, giro, archivo, total_productos)
        VALUES ('Ferreteria (catalogo original)', 'ferreteria', NULL, ${sueltos})
        RETURNING catalogo_giro_id
      `);
      await queryInterface.sequelize.query(
        `UPDATE catalogo_maestro_ferreteria SET catalogo_giro_id = ${Number(cat.catalogo_giro_id)} WHERE catalogo_giro_id IS NULL`
      );
    }
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS idx_catalogo_maestro_giro');
    for (const col of Object.keys(COLUMNAS_ITEM({ STRING: () => null, DECIMAL: () => null }))) {
      await queryInterface.removeColumn('catalogo_maestro_ferreteria', col).catch(() => {});
    }
    await queryInterface.dropTable('catalogos_giro').catch(() => {});
  }
};

'use strict';

module.exports = {
  async up(qi, Sequelize) {
    // 1. Crear tabla empresas
    await qi.createTable('empresas', {
      empresa_id:     { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      rfc:            { type: Sequelize.STRING(13), allowNull: false, unique: true },
      razon_social:   { type: Sequelize.STRING(255), allowNull: false },
      regimen_fiscal: { type: Sequelize.STRING(4), allowNull: false },
      activo:         { type: Sequelize.BOOLEAN, defaultValue: true }
    });

    // 2. Crear tabla sucursales
    await qi.createTable('sucursales', {
      sucursal_id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      empresa_id:  { type: Sequelize.INTEGER, allowNull: false, references: { model: 'empresas', key: 'empresa_id' } },
      nombre:      { type: Sequelize.STRING(100), allowNull: false },
      direccion:   { type: Sequelize.STRING(255) },
      cp_sat:      { type: Sequelize.STRING(5), allowNull: false, defaultValue: '06600' },
      latitud:     { type: Sequelize.DECIMAL(10, 8) },
      longitud:    { type: Sequelize.DECIMAL(11, 8) },
      activa:      { type: Sequelize.BOOLEAN, defaultValue: true }
    });

    // 3. Empresa y sucursal por defecto
    await qi.bulkInsert('empresas', [{
      rfc: 'XAXX010101000',
      razon_social: 'Mi Empresa SA de CV',
      regimen_fiscal: '601',
      activo: true
    }]);

    await qi.bulkInsert('sucursales', [{
      empresa_id: 1,
      nombre: 'Sucursal Principal',
      direccion: 'Dirección Principal',
      cp_sat: '06600',
      latitud: 19.4326,
      longitud: -99.1332,
      activa: true
    }]);

    // 4. Agregar columnas a usuarios
    await qi.addColumn('usuarios', 'empresa_id',  { type: Sequelize.INTEGER, defaultValue: 1 });
    await qi.addColumn('usuarios', 'sucursal_id', { type: Sequelize.INTEGER, defaultValue: 1 });
    await qi.sequelize.query('UPDATE usuarios SET empresa_id = 1, sucursal_id = 1');

    // 5. Agregar sucursal_id a ventas
    await qi.addColumn('ventas', 'sucursal_id', { type: Sequelize.INTEGER, defaultValue: 1 });
    await qi.sequelize.query('UPDATE ventas SET sucursal_id = 1');

    // 6. Agregar sucursal_id a caja
    await qi.addColumn('caja', 'sucursal_id', { type: Sequelize.INTEGER, defaultValue: 1 });
    await qi.sequelize.query('UPDATE caja SET sucursal_id = 1');

    // 7. Agregar empresa_id a productos
    await qi.addColumn('productos', 'empresa_id', { type: Sequelize.INTEGER, defaultValue: 1 });
    await qi.sequelize.query('UPDATE productos SET empresa_id = 1');

    // 8. Crear tabla stock_sucursal
    await qi.createTable('stock_sucursal', {
      stock_id:     { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      producto_id:  { type: Sequelize.INTEGER, allowNull: false, references: { model: 'productos', key: 'producto_id' } },
      sucursal_id:  { type: Sequelize.INTEGER, allowNull: false, references: { model: 'sucursales', key: 'sucursal_id' } },
      stock_actual: { type: Sequelize.INTEGER, defaultValue: 0 },
      stock_minimo: { type: Sequelize.INTEGER, defaultValue: 0 }
    });

    await qi.addIndex('stock_sucursal', ['producto_id', 'sucursal_id'], { unique: true });

    // 9. Migrar stock existente a stock_sucursal (sucursal 1)
    await qi.sequelize.query(`
      INSERT INTO stock_sucursal (producto_id, sucursal_id, stock_actual, stock_minimo)
      SELECT producto_id, 1, COALESCE(stock_actual, 0), COALESCE(stock_minimo, 0)
      FROM productos
    `);
  },

  async down(qi) {
    await qi.dropTable('stock_sucursal');
    await qi.removeColumn('productos', 'empresa_id');
    await qi.removeColumn('caja', 'sucursal_id');
    await qi.removeColumn('ventas', 'sucursal_id');
    await qi.removeColumn('usuarios', 'sucursal_id');
    await qi.removeColumn('usuarios', 'empresa_id');
    await qi.dropTable('sucursales');
    await qi.dropTable('empresas');
  }
};

'use strict';

module.exports = {
  async up(qi, Sequelize) {
    const tables = await qi.showAllTables();
    const hasTable = (name) => tables.includes(name) || tables.includes(`public.${name}`);

    if (!hasTable('empresas')) {
      await qi.createTable('empresas', {
        empresa_id:     { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        rfc:            { type: Sequelize.STRING(13), allowNull: false, unique: true },
        razon_social:   { type: Sequelize.STRING(255), allowNull: false },
        regimen_fiscal: { type: Sequelize.STRING(4), allowNull: false },
        activo:         { type: Sequelize.BOOLEAN, defaultValue: true }
      });
    }

    if (!hasTable('sucursales')) {
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
    }

    await qi.sequelize.query(`
      INSERT INTO empresas (empresa_id, rfc, razon_social, regimen_fiscal, activo)
      VALUES (1, 'XAXX010101000', 'Mi Empresa SA de CV', '601', true)
      ON CONFLICT (empresa_id) DO NOTHING
    `);

    await qi.sequelize.query(`
      INSERT INTO sucursales (sucursal_id, empresa_id, nombre, direccion, cp_sat, latitud, longitud, activa)
      VALUES (1, 1, 'Sucursal Principal', 'Direccion Principal', '06600', 19.4326, -99.1332, true)
      ON CONFLICT (sucursal_id) DO NOTHING
    `);

    const usuarios = await qi.describeTable('usuarios');
    if (!usuarios.empresa_id) await qi.addColumn('usuarios', 'empresa_id', { type: Sequelize.INTEGER, defaultValue: 1 });
    if (!usuarios.sucursal_id) await qi.addColumn('usuarios', 'sucursal_id', { type: Sequelize.INTEGER, defaultValue: 1 });
    await qi.sequelize.query('UPDATE usuarios SET empresa_id = COALESCE(empresa_id, 1), sucursal_id = COALESCE(sucursal_id, 1)');

    const ventas = await qi.describeTable('ventas');
    if (!ventas.sucursal_id) await qi.addColumn('ventas', 'sucursal_id', { type: Sequelize.INTEGER, defaultValue: 1 });
    await qi.sequelize.query('UPDATE ventas SET sucursal_id = COALESCE(sucursal_id, 1)');

    const caja = await qi.describeTable('caja');
    if (!caja.sucursal_id) await qi.addColumn('caja', 'sucursal_id', { type: Sequelize.INTEGER, defaultValue: 1 });
    await qi.sequelize.query('UPDATE caja SET sucursal_id = COALESCE(sucursal_id, 1)');

    const productos = await qi.describeTable('productos');
    if (!productos.empresa_id) await qi.addColumn('productos', 'empresa_id', { type: Sequelize.INTEGER, defaultValue: 1 });
    await qi.sequelize.query('UPDATE productos SET empresa_id = COALESCE(empresa_id, 1)');

    const tablesAfterColumns = await qi.showAllTables();
    const hasStock = tablesAfterColumns.includes('stock_sucursal') || tablesAfterColumns.includes('public.stock_sucursal');
    if (!hasStock) {
      await qi.createTable('stock_sucursal', {
        stock_id:     { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        producto_id:  { type: Sequelize.INTEGER, allowNull: false, references: { model: 'productos', key: 'producto_id' } },
        sucursal_id:  { type: Sequelize.INTEGER, allowNull: false, references: { model: 'sucursales', key: 'sucursal_id' } },
        stock_actual: { type: Sequelize.INTEGER, defaultValue: 0 },
        stock_minimo: { type: Sequelize.INTEGER, defaultValue: 0 }
      });
    }

    await qi.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS stock_sucursal_producto_id_sucursal_id
      ON stock_sucursal (producto_id, sucursal_id)
    `);

    await qi.sequelize.query(`
      INSERT INTO stock_sucursal (producto_id, sucursal_id, stock_actual, stock_minimo)
      SELECT producto_id, 1, COALESCE(stock_actual, 0), COALESCE(stock_minimo, 0)
      FROM productos
      ON CONFLICT (producto_id, sucursal_id) DO NOTHING
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

'use strict';

// POS general: giro del negocio, atributos de producto para cualquier giro
// (ropa, farmacia, ferreteria, abarrotes...) y cantidades decimales para venta a granel.

const CANTIDADES = [
  ['productos', ['stock_actual', 'stock_minimo', 'minimo_mayoreo']],
  ['stock_sucursal', ['stock_actual', 'stock_minimo']],
  ['detalle_ventas', ['cantidad']],
  ['detalle_compras', ['cantidad']],
  ['detalle_devoluciones', ['cantidad']],
  ['movimientos_inventario', ['cantidad', 'stock_anterior', 'stock_nuevo']],
];

const COLUMNAS_PRODUCTO = (Sequelize) => ({
  unidad_venta:    { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'pieza' },
  precio_compra:   { type: Sequelize.DECIMAL(10, 2), allowNull: true },
  marca:           { type: Sequelize.STRING(100), allowNull: true },
  modelo:          { type: Sequelize.STRING(100), allowNull: true },
  talla:           { type: Sequelize.STRING(30), allowNull: true },
  color:           { type: Sequelize.STRING(50), allowNull: true },
  lote:            { type: Sequelize.STRING(60), allowNull: true },
  fecha_caducidad: { type: Sequelize.DATEONLY, allowNull: true },
  requiere_receta: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
  ubicacion:       { type: Sequelize.STRING(60), allowNull: true },
});

module.exports = {
  async up(queryInterface, Sequelize) {
    const empresas = await queryInterface.describeTable('empresas');
    if (!empresas.giro) {
      await queryInterface.addColumn('empresas', 'giro', {
        type: Sequelize.STRING(40), allowNull: false, defaultValue: 'general'
      });
    }

    const productos = await queryInterface.describeTable('productos');
    for (const [col, def] of Object.entries(COLUMNAS_PRODUCTO(Sequelize))) {
      if (!productos[col]) await queryInterface.addColumn('productos', col, def);
    }

    for (const [tabla, columnas] of CANTIDADES) {
      const desc = await queryInterface.describeTable(tabla).catch(() => null);
      if (!desc) continue;
      for (const col of columnas) {
        if (!desc[col] || /NUMERIC|DECIMAL/i.test(desc[col].type)) continue;
        await queryInterface.sequelize.query(
          `ALTER TABLE "${tabla}" ALTER COLUMN "${col}" TYPE NUMERIC(12,3) USING "${col}"::numeric`
        );
      }
    }

    // El esquema original tenia codigo_barras UNIQUE global: dos negocios distintos
    // no podian registrar el mismo producto (ej. el mismo refresco). Se cambia a unico por empresa.
    const [uniques] = await queryInterface.sequelize.query(`
      SELECT con.conname
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY (con.conkey)
      WHERE rel.relname = 'productos' AND con.contype = 'u'
      GROUP BY con.conname
      HAVING array_agg(att.attname::text) = ARRAY['codigo_barras']
    `);
    for (const u of uniques) {
      await queryInterface.sequelize.query(`ALTER TABLE productos DROP CONSTRAINT "${u.conname}"`);
    }
    const [indicesUnicos] = await queryInterface.sequelize.query(`
      SELECT i.relname AS nombre
      FROM pg_index ix
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN pg_class t ON t.oid = ix.indrelid
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY (ix.indkey)
      WHERE t.relname = 'productos' AND ix.indisunique AND NOT ix.indisprimary
      GROUP BY i.relname
      HAVING array_agg(a.attname::text) = ARRAY['codigo_barras']
    `);
    for (const idx of indicesUnicos) {
      await queryInterface.sequelize.query(`DROP INDEX IF EXISTS "${idx.nombre}"`);
    }

    const [duplicados] = await queryInterface.sequelize.query(`
      SELECT 1 FROM productos WHERE codigo_barras IS NOT NULL
      GROUP BY empresa_id, codigo_barras HAVING COUNT(*) > 1 LIMIT 1
    `);
    if (duplicados.length === 0) {
      await queryInterface.sequelize.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS uq_productos_empresa_codigo
        ON productos (empresa_id, codigo_barras) WHERE codigo_barras IS NOT NULL
      `);
    } else {
      console.warn('[pos-general] Hay codigos de barras repetidos dentro de una empresa; no se creo el indice unico por empresa.');
    }

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_productos_empresa_caducidad
      ON productos (empresa_id, fecha_caducidad) WHERE fecha_caducidad IS NOT NULL
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS idx_productos_empresa_caducidad');
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS uq_productos_empresa_codigo');
    for (const col of Object.keys(COLUMNAS_PRODUCTO({ STRING: () => null, DECIMAL: () => null }))) {
      await queryInterface.removeColumn('productos', col).catch(() => {});
    }
    await queryInterface.removeColumn('empresas', 'giro').catch(() => {});
    // Las cantidades se dejan como NUMERIC: regresarlas a INTEGER perderia decimales de ventas a granel.
  }
};

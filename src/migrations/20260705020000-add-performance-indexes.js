const indexes = [
  { table: 'ventas', columns: ['sucursal_id', 'fecha'], name: 'idx_ventas_sucursal_fecha' },
  { table: 'ventas', columns: ['sucursal_id', 'tipo_venta', 'estado_pedido', 'fecha'], name: 'idx_ventas_pedidos_sucursal_estado_fecha' },
  { table: 'ventas', columns: ['usuario_id', 'fecha'], name: 'idx_ventas_usuario_fecha' },
  { table: 'detalle_ventas', columns: ['venta_id'], name: 'idx_detalle_ventas_venta' },
  { table: 'detalle_ventas', columns: ['producto_id'], name: 'idx_detalle_ventas_producto' },
  { table: 'productos', columns: ['empresa_id', 'codigo_barras'], name: 'idx_productos_empresa_codigo' },
  { table: 'productos', columns: ['empresa_id', 'activo', 'nombre'], name: 'idx_productos_empresa_activo_nombre' },
  { table: 'stock_sucursal', columns: ['sucursal_id', 'producto_id'], name: 'idx_stock_sucursal_producto' },
  { table: 'stock_sucursal', columns: ['sucursal_id', 'stock_actual'], name: 'idx_stock_sucursal_stock' },
  { table: 'movimientos_inventario', columns: ['sucursal_id', 'fecha'], name: 'idx_mov_inv_sucursal_fecha' },
  { table: 'movimientos_inventario', columns: ['producto_id', 'fecha'], name: 'idx_mov_inv_producto_fecha' },
  { table: 'cajas', columns: ['sucursal_id', 'fecha_apertura'], name: 'idx_cajas_sucursal_apertura' },
  { table: 'cajas', columns: ['sucursal_id', 'fecha_cierre'], name: 'idx_cajas_sucursal_cierre' },
  { table: 'movimiento_caja', columns: ['caja_id', 'fecha'], name: 'idx_mov_caja_caja_fecha' },
  { table: 'sucursales', columns: ['empresa_id', 'activa'], name: 'idx_sucursales_empresa_activa' },
  { table: 'usuarios', columns: ['empresa_id', 'activo'], name: 'idx_usuarios_empresa_activo' },
  { table: 'cfdi_ventas', columns: ['venta_id'], name: 'idx_cfdi_ventas_venta' },
  { table: 'cfdi_ventas', columns: ['estado', 'creado_en'], name: 'idx_cfdi_estado_creado' },
  { table: 'compras', columns: ['empresa_id', 'fecha'], name: 'idx_compras_empresa_fecha' },
  { table: 'cotizaciones', columns: ['sucursal_id', 'fecha'], name: 'idx_cotizaciones_sucursal_fecha' }
];

async function tableHasColumns(queryInterface, table, columns) {
  try {
    const schema = await queryInterface.describeTable(table);
    return columns.every(column => !!schema[column]);
  } catch {
    return false;
  }
}

export async function up(queryInterface) {
  for (const index of indexes) {
    if (await tableHasColumns(queryInterface, index.table, index.columns)) {
      await queryInterface.addIndex(index.table, index.columns, {
        name: index.name
      }).catch(() => {});
    }
  }
}

export async function down(queryInterface) {
  for (const index of indexes) {
    await queryInterface.removeIndex(index.table, index.name).catch(() => {});
  }
}

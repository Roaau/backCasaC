'use strict';

/** @param {import('sequelize').QueryInterface} qi @param {import('sequelize').Sequelize} Sequelize */
async function createIfMissing(qi, tableName, attributes, options = {}) {
  try {
    await qi.describeTable(tableName);
  } catch {
    await qi.createTable(tableName, attributes, options);
  }
}

module.exports = {
  async up(qi, Sequelize) {
    // 1 — usuarios
    await createIfMissing(qi, 'usuarios', {
      usuario_id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      nombre:     { type: Sequelize.STRING(150), allowNull: false },
      usuario:    { type: Sequelize.STRING(50),  allowNull: false, unique: true },
      contrasena: { type: Sequelize.STRING(255), allowNull: false },
      rol_id:     { type: Sequelize.INTEGER,     allowNull: false, defaultValue: 2 },
    });

    // 2 — productos
    await createIfMissing(qi, 'productos', {
      producto_id:     { type: Sequelize.INTEGER,      primaryKey: true, autoIncrement: true },
      codigo_barras:   { type: Sequelize.STRING(100) },
      nombre:          { type: Sequelize.STRING(255) },
      descripcion:     { type: Sequelize.STRING(255) },
      categoria:       { type: Sequelize.STRING(100) },
      precio_menudeo:  { type: Sequelize.DECIMAL(10, 2) },
      precio_mayoreo:  { type: Sequelize.DECIMAL(10, 2) },
      precio_oferta:   { type: Sequelize.DECIMAL(10, 2) },
      stock_actual:    { type: Sequelize.INTEGER },
      stock_minimo:    { type: Sequelize.INTEGER },
      activo:          { type: Sequelize.BOOLEAN },
      minimo_mayoreo:  { type: Sequelize.INTEGER, allowNull: true, defaultValue: null },
      clave_sat:       { type: Sequelize.STRING(8),  allowNull: false, defaultValue: '01010101' },
      clave_unidad_sat:{ type: Sequelize.STRING(6),  allowNull: false, defaultValue: 'H87' },
      objeto_imp:      { type: Sequelize.STRING(3),  allowNull: false, defaultValue: '02' },
    });

    // 3 — caja
    await createIfMissing(qi, 'cajas', {
      caja_id:             { type: Sequelize.INTEGER,      primaryKey: true, autoIncrement: true },
      usuario_apertura_id: { type: Sequelize.INTEGER,      allowNull: false },
      usuario_cierre_id:   { type: Sequelize.INTEGER,      allowNull: true },
      monto_inicial:       { type: Sequelize.DECIMAL(12,2),allowNull: false, defaultValue: 0 },
      monto_final:         { type: Sequelize.DECIMAL(12,2),allowNull: true },
      fecha_apertura:      { type: Sequelize.DATE,         allowNull: false, defaultValue: Sequelize.fn('NOW') },
      fecha_cierre:        { type: Sequelize.DATE,         allowNull: true },
    });

    // 4 — ventas
    await createIfMissing(qi, 'ventas', {
      venta_id:     { type: Sequelize.INTEGER,      primaryKey: true, autoIncrement: true },
      folio:        { type: Sequelize.STRING(20),   allowNull: false, unique: true },
      usuario_id:   { type: Sequelize.INTEGER,      allowNull: false },
      fecha:        { type: Sequelize.DATE,         defaultValue: Sequelize.fn('NOW') },
      total:        { type: Sequelize.DECIMAL(10,2),allowNull: false },
      tipo_venta:   { type: Sequelize.STRING(20),   allowNull: false, defaultValue: 'Tienda' },
      pedido_numero:{ type: Sequelize.STRING(50),   allowNull: true },
      forma_pago:   { type: Sequelize.STRING(2),    allowNull: true },
    });

    // 5 — detalle_ventas
    await createIfMissing(qi, 'detalle_ventas', {
      detalle_id:     { type: Sequelize.INTEGER,       primaryKey: true, autoIncrement: true },
      venta_id:       { type: Sequelize.INTEGER,       allowNull: false },
      producto_id:    { type: Sequelize.INTEGER,       allowNull: true },
      nombre_producto:{ type: Sequelize.STRING(255),   allowNull: true },
      codigo_barras:  { type: Sequelize.STRING(100),   allowNull: true },
      cantidad:       { type: Sequelize.INTEGER,       allowNull: false },
      precio_unitario:{ type: Sequelize.DECIMAL(10,2), allowNull: false },
      subtotal:       { type: Sequelize.DECIMAL(10,2), allowNull: false },
    });

    // 6 — movimiento_caja
    await createIfMissing(qi, 'movimiento_caja', {
      movimiento_caja_id: { type: Sequelize.INTEGER,       primaryKey: true, autoIncrement: true },
      caja_id:            { type: Sequelize.INTEGER,       allowNull: false },
      usuario_id:         { type: Sequelize.INTEGER,       allowNull: false },
      tipo_movimiento:    { type: Sequelize.STRING(50),    allowNull: false },
      monto:              { type: Sequelize.DECIMAL(10,2), allowNull: false },
      concepto:           { type: Sequelize.STRING(255),   allowNull: true },
      fecha:              { type: Sequelize.DATE,          allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });

    // 7 — movimientos_inventario
    await createIfMissing(qi, 'movimientos_inventario', {
      movimiento_id:   { type: Sequelize.INTEGER,       primaryKey: true, autoIncrement: true },
      producto_id:     { type: Sequelize.INTEGER,       allowNull: true },
      nombre_producto: { type: Sequelize.STRING(255),   allowNull: true },
      codigo_barras:   { type: Sequelize.STRING(100),   allowNull: true },
      usuario_id:      { type: Sequelize.INTEGER,       allowNull: false },
      tipo_movimiento: { type: Sequelize.STRING(20),    allowNull: false },
      cantidad:        { type: Sequelize.INTEGER,       allowNull: false },
      stock_anterior:  { type: Sequelize.INTEGER,       allowNull: true },
      stock_nuevo:     { type: Sequelize.INTEGER,       allowNull: true },
      motivo:          { type: Sequelize.STRING(50),    allowNull: true },
      observaciones:   { type: Sequelize.STRING(255) },
      fecha:           { type: Sequelize.DATE,          defaultValue: Sequelize.fn('NOW') },
    });

    // 8 — clientes_fiscales
    await createIfMissing(qi, 'clientes_fiscales', {
      cliente_id:      { type: Sequelize.INTEGER,     primaryKey: true, autoIncrement: true },
      rfc:             { type: Sequelize.STRING(13),  allowNull: false, unique: true },
      nombre_fiscal:   { type: Sequelize.STRING(300), allowNull: false },
      cp_fiscal:       { type: Sequelize.STRING(5),   allowNull: false },
      regimen_fiscal:  { type: Sequelize.STRING(3),   allowNull: false },
      uso_cfdi_default:{ type: Sequelize.STRING(4),   allowNull: false, defaultValue: 'G03' },
      email:           { type: Sequelize.STRING(150), allowNull: true },
      activo:          { type: Sequelize.BOOLEAN,     allowNull: false, defaultValue: true },
      creado_en:       { type: Sequelize.DATE,        allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });

    // 9 — cfdi_ventas
    await createIfMissing(qi, 'cfdi_ventas', {
      cfdi_id:         { type: Sequelize.INTEGER,     primaryKey: true, autoIncrement: true },
      venta_id:        { type: Sequelize.INTEGER,     allowNull: false },
      cliente_id:      { type: Sequelize.INTEGER,     allowNull: true },
      receptor_rfc:    { type: Sequelize.STRING(13),  allowNull: false },
      receptor_nombre: { type: Sequelize.STRING(300), allowNull: false },
      receptor_cp:     { type: Sequelize.STRING(5),   allowNull: false },
      receptor_regimen:{ type: Sequelize.STRING(3),   allowNull: false },
      uso_cfdi:        { type: Sequelize.STRING(4),   allowNull: false },
      cfdi_uuid:       { type: Sequelize.UUID,        allowNull: true },
      estado:          { type: Sequelize.STRING(20),  allowNull: false, defaultValue: 'PENDIENTE' },
      xml_cfdi:        { type: Sequelize.TEXT,        allowNull: true },
      pdf_url:         { type: Sequelize.STRING(500), allowNull: true },
      creado_en:       { type: Sequelize.DATE,        allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });

    // 10 — configuracion_fiscal (singleton)
    await createIfMissing(qi, 'configuracion_fiscal', {
      id:              { type: Sequelize.INTEGER,     primaryKey: true, defaultValue: 1 },
      rfc_emisor:      { type: Sequelize.STRING(13),  allowNull: true },
      nombre_emisor:   { type: Sequelize.STRING(300), allowNull: true },
      cp_emisor:       { type: Sequelize.STRING(5),   allowNull: true },
      regimen_emisor:  { type: Sequelize.STRING(3),   allowNull: true },
      csd_cert_b64:    { type: Sequelize.TEXT,        allowNull: true },
      csd_key_b64:     { type: Sequelize.TEXT,        allowNull: true },
      csd_password:    { type: Sequelize.STRING(300), allowNull: true },
      pac_nombre:      { type: Sequelize.STRING(50),  allowNull: true },
      pac_url:         { type: Sequelize.STRING(500), allowNull: true },
      pac_usuario:     { type: Sequelize.STRING(300), allowNull: true },
      pac_password:    { type: Sequelize.STRING(300), allowNull: true },
      email_host:      { type: Sequelize.STRING(100), allowNull: true },
      email_port:      { type: Sequelize.INTEGER,     allowNull: true, defaultValue: 587 },
      email_user:      { type: Sequelize.STRING(200), allowNull: true },
      email_pass:      { type: Sequelize.STRING(300), allowNull: true },
      email_from:      { type: Sequelize.STRING(200), allowNull: true },
      logo_b64:        { type: Sequelize.TEXT,        allowNull: true },
      nombre_negocio:  { type: Sequelize.STRING(200), allowNull: true },
      actualizado_en:  { type: Sequelize.DATE,        allowNull: true, defaultValue: Sequelize.fn('NOW') },
    });

    // 11 — cat_sat_forma_pago
    await createIfMissing(qi, 'cat_sat_forma_pago', {
      clave:       { type: Sequelize.STRING(2),   primaryKey: true },
      descripcion: { type: Sequelize.STRING(150), allowNull: false },
    });

    // 12 — cat_sat_metodo_pago
    await createIfMissing(qi, 'cat_sat_metodo_pago', {
      clave:       { type: Sequelize.STRING(3),   primaryKey: true },
      descripcion: { type: Sequelize.STRING(150), allowNull: false },
    });

    // 13 — cat_sat_uso_cfdi
    await createIfMissing(qi, 'cat_sat_uso_cfdi', {
      clave:         { type: Sequelize.STRING(4),   primaryKey: true },
      descripcion:   { type: Sequelize.STRING(200), allowNull: true },
      aplica_fisica: { type: Sequelize.BOOLEAN,     defaultValue: true },
      aplica_moral:  { type: Sequelize.BOOLEAN,     defaultValue: true },
    });

    // 14 — cat_sat_regimen_fiscal
    await createIfMissing(qi, 'cat_sat_regimen_fiscal', {
      clave:         { type: Sequelize.STRING(3),   primaryKey: true },
      descripcion:   { type: Sequelize.STRING(200), allowNull: true },
      aplica_fisica: { type: Sequelize.BOOLEAN,     defaultValue: true },
      aplica_moral:  { type: Sequelize.BOOLEAN,     defaultValue: true },
    });

    // 15 — cat_sat_unidad
    await createIfMissing(qi, 'cat_sat_unidad', {
      clave:       { type: Sequelize.STRING(6),   primaryKey: true },
      nombre:      { type: Sequelize.STRING(150), allowNull: false },
      descripcion: { type: Sequelize.STRING(300), allowNull: true },
    });

    // 16 — cat_sat_producto_servicio
    await createIfMissing(qi, 'cat_sat_producto_servicio', {
      clave:       { type: Sequelize.STRING(8),   primaryKey: true },
      descripcion: { type: Sequelize.STRING(300), allowNull: false },
    });

    // 17 — cat_sat_cp
    await createIfMissing(qi, 'cat_sat_cp', {
      cp:        { type: Sequelize.STRING(5),   primaryKey: true },
      estado:    { type: Sequelize.STRING(60),  allowNull: true },
      municipio: { type: Sequelize.STRING(120), allowNull: true },
    });

    // 18 — cat_sat_colonia
    await createIfMissing(qi, 'cat_sat_colonia', {
      id:                { type: Sequelize.INTEGER,     primaryKey: true, autoIncrement: true },
      cp:                { type: Sequelize.STRING(5),   allowNull: false },
      colonia:           { type: Sequelize.STRING(150), allowNull: false },
      tipo_asentamiento: { type: Sequelize.STRING(60),  allowNull: true },
    });
    await qi.addIndex('cat_sat_colonia', ['cp'], { name: 'idx_colonia_cp', ifNotExists: true }).catch(() => {});
  },

  async down(qi) {
    const tables = [
      'cat_sat_colonia', 'cat_sat_cp', 'cat_sat_producto_servicio',
      'cat_sat_unidad', 'cat_sat_regimen_fiscal', 'cat_sat_uso_cfdi',
      'cat_sat_metodo_pago', 'cat_sat_forma_pago', 'configuracion_fiscal',
      'cfdi_ventas', 'clientes_fiscales', 'movimientos_inventario',
      'movimiento_caja', 'detalle_ventas', 'ventas', 'cajas', 'productos', 'usuarios',
    ];
    for (const t of tables) {
      await qi.dropTable(t, { cascade: true }).catch(() => {});
    }
  },
};

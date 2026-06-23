-- =============================================================================
--  SCHEMA — Sistema POS e Inventario
--  Motor: PostgreSQL 18
--  Generado: 2026-06-08
-- =============================================================================


-- =============================================================================
--  1. USUARIOS
--     Roles: rol_id = 1 → ADMINISTRADOR | rol_id = 2 → cualquier otro
-- =============================================================================
CREATE TABLE usuarios (
    usuario_id  SERIAL          PRIMARY KEY,
    nombre      VARCHAR(255)    NOT NULL,
    usuario     VARCHAR(255)    NOT NULL UNIQUE,
    contrasena  VARCHAR(255)    NOT NULL,   -- hash bcrypt, NUNCA texto plano
    rol_id      INTEGER         NOT NULL    -- 1=ADMINISTRADOR, 2=otro
);


-- =============================================================================
--  2. PRODUCTOS
-- =============================================================================
CREATE TABLE productos (
    producto_id     SERIAL          PRIMARY KEY,
    codigo_barras   VARCHAR(255)    UNIQUE,
    nombre          VARCHAR(255),
    descripcion     VARCHAR(255),
    categoria       VARCHAR(255),
    precio_menudeo  DECIMAL(10,2),
    precio_mayoreo  DECIMAL(10,2),
    precio_oferta   DECIMAL(10,2),
    stock_actual    INTEGER,
    stock_minimo    INTEGER,
    activo          BOOLEAN
);


-- =============================================================================
--  3. VENTAS
--     - folio: generado por el frontend (formato F-XXXXXX), STRING único
--     - tipo_venta: 'Tienda' | 'Pedido'
--     - pedido_numero: obligatorio cuando tipo_venta = 'Pedido'
--     NOTA: si folio estaba como INTEGER en BD antigua, migrar con:
--       ALTER TABLE ventas ALTER COLUMN folio TYPE VARCHAR(20) USING folio::text;
-- =============================================================================
CREATE TABLE ventas (
    venta_id        SERIAL          PRIMARY KEY,
    folio           VARCHAR(20)     NOT NULL UNIQUE,
    usuario_id      INTEGER         NOT NULL REFERENCES usuarios(usuario_id),
    fecha           TIMESTAMPTZ     DEFAULT NOW(),
    total           DECIMAL(10,2)   NOT NULL,
    tipo_venta      VARCHAR(20)     NOT NULL DEFAULT 'Tienda',  -- 'Tienda' | 'Pedido'
    pedido_numero   VARCHAR(50)
);


-- =============================================================================
--  4. DETALLE_VENTAS
--     - producto_id: nullable (SET NULL si el producto se elimina)
--     - nombre_producto / codigo_barras: snapshot al momento de la venta,
--       los reportes leen estos campos directamente, sin JOIN a productos
-- =============================================================================
CREATE TABLE detalle_ventas (
    detalle_id      SERIAL          PRIMARY KEY,
    venta_id        INTEGER         NOT NULL REFERENCES ventas(venta_id),
    producto_id     INTEGER         REFERENCES productos(producto_id) ON DELETE SET NULL,
    nombre_producto VARCHAR(255),   -- snapshot
    codigo_barras   VARCHAR(100),   -- snapshot
    cantidad        INTEGER         NOT NULL,
    precio_unitario DECIMAL(10,2)   NOT NULL,
    subtotal        DECIMAL(10,2)   NOT NULL
);


-- =============================================================================
--  5. CAJA
--     - fecha_cierre = NULL  →  caja actualmente abierta
--     - Solo puede haber una caja abierta a la vez
--     - Al abrir caja nueva, la de día anterior se cierra automáticamente
-- =============================================================================
CREATE TABLE caja (
    caja_id             SERIAL          PRIMARY KEY,
    usuario_apertura_id INTEGER         NOT NULL REFERENCES usuarios(usuario_id),
    usuario_cierre_id   INTEGER         REFERENCES usuarios(usuario_id),
    monto_inicial       DECIMAL(12,2)   NOT NULL DEFAULT 0,
    monto_final         DECIMAL(12,2),
    fecha_apertura      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    fecha_cierre        TIMESTAMPTZ     -- NULL = abierta
);


-- =============================================================================
--  6. MOVIMIENTO_CAJA
--     Tipos válidos:
--       INGRESO  → entrada de dinero (incluye ventas automáticamente)
--       EGRESO   → salida de dinero manual
--       SOBRANTE → diferencia positiva al cerrar caja
--       FALTANTE → diferencia negativa al cerrar caja
--
--     IMPORTANTE — cálculo de monto esperado al cierre:
--       monto_esperado = monto_inicial + SUM(INGRESO) - SUM(EGRESO)
--       Los INGRESO ya incluyen las ventas; NO sumar tabla ventas por separado
--       (causaría doble conteo).
-- =============================================================================
CREATE TABLE movimiento_caja (
    movimiento_caja_id  SERIAL          PRIMARY KEY,
    caja_id             INTEGER         NOT NULL REFERENCES caja(caja_id),
    usuario_id          INTEGER         NOT NULL REFERENCES usuarios(usuario_id),
    tipo_movimiento     VARCHAR(50)     NOT NULL,  -- INGRESO | EGRESO | SOBRANTE | FALTANTE
    monto               DECIMAL(10,2)   NOT NULL,
    concepto            VARCHAR(255),              -- ej: "Venta folio F-ABC123"
    fecha               TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);


-- =============================================================================
--  7. MOVIMIENTOS_INVENTARIO
--     Tipos y motivos válidos:
--       ENTRADA → motivos: COMPRA, DEVOLUCION, AJUSTE       (sube stock)
--       SALIDA  → motivos: AJUSTE                            (baja stock)
--       PERDIDA → motivos: ROBO, DAÑO, CADUCADO, MERMA      (baja stock)
--
--     - producto_id: nullable (SET NULL si el producto se elimina)
--     - nombre_producto / codigo_barras: snapshot al momento del movimiento
--     - stock_anterior / stock_nuevo: para trazabilidad histórica
-- =============================================================================
CREATE TABLE movimientos_inventario (
    movimiento_id   SERIAL          PRIMARY KEY,
    producto_id     INTEGER         REFERENCES productos(producto_id) ON DELETE SET NULL,
    nombre_producto VARCHAR(255),   -- snapshot
    codigo_barras   VARCHAR(100),   -- snapshot
    usuario_id      INTEGER         NOT NULL REFERENCES usuarios(usuario_id),
    tipo_movimiento VARCHAR(20)     NOT NULL,   -- ENTRADA | SALIDA | PERDIDA
    cantidad        INTEGER         NOT NULL,
    stock_anterior  INTEGER,
    stock_nuevo     INTEGER,
    motivo          VARCHAR(50),    -- categoría del movimiento (puede ser NULL)
    observaciones   VARCHAR(255),   -- texto libre opcional
    fecha           TIMESTAMPTZ     DEFAULT NOW()
);


-- =============================================================================
--  ÍNDICES recomendados para consultas frecuentes
-- =============================================================================
CREATE INDEX idx_ventas_fecha        ON ventas               (fecha);
CREATE INDEX idx_ventas_usuario      ON ventas               (usuario_id);
CREATE INDEX idx_detalle_venta       ON detalle_ventas        (venta_id);
CREATE INDEX idx_detalle_producto    ON detalle_ventas        (producto_id);
CREATE INDEX idx_movcaja_caja        ON movimiento_caja       (caja_id);
CREATE INDEX idx_movinv_producto     ON movimientos_inventario (producto_id);
CREATE INDEX idx_movinv_fecha        ON movimientos_inventario (fecha);
CREATE INDEX idx_productos_barras    ON productos             (codigo_barras);

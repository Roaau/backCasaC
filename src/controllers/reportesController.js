import sequelize from '../config/database.js';
import { QueryTypes } from 'sequelize';

// ==========================================
// 1. REPORTE DE VENTAS (Dinero y Flujo)
// ==========================================
export const getReporteVentas = async (req, res) => {
    try {
        const { fechaInicio, fechaFin } = req.body;

        const query = `
            SELECT 
                v.venta_id, 
                v.folio, 
                v.fecha, 
                v.total, 
                v.tipo_venta,
                v.pedido_numero,
                u.nombre as nombre_cajero
            FROM "ventas" v
            LEFT JOIN "usuarios" u ON v.usuario_id = u.usuario_id
            WHERE v.fecha BETWEEN :inicio AND :fin
            ORDER BY v.fecha DESC
        `;

        const ventas = await sequelize.query(query, {
            replacements: { 
                inicio: `${fechaInicio} 00:00:00`, 
                fin: `${fechaFin} 23:59:59` 
            },
            type: QueryTypes.SELECT
        });

        const totalDinero = ventas.reduce((acc, curr) => acc + parseFloat(curr.total), 0);
        const conteoVentas = ventas.length;

        res.json({
            datos: ventas,
            resumen: { totalDinero, conteoVentas }
        });

    } catch (error) {
        console.error("Error reporte ventas:", error);
        res.status(500).json({ error: "Error al generar reporte de ventas" });
    }
};

// ==========================================
// 2. REPORTE DE PRODUCTOS (Inventario vendido)
// ==========================================
export const getReporteProductos = async (req, res) => {
    try {
        const { fechaInicio, fechaFin } = req.body;

        // Nota: Asegúrate que la tabla se llame 'detalle_ventas' o 'DetalleVenta' según tu BD
        const query = `
            SELECT 
                p.codigo_barras,
                p.nombre as nombre_producto,
                p.stock_actual,
                SUM(d.cantidad) as cantidad_vendida,
                SUM(d.subtotal) as dinero_generado
            FROM "detalle_ventas" d
            JOIN "ventas" v ON d.venta_id = v.venta_id
            JOIN "productos" p ON d.producto_id = p.producto_id
            WHERE v.fecha BETWEEN :inicio AND :fin
            GROUP BY p.codigo_barras, p.nombre, p.stock_actual
            ORDER BY cantidad_vendida DESC
        `;

        const productos = await sequelize.query(query, {
            replacements: { 
                inicio: `${fechaInicio} 00:00:00`, 
                fin: `${fechaFin} 23:59:59` 
            },
            type: QueryTypes.SELECT
        });

        res.json(productos);

    } catch (error) {
        console.error("Error reporte productos:", error);
        res.status(500).json({ error: error.message });
    }
};

// ==========================================
// 3. REPORTE DE CAJA (Auditoría y Cortes)
// ==========================================
export const getReporteCaja = async (req, res) => {
    try {
        const { fechaInicio, fechaFin } = req.body;
        const replacements = { 
            inicio: `${fechaInicio} 00:00:00`, 
            fin: `${fechaFin} 23:59:59` 
        };

        // A. Historial de Cortes
        const queryCortes = `
            SELECT 
                c.caja_id,
                c.fecha_apertura,
                c.fecha_cierre,
                c.monto_inicial,
                c.monto_final,
                (c.monto_final - (
                    c.monto_inicial + 
                    (SELECT COALESCE(SUM(total),0) FROM "ventas" WHERE fecha BETWEEN c.fecha_apertura AND c.fecha_cierre) -
                    (SELECT COALESCE(SUM(monto),0) FROM "movimiento_caja" WHERE caja_id = c.caja_id AND tipo_movimiento = 'EGRESO')
                )) as diferencia_calculada,
                u1.nombre as abrio,
                u2.nombre as cerro
            FROM "caja" c
            LEFT JOIN "usuarios" u1 ON c.usuario_apertura_id = u1.usuario_id
            LEFT JOIN "usuarios" u2 ON c.usuario_cierre_id = u2.usuario_id
            WHERE c.fecha_apertura BETWEEN :inicio AND :fin
            ORDER BY c.fecha_apertura DESC
        `;

        // B. Historial de Movimientos
        const queryMovimientos = `
            SELECT 
                m.tipo_movimiento,
                m.monto,
                m.concepto,
                m.fecha,
                u.nombre as usuario
            FROM "movimiento_caja" m
            LEFT JOIN "usuarios" u ON m.usuario_id = u.usuario_id
            WHERE m.fecha BETWEEN :inicio AND :fin
            ORDER BY m.fecha DESC
        `;

        const cortes = await sequelize.query(queryCortes, { replacements, type: QueryTypes.SELECT });
        const movimientos = await sequelize.query(queryMovimientos, { replacements, type: QueryTypes.SELECT });

        res.json({ cortes, movimientos });

    } catch (error) {
        console.error("Error reporte caja:", error);
        res.status(500).json({ error: "Error al generar reporte de caja" });
    }
};

// ==========================================
// 4. REPORTE DE MOVIMIENTOS DE INVENTARIO (Bitácora)
// ==========================================
export const getReporteInventario = async (req, res) => {
    try {
        const { fechaInicio, fechaFin } = req.body;

        const query = `
            SELECT 
                m.fecha,
                m.tipo_movimiento,
                m.cantidad,
                m.observaciones,
                p.nombre as nombre_producto,
                p.codigo_barras,
                u.nombre as nombre_usuario
            FROM "movimientos_inventario" m
            JOIN "productos" p ON m.producto_id = p.producto_id
            LEFT JOIN "usuarios" u ON m.usuario_id = u.usuario_id
            WHERE m.fecha BETWEEN :inicio AND :fin
            ORDER BY m.fecha DESC
        `;

        const movimientos = await sequelize.query(query, {
            replacements: { 
                inicio: `${fechaInicio} 00:00:00`, 
                fin: `${fechaFin} 23:59:59` 
            },
            type: QueryTypes.SELECT
        });

        res.json(movimientos);

    } catch (error) {
        console.error("Error reporte inventario:", error);
        res.status(500).json({ error: "Error al generar reporte de inventario" });
    }
    
};
// ==========================================
// 5. DATOS PARA GRÁFICAS (Dashboard Visual)
// ==========================================
export const getDatosGraficas = async (req, res) => {
    try {
        const { fechaInicio, fechaFin } = req.body;
        const replacements = { 
            inicio: `${fechaInicio} 00:00:00`, 
            fin: `${fechaFin} 23:59:59` 
        };

        // A. TOP 5 PRODUCTOS (Barras)
        const queryTop = `
            SELECT 
                p.nombre, 
                SUM(d.cantidad) as cantidad
            FROM "detalle_ventas" d
            JOIN "ventas" v ON d.venta_id = v.venta_id
            JOIN "productos" p ON d.producto_id = p.producto_id
            WHERE v.fecha BETWEEN :inicio AND :fin
            GROUP BY p.nombre
            ORDER BY cantidad DESC
            LIMIT 5
        `;

        // B. VENTAS POR DÍA (Línea)
        // Usamos TO_CHAR para agrupar por fecha (YYYY-MM-DD) en Postgres
        const queryTendencia = `
            SELECT 
                TO_CHAR(fecha, 'YYYY-MM-DD') as dia, 
                SUM(total) as total
            FROM "ventas"
            WHERE fecha BETWEEN :inicio AND :fin
            GROUP BY dia
            ORDER BY dia ASC
        `;

        const topProductos = await sequelize.query(queryTop, { replacements, type: QueryTypes.SELECT });
        const tendenciaVentas = await sequelize.query(queryTendencia, { replacements, type: QueryTypes.SELECT });

        res.json({ topProductos, tendenciaVentas });

    } catch (error) {
        console.error("Error gráficas:", error);
        res.status(500).json({ error: "Error al generar gráficas" });
    }
};
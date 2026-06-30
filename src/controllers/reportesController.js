import sequelize from '../config/database.js';
import { QueryTypes } from 'sequelize';
import { filtroEmpresa } from '../utils/filtros.js';
import ExcelJS from 'exceljs';

export const getReporteVentas = async (req, res) => {
    try {
        const { fechaInicio, fechaFin } = req.body;
        const { clausula, params } = filtroEmpresa(req.usuario, 'v.sucursal_id', 's', req.body);

        const query = `
            SELECT
                v.venta_id,
                v.folio,
                v.fecha,
                v.total,
                v.tipo_venta,
                v.pedido_numero,
                u.nombre as nombre_cajero,
                s.nombre as nombre_sucursal
            FROM "ventas" v
            LEFT JOIN "usuarios"   u ON v.usuario_id  = u.usuario_id
            LEFT JOIN "sucursales" s ON v.sucursal_id = s.sucursal_id
            WHERE v.fecha BETWEEN :inicio AND :fin
            ${clausula}
            ORDER BY v.fecha DESC
        `;

        const ventas = await sequelize.query(query, {
            replacements: {
                inicio: `${fechaInicio} 00:00:00`,
                fin:    `${fechaFin} 23:59:59`,
                ...params
            },
            type: QueryTypes.SELECT
        });

        const totalDinero  = ventas.reduce((acc, curr) => acc + parseFloat(curr.total), 0);
        const conteoVentas = ventas.length;

        res.json({ datos: ventas, resumen: { totalDinero, conteoVentas } });

    } catch (error) {
        res.status(500).json({ error: "Error al generar reporte de ventas" });
    }
};

export const getReporteProductos = async (req, res) => {
    try {
        const { fechaInicio, fechaFin } = req.body;
        const { clausula, params } = filtroEmpresa(req.usuario, 'v.sucursal_id', 's', req.body);

        const query = `
            SELECT
                d.codigo_barras,
                d.nombre_producto,
                MAX(p.stock_actual) as stock_actual,
                SUM(d.cantidad)     as cantidad_vendida,
                SUM(d.subtotal)     as dinero_generado
            FROM "detalle_ventas" d
            JOIN "ventas"    v ON d.venta_id   = v.venta_id
            LEFT JOIN "productos" p ON d.producto_id = p.producto_id
            LEFT JOIN "sucursales" s ON v.sucursal_id = s.sucursal_id
            WHERE v.fecha BETWEEN :inicio AND :fin
            ${clausula}
            GROUP BY d.codigo_barras, d.nombre_producto
            ORDER BY cantidad_vendida DESC
        `;

        const productos = await sequelize.query(query, {
            replacements: {
                inicio: `${fechaInicio} 00:00:00`,
                fin:    `${fechaFin} 23:59:59`,
                ...params
            },
            type: QueryTypes.SELECT
        });

        res.json(productos);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getReporteCaja = async (req, res) => {
    try {
        const { fechaInicio, fechaFin } = req.body;
        const { clausula: filtroCortes, params: paramsCortes }     = filtroEmpresa(req.usuario, 'c.sucursal_id', 's', req.body);
        const { clausula: filtroMovimientos, params: paramsMov }   = filtroEmpresa(req.usuario, 'c.sucursal_id', 's', req.body);

        const replacements = {
            inicio: `${fechaInicio} 00:00:00`,
            fin:    `${fechaFin} 23:59:59`
        };

        const queryCortes = `
            SELECT
                c.caja_id,
                c.fecha_apertura,
                c.fecha_cierre,
                c.monto_inicial,
                c.monto_final,
                (c.monto_final - (
                    c.monto_inicial +
                    (SELECT COALESCE(SUM(total),0) FROM "ventas" WHERE fecha BETWEEN c.fecha_apertura AND c.fecha_cierre AND sucursal_id = c.sucursal_id) -
                    (SELECT COALESCE(SUM(monto),0) FROM "movimiento_caja" WHERE caja_id = c.caja_id AND tipo_movimiento = 'EGRESO')
                )) as diferencia_calculada,
                u1.nombre as abrio,
                u2.nombre as cerro,
                s.nombre  as nombre_sucursal
            FROM "caja" c
            LEFT JOIN "usuarios"   u1 ON c.usuario_apertura_id = u1.usuario_id
            LEFT JOIN "usuarios"   u2 ON c.usuario_cierre_id   = u2.usuario_id
            LEFT JOIN "sucursales"  s ON c.sucursal_id         = s.sucursal_id
            WHERE c.fecha_apertura BETWEEN :inicio AND :fin
            ${filtroCortes}
            ORDER BY c.fecha_apertura DESC
        `;

        const queryMovimientos = `
            SELECT
                m.tipo_movimiento,
                m.monto,
                m.concepto,
                m.fecha,
                u.nombre as usuario,
                s.nombre as nombre_sucursal
            FROM "movimiento_caja" m
            LEFT JOIN "usuarios"   u ON m.usuario_id  = u.usuario_id
            LEFT JOIN "caja"       c ON m.caja_id     = c.caja_id
            LEFT JOIN "sucursales" s ON c.sucursal_id = s.sucursal_id
            WHERE m.fecha BETWEEN :inicio AND :fin
            ${filtroMovimientos}
            ORDER BY m.fecha DESC
        `;

        const cortes      = await sequelize.query(queryCortes,      { replacements: { ...replacements, ...paramsCortes }, type: QueryTypes.SELECT });
        const movimientos = await sequelize.query(queryMovimientos,  { replacements: { ...replacements, ...paramsMov   }, type: QueryTypes.SELECT });

        res.json({ cortes, movimientos });

    } catch (error) {
        res.status(500).json({ error: "Error al generar reporte de caja" });
    }
};

export const getReporteInventario = async (req, res) => {
    try {
        const { fechaInicio, fechaFin } = req.body;
        const { clausula, params } = filtroEmpresa(req.usuario, 'm.sucursal_id', 's', req.body);

        const query = `
            SELECT
                m.fecha,
                m.tipo_movimiento,
                m.cantidad,
                m.observaciones,
                m.nombre_producto,
                m.codigo_barras,
                u.nombre as nombre_usuario,
                s.nombre as nombre_sucursal
            FROM "movimientos_inventario" m
            LEFT JOIN "usuarios"   u ON m.usuario_id  = u.usuario_id
            LEFT JOIN "sucursales" s ON m.sucursal_id = s.sucursal_id
            WHERE m.fecha BETWEEN :inicio AND :fin
            ${clausula}
            ORDER BY m.fecha DESC
        `;

        const movimientos = await sequelize.query(query, {
            replacements: {
                inicio: `${fechaInicio} 00:00:00`,
                fin:    `${fechaFin} 23:59:59`,
                ...params
            },
            type: QueryTypes.SELECT
        });

        res.json(movimientos);

    } catch (error) {
        res.status(500).json({ error: "Error al generar reporte de inventario" });
    }
};

export const getDatosGraficas = async (req, res) => {
    try {
        const { fechaInicio, fechaFin } = req.body;
        const { clausula, params } = filtroEmpresa(req.usuario, 'v.sucursal_id', 's', req.body);

        const replacements = {
            inicio: `${fechaInicio} 00:00:00`,
            fin:    `${fechaFin} 23:59:59`,
            ...params
        };

        const queryTop = `
            SELECT
                d.nombre_producto as nombre,
                SUM(d.cantidad)   as cantidad
            FROM "detalle_ventas" d
            JOIN "ventas"     v ON d.venta_id    = v.venta_id
            LEFT JOIN "sucursales" s ON v.sucursal_id = s.sucursal_id
            WHERE v.fecha BETWEEN :inicio AND :fin
            ${clausula}
            GROUP BY d.nombre_producto
            ORDER BY cantidad DESC
            LIMIT 5
        `;

        const queryTendencia = `
            SELECT
                TO_CHAR(v.fecha, 'YYYY-MM-DD') as dia,
                SUM(v.total) as total
            FROM "ventas" v
            LEFT JOIN "sucursales" s ON v.sucursal_id = s.sucursal_id
            WHERE v.fecha BETWEEN :inicio AND :fin
            ${clausula}
            GROUP BY dia
            ORDER BY dia ASC
        `;

        const topProductos    = await sequelize.query(queryTop,       { replacements, type: QueryTypes.SELECT });
        const tendenciaVentas = await sequelize.query(queryTendencia, { replacements, type: QueryTypes.SELECT });

        res.json({ topProductos, tendenciaVentas });

    } catch (error) {
        res.status(500).json({ error: "Error al generar gráficas" });
    }
};

export const exportarExcel = async (req, res) => {
    try {
        const { tipo, fechaInicio, fechaFin } = req.body;
        const replacements = {
            inicio: `${fechaInicio} 00:00:00`,
            fin:    `${fechaFin} 23:59:59`
        };

        let filas = [];
        let columnas = [];
        let hojaNombre = 'Reporte';

        if (tipo === 'ventas') {
            const { clausula, params } = filtroEmpresa(req.usuario, 'v.sucursal_id', 's', req.body);
            filas = await sequelize.query(`
                SELECT v.folio, TO_CHAR(v.fecha, 'DD/MM/YYYY HH24:MI') as fecha,
                    v.total, v.tipo_venta, u.nombre as cajero, s.nombre as sucursal
                FROM "ventas" v
                LEFT JOIN "usuarios" u ON v.usuario_id = u.usuario_id
                LEFT JOIN "sucursales" s ON v.sucursal_id = s.sucursal_id
                WHERE v.fecha BETWEEN :inicio AND :fin ${clausula}
                ORDER BY v.fecha DESC
            `, { replacements: { ...replacements, ...params }, type: QueryTypes.SELECT });
            columnas = [
                { header: 'Folio',     key: 'folio',      width: 12 },
                { header: 'Fecha',     key: 'fecha',       width: 18 },
                { header: 'Total',     key: 'total',       width: 12 },
                { header: 'Tipo',      key: 'tipo_venta',  width: 14 },
                { header: 'Cajero',    key: 'cajero',      width: 20 },
                { header: 'Sucursal',  key: 'sucursal',    width: 20 }
            ];
            hojaNombre = 'Ventas';

        } else if (tipo === 'productos') {
            const { clausula, params } = filtroEmpresa(req.usuario, 'v.sucursal_id', 's', req.body);
            filas = await sequelize.query(`
                SELECT d.codigo_barras, d.nombre_producto,
                    SUM(d.cantidad) as cantidad_vendida, SUM(d.subtotal) as dinero_generado
                FROM "detalle_ventas" d
                JOIN "ventas" v ON d.venta_id = v.venta_id
                LEFT JOIN "sucursales" s ON v.sucursal_id = s.sucursal_id
                WHERE v.fecha BETWEEN :inicio AND :fin ${clausula}
                GROUP BY d.codigo_barras, d.nombre_producto
                ORDER BY cantidad_vendida DESC
            `, { replacements: { ...replacements, ...params }, type: QueryTypes.SELECT });
            columnas = [
                { header: 'Código',          key: 'codigo_barras',    width: 16 },
                { header: 'Producto',        key: 'nombre_producto',  width: 30 },
                { header: 'Cant. vendida',   key: 'cantidad_vendida', width: 14 },
                { header: 'Dinero generado', key: 'dinero_generado',  width: 16 }
            ];
            hojaNombre = 'Productos';

        } else if (tipo === 'caja') {
            const { clausula, params } = filtroEmpresa(req.usuario, 'c.sucursal_id', 's', req.body);
            filas = await sequelize.query(`
                SELECT TO_CHAR(c.fecha_apertura,'DD/MM/YYYY HH24:MI') as apertura,
                    TO_CHAR(c.fecha_cierre,'DD/MM/YYYY HH24:MI') as cierre,
                    c.monto_inicial, c.monto_final,
                    u1.nombre as abrio, u2.nombre as cerro, s.nombre as sucursal
                FROM "caja" c
                LEFT JOIN "usuarios" u1 ON c.usuario_apertura_id = u1.usuario_id
                LEFT JOIN "usuarios" u2 ON c.usuario_cierre_id   = u2.usuario_id
                LEFT JOIN "sucursales" s ON c.sucursal_id = s.sucursal_id
                WHERE c.fecha_apertura BETWEEN :inicio AND :fin ${clausula}
                ORDER BY c.fecha_apertura DESC
            `, { replacements: { ...replacements, ...params }, type: QueryTypes.SELECT });
            columnas = [
                { header: 'Apertura',      key: 'apertura',      width: 18 },
                { header: 'Cierre',        key: 'cierre',        width: 18 },
                { header: 'Monto inicial', key: 'monto_inicial', width: 14 },
                { header: 'Monto final',   key: 'monto_final',   width: 14 },
                { header: 'Abrió',         key: 'abrio',         width: 20 },
                { header: 'Cerró',         key: 'cerro',         width: 20 },
                { header: 'Sucursal',      key: 'sucursal',      width: 20 }
            ];
            hojaNombre = 'Caja';

        } else if (tipo === 'inventario') {
            const { clausula, params } = filtroEmpresa(req.usuario, 'm.sucursal_id', 's', req.body);
            filas = await sequelize.query(`
                SELECT TO_CHAR(m.fecha,'DD/MM/YYYY HH24:MI') as fecha,
                    m.tipo_movimiento, m.cantidad, m.nombre_producto,
                    m.codigo_barras, m.observaciones,
                    u.nombre as usuario, s.nombre as sucursal
                FROM "movimientos_inventario" m
                LEFT JOIN "usuarios" u ON m.usuario_id = u.usuario_id
                LEFT JOIN "sucursales" s ON m.sucursal_id = s.sucursal_id
                WHERE m.fecha BETWEEN :inicio AND :fin ${clausula}
                ORDER BY m.fecha DESC
            `, { replacements: { ...replacements, ...params }, type: QueryTypes.SELECT });
            columnas = [
                { header: 'Fecha',      key: 'fecha',            width: 18 },
                { header: 'Tipo',       key: 'tipo_movimiento',  width: 12 },
                { header: 'Cantidad',   key: 'cantidad',         width: 10 },
                { header: 'Producto',   key: 'nombre_producto',  width: 30 },
                { header: 'Código',     key: 'codigo_barras',    width: 16 },
                { header: 'Nota',       key: 'observaciones',    width: 25 },
                { header: 'Usuario',    key: 'usuario',          width: 20 },
                { header: 'Sucursal',   key: 'sucursal',         width: 20 }
            ];
            hojaNombre = 'Inventario';
        } else {
            return res.status(400).json({ error: 'Tipo de reporte no válido' });
        }

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'CasaC POS';
        const hoja = workbook.addWorksheet(hojaNombre);

        hoja.columns = columnas;

        // Estilo de encabezado
        hoja.getRow(1).eachCell(cell => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1e2227' } };
            cell.alignment = { horizontal: 'center' };
        });

        filas.forEach(fila => hoja.addRow(fila));

        // Bordes en toda la tabla
        hoja.eachRow((row, rowNum) => {
            row.eachCell(cell => {
                cell.border = {
                    top: { style: 'thin' }, left: { style: 'thin' },
                    bottom: { style: 'thin' }, right: { style: 'thin' }
                };
            });
        });

        const nombreArchivo = `CasaC_${hojaNombre}_${fechaInicio}_${fechaFin}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        res.status(500).json({ error: 'Error al exportar Excel: ' + error.message });
    }
};

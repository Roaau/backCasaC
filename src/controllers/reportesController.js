import sequelize from '../config/database.js';
import { QueryTypes } from 'sequelize';
import { filtroEmpresa } from '../utils/filtros.js';
import { rangoFechasReporte } from '../utils/fechas.js';
import ExcelJS from 'exceljs';

export const getReporteVentas = async (req, res) => {
    try {
        const { fechaInicio, fechaFin } = req.body;
        const rango = rangoFechasReporte(fechaInicio, fechaFin);
        const { clausula, params } = filtroEmpresa(req.usuario, 'v.sucursal_id', 's', req.body);

        const query = `
            SELECT
                v.venta_id,
                v.folio,
                v.fecha,
                v.total,
                v.tipo_venta,
                COALESCE(v.tipo_pago, 'efectivo') AS tipo_pago,
                v.pedido_numero,
                v.nombre_cliente,
                v.telefono_cliente,
                v.direccion_entrega,
                v.referencia_entrega,
                v.estado_pedido,
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
                inicio: rango.inicio,
                fin:    rango.fin,
                ...params
            },
            type: QueryTypes.SELECT
        });

        const totalDinero  = ventas.reduce((acc, curr) => acc + parseFloat(curr.total), 0);
        const conteoVentas = ventas.length;
        const totalEfectivo = ventas.filter(v => (v.tipo_pago || 'efectivo') === 'efectivo').reduce((acc, curr) => acc + parseFloat(curr.total), 0);
        const totalTarjeta = ventas.filter(v => (v.tipo_pago || 'efectivo') === 'tarjeta').reduce((acc, curr) => acc + parseFloat(curr.total), 0);
        const totalPedidos = ventas.filter(v => v.tipo_venta === 'Pedido').length;
        const ticketPromedio = conteoVentas > 0 ? totalDinero / conteoVentas : 0;

        res.json({ datos: ventas, resumen: { totalDinero, conteoVentas, totalEfectivo, totalTarjeta, totalPedidos, ticketPromedio } });

    } catch (error) {
        res.status(500).json({ error: "Error al generar reporte de ventas" });
    }
};

export const getReporteProductos = async (req, res) => {
    try {
        const { fechaInicio, fechaFin } = req.body;
        const rango = rangoFechasReporte(fechaInicio, fechaFin);
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
                inicio: rango.inicio,
                fin:    rango.fin,
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
        const rango = rangoFechasReporte(fechaInicio, fechaFin);
        const { clausula: filtroCortes, params: paramsCortes }     = filtroEmpresa(req.usuario, 'c.sucursal_id', 's', req.body);
        const { clausula: filtroMovimientos, params: paramsMov }   = filtroEmpresa(req.usuario, 'c.sucursal_id', 's', req.body);

        const replacements = {
            inicio: rango.inicio,
            fin:    rango.fin
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
                    (SELECT COALESCE(SUM(total),0) FROM "ventas" WHERE fecha BETWEEN c.fecha_apertura AND c.fecha_cierre AND sucursal_id = c.sucursal_id AND COALESCE(tipo_pago, 'efectivo') = 'efectivo') -
                    (SELECT COALESCE(SUM(monto),0) FROM "movimiento_caja" WHERE caja_id = c.caja_id AND tipo_movimiento = 'EGRESO')
                )) as diferencia,
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
        const rango = rangoFechasReporte(fechaInicio, fechaFin);
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
                inicio: rango.inicio,
                fin:    rango.fin,
                ...params
            },
            type: QueryTypes.SELECT
        });

        res.json(movimientos);

    } catch (error) {
        res.status(500).json({ error: "Error al generar reporte de inventario" });
    }
};

const numero = (valor) => Number(valor || 0);

const construirReporteDiario = async (req) => {
    const { fechaInicio, fechaFin } = req.body;
    const rango = rangoFechasReporte(fechaInicio, fechaFin);
    const baseReplacements = { inicio: rango.inicio, fin: rango.fin };

    const { clausula: filtroSucursales, params: paramsSucursales } = filtroEmpresa(req.usuario, 's.sucursal_id', 's', req.body);
    const { clausula: filtroVentas, params: paramsVentas } = filtroEmpresa(req.usuario, 'v.sucursal_id', 's', req.body);
    const { clausula: filtroCaja, params: paramsCaja } = filtroEmpresa(req.usuario, 'c.sucursal_id', 's', req.body);
    const { clausula: filtroCompras, params: paramsCompras } = filtroEmpresa(req.usuario, 'co.sucursal_id', 's', req.body);
    const { clausula: filtroDevoluciones, params: paramsDevoluciones } = filtroEmpresa(req.usuario, 'd.sucursal_id', 's', req.body);

    const sucursales = await sequelize.query(`
        SELECT s.sucursal_id, s.nombre AS nombre_sucursal
        FROM "sucursales" s
        WHERE COALESCE(s.activa, true) = true
        ${filtroSucursales}
        ORDER BY s.nombre ASC
    `, { replacements: paramsSucursales, type: QueryTypes.SELECT });

    const ventas = await sequelize.query(`
        SELECT
            s.sucursal_id,
            s.nombre AS nombre_sucursal,
            COUNT(v.venta_id)::int AS conteo_ventas,
            COALESCE(SUM(v.total), 0) AS total_ventas,
            COALESCE(SUM(CASE WHEN LOWER(COALESCE(v.tipo_pago, 'efectivo')) = 'efectivo' THEN v.total ELSE 0 END), 0) AS total_efectivo,
            COALESCE(SUM(CASE WHEN LOWER(COALESCE(v.tipo_pago, '')) = 'tarjeta' THEN v.total ELSE 0 END), 0) AS total_tarjeta,
            COALESCE(SUM(CASE WHEN LOWER(COALESCE(v.tipo_pago, '')) = 'transferencia' THEN v.total ELSE 0 END), 0) AS total_transferencia,
            COALESCE(SUM(CASE WHEN LOWER(COALESCE(v.tipo_pago, '')) = 'credito' THEN v.total ELSE 0 END), 0) AS total_credito,
            COALESCE(SUM(CASE WHEN v.tipo_venta = 'Pedido' THEN 1 ELSE 0 END), 0)::int AS total_pedidos
        FROM "ventas" v
        LEFT JOIN "sucursales" s ON v.sucursal_id = s.sucursal_id
        WHERE v.fecha BETWEEN :inicio AND :fin
        ${filtroVentas}
        GROUP BY s.sucursal_id, s.nombre
    `, { replacements: { ...baseReplacements, ...paramsVentas }, type: QueryTypes.SELECT });

    const cajas = await sequelize.query(`
        SELECT
            c.caja_id,
            c.sucursal_id,
            s.nombre AS nombre_sucursal,
            c.fecha_apertura,
            c.fecha_cierre,
            c.monto_inicial,
            c.monto_final,
            u1.nombre AS abrio,
            u2.nombre AS cerro,
            (
                c.monto_inicial
                + COALESCE((SELECT SUM(v.total) FROM "ventas" v WHERE v.sucursal_id = c.sucursal_id AND v.fecha BETWEEN c.fecha_apertura AND COALESCE(c.fecha_cierre, :fin) AND LOWER(COALESCE(v.tipo_pago, 'efectivo')) = 'efectivo'), 0)
                + COALESCE((SELECT SUM(m.monto) FROM "movimiento_caja" m WHERE m.caja_id = c.caja_id AND UPPER(m.tipo_movimiento) = 'INGRESO'), 0)
                - COALESCE((SELECT SUM(m.monto) FROM "movimiento_caja" m WHERE m.caja_id = c.caja_id AND UPPER(m.tipo_movimiento) IN ('EGRESO', 'DEVOLUCION')), 0)
            ) AS monto_esperado,
            CASE WHEN c.monto_final IS NULL THEN NULL ELSE (
                c.monto_final - (
                    c.monto_inicial
                    + COALESCE((SELECT SUM(v.total) FROM "ventas" v WHERE v.sucursal_id = c.sucursal_id AND v.fecha BETWEEN c.fecha_apertura AND COALESCE(c.fecha_cierre, :fin) AND LOWER(COALESCE(v.tipo_pago, 'efectivo')) = 'efectivo'), 0)
                    + COALESCE((SELECT SUM(m.monto) FROM "movimiento_caja" m WHERE m.caja_id = c.caja_id AND UPPER(m.tipo_movimiento) = 'INGRESO'), 0)
                    - COALESCE((SELECT SUM(m.monto) FROM "movimiento_caja" m WHERE m.caja_id = c.caja_id AND UPPER(m.tipo_movimiento) IN ('EGRESO', 'DEVOLUCION')), 0)
                )
            ) END AS diferencia
        FROM "caja" c
        LEFT JOIN "usuarios" u1 ON c.usuario_apertura_id = u1.usuario_id
        LEFT JOIN "usuarios" u2 ON c.usuario_cierre_id = u2.usuario_id
        LEFT JOIN "sucursales" s ON c.sucursal_id = s.sucursal_id
        WHERE c.fecha_apertura BETWEEN :inicio AND :fin
        ${filtroCaja}
        ORDER BY s.nombre ASC, c.fecha_apertura ASC
    `, { replacements: { ...baseReplacements, ...paramsCaja }, type: QueryTypes.SELECT });

    const movimientos = await sequelize.query(`
        SELECT
            m.movimiento_caja_id AS movimiento_id,
            c.sucursal_id,
            s.nombre AS nombre_sucursal,
            m.fecha,
            m.tipo_movimiento,
            m.monto,
            m.concepto,
            u.nombre AS usuario
        FROM "movimiento_caja" m
        LEFT JOIN "caja" c ON m.caja_id = c.caja_id
        LEFT JOIN "usuarios" u ON m.usuario_id = u.usuario_id
        LEFT JOIN "sucursales" s ON c.sucursal_id = s.sucursal_id
        WHERE m.fecha BETWEEN :inicio AND :fin
        ${filtroCaja}
        ORDER BY s.nombre ASC, m.fecha ASC
    `, { replacements: { ...baseReplacements, ...paramsCaja }, type: QueryTypes.SELECT });

    const compras = await sequelize.query(`
        SELECT
            s.sucursal_id,
            s.nombre AS nombre_sucursal,
            COUNT(co.compra_id)::int AS conteo_compras,
            COALESCE(SUM(co.total), 0) AS total_compras
        FROM "compras" co
        LEFT JOIN "sucursales" s ON co.sucursal_id = s.sucursal_id
        WHERE co.fecha BETWEEN :inicio AND :fin
        ${filtroCompras}
        GROUP BY s.sucursal_id, s.nombre
    `, { replacements: { ...baseReplacements, ...paramsCompras }, type: QueryTypes.SELECT });

    const devoluciones = await sequelize.query(`
        SELECT
            s.sucursal_id,
            s.nombre AS nombre_sucursal,
            COUNT(d.devolucion_id)::int AS conteo_devoluciones,
            COALESCE(SUM(d.total_devuelto), 0) AS total_devoluciones
        FROM "devoluciones" d
        LEFT JOIN "sucursales" s ON d.sucursal_id = s.sucursal_id
        WHERE d.fecha BETWEEN :inicio AND :fin
        ${filtroDevoluciones}
        GROUP BY s.sucursal_id, s.nombre
    `, { replacements: { ...baseReplacements, ...paramsDevoluciones }, type: QueryTypes.SELECT });

    const cfdis = await sequelize.query(`
        SELECT
            s.sucursal_id,
            s.nombre AS nombre_sucursal,
            COUNT(cf.cfdi_id)::int AS total_cfdi,
            COALESCE(SUM(CASE WHEN cf.estado = 'PENDIENTE' THEN 1 ELSE 0 END), 0)::int AS cfdi_pendientes,
            COALESCE(SUM(CASE WHEN cf.estado = 'TIMBRADO' THEN 1 ELSE 0 END), 0)::int AS cfdi_timbrados,
            COALESCE(SUM(CASE WHEN cf.estado = 'CANCELADO' THEN 1 ELSE 0 END), 0)::int AS cfdi_cancelados
        FROM "cfdi_ventas" cf
        LEFT JOIN "ventas" v ON cf.venta_id = v.venta_id
        LEFT JOIN "sucursales" s ON v.sucursal_id = s.sucursal_id
        WHERE COALESCE(cf.creado_en, v.fecha) BETWEEN :inicio AND :fin
        ${filtroVentas}
        GROUP BY s.sucursal_id, s.nombre
    `, { replacements: { ...baseReplacements, ...paramsVentas }, type: QueryTypes.SELECT });

    const crearSucursal = (row) => ({
        sucursal_id: row.sucursal_id,
        nombre_sucursal: row.nombre_sucursal || 'Sin sucursal',
        ventas: {
            totalVentas: 0,
            conteoVentas: 0,
            totalEfectivo: 0,
            totalTarjeta: 0,
            totalTransferencia: 0,
            totalCredito: 0,
            totalPedidos: 0,
            ticketPromedio: 0
        },
        compras: { totalCompras: 0, conteoCompras: 0 },
        devoluciones: { totalDevoluciones: 0, conteoDevoluciones: 0 },
        cfdi: { totalCfdi: 0, cfdiPendientes: 0, cfdiTimbrados: 0, cfdiCancelados: 0 },
        resultado: { ingresosCaja: 0, egresosCaja: 0, efectivoEsperado: 0, diferenciaTotal: 0, resultadoOperativo: 0 },
        cajas: [],
        movimientos: []
    });

    const porSucursal = new Map();
    const asegurarSucursal = (row) => {
        const id = row.sucursal_id || 0;
        if (!porSucursal.has(id)) porSucursal.set(id, crearSucursal({ ...row, sucursal_id: id }));
        return porSucursal.get(id);
    };

    sucursales.forEach(asegurarSucursal);

    ventas.forEach(row => {
        const sucursal = asegurarSucursal(row);
        sucursal.ventas = {
            totalVentas: numero(row.total_ventas),
            conteoVentas: numero(row.conteo_ventas),
            totalEfectivo: numero(row.total_efectivo),
            totalTarjeta: numero(row.total_tarjeta),
            totalTransferencia: numero(row.total_transferencia),
            totalCredito: numero(row.total_credito),
            totalPedidos: numero(row.total_pedidos),
            ticketPromedio: numero(row.conteo_ventas) > 0 ? numero(row.total_ventas) / numero(row.conteo_ventas) : 0
        };
    });

    compras.forEach(row => {
        const sucursal = asegurarSucursal(row);
        sucursal.compras = { totalCompras: numero(row.total_compras), conteoCompras: numero(row.conteo_compras) };
    });

    devoluciones.forEach(row => {
        const sucursal = asegurarSucursal(row);
        sucursal.devoluciones = { totalDevoluciones: numero(row.total_devoluciones), conteoDevoluciones: numero(row.conteo_devoluciones) };
    });

    cfdis.forEach(row => {
        const sucursal = asegurarSucursal(row);
        sucursal.cfdi = {
            totalCfdi: numero(row.total_cfdi),
            cfdiPendientes: numero(row.cfdi_pendientes),
            cfdiTimbrados: numero(row.cfdi_timbrados),
            cfdiCancelados: numero(row.cfdi_cancelados)
        };
    });

    cajas.forEach(row => {
        const sucursal = asegurarSucursal(row);
        sucursal.cajas.push({
            caja_id: row.caja_id,
            fecha_apertura: row.fecha_apertura,
            fecha_cierre: row.fecha_cierre,
            monto_inicial: numero(row.monto_inicial),
            monto_final: row.monto_final === null ? null : numero(row.monto_final),
            monto_esperado: numero(row.monto_esperado),
            diferencia: row.diferencia === null ? null : numero(row.diferencia),
            abrio: row.abrio,
            cerro: row.cerro,
            nombre_sucursal: row.nombre_sucursal
        });
    });

    movimientos.forEach(row => {
        const sucursal = asegurarSucursal(row);
        sucursal.movimientos.push({
            movimiento_id: row.movimiento_id,
            fecha: row.fecha,
            tipo_movimiento: row.tipo_movimiento,
            monto: numero(row.monto),
            concepto: row.concepto,
            usuario: row.usuario,
            nombre_sucursal: row.nombre_sucursal
        });
    });

    const sucursalesReporte = Array.from(porSucursal.values()).map(sucursal => {
        const ingresosManuales = sucursal.movimientos
            .filter(m => String(m.tipo_movimiento).toUpperCase() === 'INGRESO')
            .reduce((sum, m) => sum + numero(m.monto), 0);
        const egresosManuales = sucursal.movimientos
            .filter(m => String(m.tipo_movimiento).toUpperCase() === 'EGRESO')
            .reduce((sum, m) => sum + numero(m.monto), 0);
        sucursal.resultado.ingresosCaja = sucursal.ventas.totalEfectivo + ingresosManuales;
        sucursal.resultado.egresosCaja = sucursal.compras.totalCompras + sucursal.devoluciones.totalDevoluciones + egresosManuales;
        sucursal.resultado.efectivoEsperado = sucursal.cajas.reduce((sum, c) => sum + numero(c.monto_esperado), 0);
        sucursal.resultado.diferenciaTotal = sucursal.cajas.reduce((sum, c) => sum + numero(c.diferencia), 0);
        sucursal.resultado.resultadoOperativo = sucursal.ventas.totalVentas - sucursal.compras.totalCompras - sucursal.devoluciones.totalDevoluciones;
        return sucursal;
    });

    const totales = sucursalesReporte.reduce((acc, sucursal) => {
        acc.totalVentas += sucursal.ventas.totalVentas;
        acc.conteoVentas += sucursal.ventas.conteoVentas;
        acc.totalCompras += sucursal.compras.totalCompras;
        acc.totalDevoluciones += sucursal.devoluciones.totalDevoluciones;
        acc.totalCfdi += sucursal.cfdi.totalCfdi;
        acc.ingresosCaja += sucursal.resultado.ingresosCaja;
        acc.egresosCaja += sucursal.resultado.egresosCaja;
        acc.efectivoEsperado += sucursal.resultado.efectivoEsperado;
        acc.diferenciaTotal += sucursal.resultado.diferenciaTotal;
        acc.resultadoOperativo += sucursal.resultado.resultadoOperativo;
        return acc;
    }, { totalVentas: 0, conteoVentas: 0, totalCompras: 0, totalDevoluciones: 0, totalCfdi: 0, ingresosCaja: 0, egresosCaja: 0, efectivoEsperado: 0, diferenciaTotal: 0, resultadoOperativo: 0 });

    return {
        fechaInicio,
        fechaFin,
        sucursales: sucursalesReporte,
        totales
    };
};

export const getReporteDiario = async (req, res) => {
    try {
        const reporte = await construirReporteDiario(req);
        res.json(reporte);
    } catch (error) {
        res.status(500).json({ error: 'Error al generar reporte diario' });
    }
};
export const getDatosGraficas = async (req, res) => {
    try {
        const { fechaInicio, fechaFin } = req.body;
        const rango = rangoFechasReporte(fechaInicio, fechaFin);
        const { clausula, params } = filtroEmpresa(req.usuario, 'v.sucursal_id', 's', req.body);

        const replacements = {
            inicio: rango.inicio,
            fin:    rango.fin,
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
        res.status(500).json({ error: "Error al generar graficas" });
    }
};

export const exportarExcel = async (req, res) => {
    try {
        const { tipo, fechaInicio, fechaFin } = req.body;
        const rango = rangoFechasReporte(fechaInicio, fechaFin);
        const replacements = {
            inicio: rango.inicio,
            fin:    rango.fin
        };

        let filas = [];
        let columnas = [];
        let hojaNombre = 'Reporte';

        if (tipo === 'ventas') {
            const { clausula, params } = filtroEmpresa(req.usuario, 'v.sucursal_id', 's', req.body);
            filas = await sequelize.query(`
                SELECT v.folio, TO_CHAR(v.fecha, 'DD/MM/YYYY HH24:MI') as fecha,
                    v.total, v.tipo_venta, v.nombre_cliente, v.telefono_cliente, v.direccion_entrega, v.estado_pedido,
                    u.nombre as cajero, s.nombre as sucursal
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
                { header: 'Cliente',   key: 'nombre_cliente', width: 24 },
                { header: 'Telefono',  key: 'telefono_cliente', width: 16 },
                { header: 'Entrega',   key: 'direccion_entrega', width: 34 },
                { header: 'Estado',    key: 'estado_pedido', width: 14 },
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
                { header: 'Codigo',          key: 'codigo_barras',    width: 16 },
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
                { header: 'Abrio',         key: 'abrio',         width: 20 },
                { header: 'Cerro',         key: 'cerro',         width: 20 },
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
                { header: 'Codigo',     key: 'codigo_barras',    width: 16 },
                { header: 'Nota',       key: 'observaciones',    width: 25 },
                { header: 'Usuario',    key: 'usuario',          width: 20 },
                { header: 'Sucursal',   key: 'sucursal',         width: 20 }
            ];
            hojaNombre = 'Inventario';
        } else if (tipo === 'compras') {
            const { clausula, params } = filtroEmpresa(req.usuario, 'co.sucursal_id', 's', req.body);
            filas = await sequelize.query(`
                SELECT TO_CHAR(co.fecha,'DD/MM/YYYY HH24:MI') as fecha,
                    co.folio, p.nombre as proveedor, co.total, co.notas, s.nombre as sucursal
                FROM "compras" co
                LEFT JOIN "proveedores" p ON co.proveedor_id = p.proveedor_id
                LEFT JOIN "sucursales" s ON co.sucursal_id = s.sucursal_id
                WHERE co.fecha BETWEEN :inicio AND :fin ${clausula}
                ORDER BY co.fecha DESC
            `, { replacements: { ...replacements, ...params }, type: QueryTypes.SELECT });
            columnas = [
                { header: 'Fecha', key: 'fecha', width: 18 },
                { header: 'Folio', key: 'folio', width: 16 },
                { header: 'Proveedor', key: 'proveedor', width: 26 },
                { header: 'Total', key: 'total', width: 14 },
                { header: 'Notas', key: 'notas', width: 30 },
                { header: 'Sucursal', key: 'sucursal', width: 20 }
            ];
            hojaNombre = 'Compras';

        } else if (tipo === 'facturas') {
            const { clausula, params } = filtroEmpresa(req.usuario, 'v.sucursal_id', 's', req.body);
            filas = await sequelize.query(`
                SELECT v.folio as folio_venta, TO_CHAR(v.fecha,'DD/MM/YYYY HH24:MI') as fecha_venta,
                    cf.receptor_rfc, cf.receptor_nombre, v.total as total_venta, cf.estado, cf.cfdi_uuid, s.nombre as sucursal
                FROM "cfdi_ventas" cf
                LEFT JOIN "ventas" v ON cf.venta_id = v.venta_id
                LEFT JOIN "sucursales" s ON v.sucursal_id = s.sucursal_id
                WHERE COALESCE(cf.creado_en, v.fecha) BETWEEN :inicio AND :fin ${clausula}
                ORDER BY COALESCE(cf.creado_en, v.fecha) DESC
            `, { replacements: { ...replacements, ...params }, type: QueryTypes.SELECT });
            columnas = [
                { header: 'Folio venta', key: 'folio_venta', width: 16 },
                { header: 'Fecha', key: 'fecha_venta', width: 18 },
                { header: 'RFC receptor', key: 'receptor_rfc', width: 16 },
                { header: 'Receptor', key: 'receptor_nombre', width: 32 },
                { header: 'Total', key: 'total_venta', width: 14 },
                { header: 'Estado', key: 'estado', width: 14 },
                { header: 'UUID', key: 'cfdi_uuid', width: 38 },
                { header: 'Sucursal', key: 'sucursal', width: 20 }
            ];
            hojaNombre = 'Facturas';

        } else if (tipo === 'diario') {
            const reporte = await construirReporteDiario(req);
            filas = reporte.sucursales.map(sucursal => ({
                sucursal: sucursal.nombre_sucursal,
                ventas_total: sucursal.ventas.totalVentas,
                ventas_conteo: sucursal.ventas.conteoVentas,
                efectivo: sucursal.ventas.totalEfectivo,
                tarjeta: sucursal.ventas.totalTarjeta,
                transferencia: sucursal.ventas.totalTransferencia,
                credito: sucursal.ventas.totalCredito,
                compras_total: sucursal.compras.totalCompras,
                compras_conteo: sucursal.compras.conteoCompras,
                devoluciones_total: sucursal.devoluciones.totalDevoluciones,
                facturas: sucursal.cfdi.totalCfdi,
                efectivo_esperado: sucursal.resultado.efectivoEsperado,
                diferencia_caja: sucursal.resultado.diferenciaTotal,
                resultado_operativo: sucursal.resultado.resultadoOperativo
            }));
            columnas = [
                { header: 'Sucursal', key: 'sucursal', width: 24 },
                { header: 'Ventas total', key: 'ventas_total', width: 16 },
                { header: 'Ventas conteo', key: 'ventas_conteo', width: 14 },
                { header: 'Efectivo', key: 'efectivo', width: 14 },
                { header: 'Tarjeta', key: 'tarjeta', width: 14 },
                { header: 'Transferencia', key: 'transferencia', width: 16 },
                { header: 'Credito', key: 'credito', width: 14 },
                { header: 'Compras total', key: 'compras_total', width: 16 },
                { header: 'Compras conteo', key: 'compras_conteo', width: 14 },
                { header: 'Devoluciones', key: 'devoluciones_total', width: 16 },
                { header: 'Facturas', key: 'facturas', width: 12 },
                { header: 'Efectivo esperado', key: 'efectivo_esperado', width: 18 },
                { header: 'Diferencia caja', key: 'diferencia_caja', width: 16 },
                { header: 'Resultado operativo', key: 'resultado_operativo', width: 20 }
            ];
            hojaNombre = 'Diario';

        } else {
            return res.status(400).json({ error: 'Tipo de reporte no valido' });
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







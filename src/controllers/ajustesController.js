import sequelize from '../config/database.js';
import { QueryTypes } from 'sequelize';
import { filtroEmpresa } from '../utils/filtros.js';
import { rangoFechasReporte } from '../utils/fechas.js';
import { obtenerEmpresaId } from '../utils/scope.js';

// Reporte "Cambios y ajustes": todo lo que mueve dinero fuera de una venta normal.
// POST /api/reportes/ajustes { fechaInicio, fechaFin, sucursal_id?, todas_sucursales?, tipo? }
export const TIPOS_AJUSTE = {
  precio: 'Cambio de precio',
  descuento: 'Descuento en venta',
  devolucion: 'Devolución',
  retiro: 'Retiro de efectivo',
  merma: 'Salida o merma de inventario'
};

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
};

/** Convierte las filas de la bitacora de precios en renglones del reporte. */
export const filasPrecio = (auditorias) => auditorias.flatMap(a => {
  const d = a.detalle || {};
  if (a.accion === 'PRECIO_CAMBIO') {
    return [{
      tipo: 'precio', fecha: a.fecha, usuario: a.usuario, sucursal: a.sucursal,
      descripcion: d.nombre || `Producto ${a.entidad_id}`,
      antes: num(d.antes), despues: num(d.despues),
      motivo: [d.motivo, d.origen === 'compra' ? `en compra${d.folio ? ' ' + d.folio : ''}` : null].filter(Boolean).join(' · '),
      monto: d.antes != null && d.despues != null ? num(Number(d.despues) - Number(d.antes)) : null
    }];
  }
  // PRODUCTO_EDITAR: solo cuenta si cambio el precio de venta
  const antes = num(d.antes?.precio_menudeo);
  const despues = num(d.despues?.precio_menudeo);
  if (despues === null || antes === despues) return [];
  return [{
    tipo: 'precio', fecha: a.fecha, usuario: a.usuario, sucursal: a.sucursal,
    descripcion: d.antes?.nombre || d.despues?.nombre || `Producto ${a.entidad_id}`,
    antes, despues, motivo: 'Editado en inventario',
    monto: antes !== null ? num(despues - antes) : null
  }];
});

export const getReporteAjustes = async (req, res) => {
  try {
    const { fechaInicio, fechaFin, tipo } = req.body || {};
    const rango = rangoFechasReporte(fechaInicio, fechaFin);
    const base = { inicio: rango.inicio, fin: rango.fin };
    const quiere = (t) => !tipo || tipo === t;
    const consultas = [];

    if (quiere('precio')) {
      // Los precios son del producto (toda la empresa), no de una sucursal
      consultas.push(sequelize.query(`
        SELECT a.accion, a.entidad_id, a.detalle, a.fecha, u.nombre AS usuario, s.nombre AS sucursal
          FROM auditoria a
          LEFT JOIN usuarios u ON u.usuario_id = a.usuario_id
          LEFT JOIN sucursales s ON s.sucursal_id = a.sucursal_id
         WHERE a.empresa_id = :empresa_id AND a.fecha BETWEEN :inicio AND :fin
           AND a.accion IN ('PRECIO_CAMBIO', 'PRODUCTO_EDITAR')`,
        { replacements: { ...base, empresa_id: obtenerEmpresaId(req.usuario) }, type: QueryTypes.SELECT })
        .then(filasPrecio));
    }

    if (quiere('descuento')) {
      const { clausula, params } = filtroEmpresa(req.usuario, 'v.sucursal_id', 's', req.body);
      consultas.push(sequelize.query(`
        SELECT v.folio, v.fecha, v.total, v.descuento_porcentaje, u.nombre AS usuario, s.nombre AS sucursal
          FROM ventas v
          LEFT JOIN usuarios u ON u.usuario_id = v.usuario_id
          LEFT JOIN sucursales s ON s.sucursal_id = v.sucursal_id
         WHERE v.fecha BETWEEN :inicio AND :fin AND COALESCE(v.descuento_porcentaje, 0) > 0 ${clausula}`,
        { replacements: { ...base, ...params }, type: QueryTypes.SELECT })
        .then(filas => filas.map(f => {
          const p = Number(f.descuento_porcentaje);
          const total = Number(f.total);
          const descontado = p > 0 && p < 100 ? total * p / (100 - p) : 0;
          return {
            tipo: 'descuento', fecha: f.fecha, usuario: f.usuario, sucursal: f.sucursal,
            descripcion: `Venta ${f.folio}`, antes: num(total + descontado), despues: num(total),
            motivo: `${num(p)} % de descuento`, monto: num(-descontado)
          };
        })));
    }

    if (quiere('devolucion')) {
      const { clausula, params } = filtroEmpresa(req.usuario, 'd.sucursal_id', 's', req.body);
      consultas.push(sequelize.query(`
        SELECT d.folio_venta, d.fecha, d.total_devuelto, d.motivo, u.nombre AS usuario, s.nombre AS sucursal
          FROM devoluciones d
          LEFT JOIN usuarios u ON u.usuario_id = d.usuario_id
          LEFT JOIN sucursales s ON s.sucursal_id = d.sucursal_id
         WHERE d.fecha BETWEEN :inicio AND :fin ${clausula}`,
        { replacements: { ...base, ...params }, type: QueryTypes.SELECT })
        .then(filas => filas.map(f => ({
          tipo: 'devolucion', fecha: f.fecha, usuario: f.usuario, sucursal: f.sucursal,
          descripcion: f.folio_venta ? `Venta ${f.folio_venta}` : 'Devolución',
          antes: null, despues: null, motivo: f.motivo || '', monto: num(-Number(f.total_devuelto || 0))
        }))));
    }

    if (quiere('retiro')) {
      const { clausula, params } = filtroEmpresa(req.usuario, 'c.sucursal_id', 's', req.body);
      consultas.push(sequelize.query(`
        SELECT m.monto, m.concepto, m.fecha, u.nombre AS usuario, s.nombre AS sucursal
          FROM movimiento_caja m
          LEFT JOIN caja c ON c.caja_id = m.caja_id
          LEFT JOIN usuarios u ON u.usuario_id = m.usuario_id
          LEFT JOIN sucursales s ON s.sucursal_id = c.sucursal_id
         WHERE m.fecha BETWEEN :inicio AND :fin AND m.tipo_movimiento = 'EGRESO' ${clausula}`,
        { replacements: { ...base, ...params }, type: QueryTypes.SELECT })
        .then(filas => filas.map(f => ({
          tipo: 'retiro', fecha: f.fecha, usuario: f.usuario, sucursal: f.sucursal,
          descripcion: 'Retiro de caja', antes: null, despues: null,
          motivo: f.concepto || '', monto: num(-Number(f.monto || 0))
        }))));
    }

    if (quiere('merma')) {
      const { clausula, params } = filtroEmpresa(req.usuario, 'mi.sucursal_id', 's', req.body);
      consultas.push(sequelize.query(`
        SELECT mi.nombre_producto, mi.cantidad, mi.motivo, mi.observaciones, mi.fecha,
               p.precio_compra, p.nombre AS producto, u.nombre AS usuario, s.nombre AS sucursal
          FROM movimientos_inventario mi
          LEFT JOIN productos p ON p.producto_id = mi.producto_id
          LEFT JOIN usuarios u ON u.usuario_id = mi.usuario_id
          LEFT JOIN sucursales s ON s.sucursal_id = mi.sucursal_id
         WHERE mi.fecha BETWEEN :inicio AND :fin
           AND mi.tipo_movimiento IN ('SALIDA', 'PERDIDA')
           AND COALESCE(mi.motivo, '') <> 'VENTA' ${clausula}`,
        { replacements: { ...base, ...params }, type: QueryTypes.SELECT })
        .then(filas => filas.map(f => {
          const costo = Number(f.precio_compra);
          return {
            tipo: 'merma', fecha: f.fecha, usuario: f.usuario, sucursal: f.sucursal,
            descripcion: `${num(f.cantidad)} × ${f.producto || f.nombre_producto || 'Producto'}`,
            antes: null, despues: null,
            motivo: [f.motivo, f.observaciones].filter(Boolean).join(' · '),
            monto: Number.isFinite(costo) && costo > 0 ? num(-costo * Number(f.cantidad || 0)) : null
          };
        })));
    }

    const datos = (await Promise.all(consultas)).flat()
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    const resumen = Object.fromEntries(Object.keys(TIPOS_AJUSTE).map(t => {
      const filas = datos.filter(d => d.tipo === t);
      return [t, { cantidad: filas.length, monto: num(filas.reduce((s, d) => s + (d.monto || 0), 0)) }];
    }));

    res.json({ datos, resumen, tipos: TIPOS_AJUSTE });
  } catch (error) {
    console.error('Reporte de ajustes:', error.message);
    res.status(500).json({ error: 'Error al generar el reporte de cambios y ajustes' });
  }
};

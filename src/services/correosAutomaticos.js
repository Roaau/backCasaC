import { QueryTypes } from "sequelize";
import sequelize from "../config/database.js";
import Empresa from "../models/EmpresaModel.js";
import { fechaLocalISO, rangoFechasReporte } from "../utils/fechas.js";
import { sumarAFecha } from "../utils/planes.js";
import { enviarResumenSemanal, enviarAlertasInventario } from "./emailService.js";

// Empresas que reciben correos: activas o en prueba, con correo y sin haberlos apagado
const empresasConCorreo = () => Empresa.findAll({
  where: { estado: ["activa", "prueba"], correos_automaticos: true },
  attributes: ["empresa_id", "razon_social", "email_contacto"]
}).then(lista => lista.filter(e => e.email_contacto));

const q = (sql, replacements) => sequelize.query(sql, { replacements, type: QueryTypes.SELECT });

const ventasEntre = async (empresa_id, desde, hasta) => {
  const { inicio, fin } = rangoFechasReporte(desde, hasta);
  const [fila] = await q(`
    SELECT COUNT(*)::int AS conteo, COALESCE(SUM(v.total), 0)::float AS total
      FROM ventas v JOIN sucursales s ON s.sucursal_id = v.sucursal_id
     WHERE s.empresa_id = :empresa_id AND v.fecha BETWEEN :inicio AND :fin`, { empresa_id, inicio, fin });
  return { conteo: Number(fila?.conteo || 0), total: Number(fila?.total || 0) };
};

const agotadosDe = (empresa_id) => q(`
  SELECT p.nombre, s.nombre AS sucursal
    FROM stock_sucursal ss
    JOIN productos p  ON p.producto_id = ss.producto_id
    JOIN sucursales s ON s.sucursal_id = ss.sucursal_id
   WHERE s.empresa_id = :empresa_id AND s.activa = true AND COALESCE(p.activo, true) = true
     AND ss.stock_actual <= 0
   ORDER BY p.nombre`, { empresa_id });

const caducanDe = (empresa_id, dias) => q(`
  SELECT DISTINCT p.nombre, p.fecha_caducidad::text AS fecha_caducidad
    FROM productos p
    JOIN stock_sucursal ss ON ss.producto_id = p.producto_id AND ss.stock_actual > 0
   WHERE p.empresa_id = :empresa_id AND COALESCE(p.activo, true) = true
     AND p.fecha_caducidad IS NOT NULL
     AND p.fecha_caducidad BETWEEN :hoy AND :limite
   ORDER BY fecha_caducidad`, { empresa_id, hoy: fechaLocalISO(), limite: sumarAFecha(fechaLocalISO(), { dias }) });

/** Lunes: resumen de la semana anterior (lunes a domingo). */
export async function correrResumenSemanal() {
  const hoy = fechaLocalISO();
  const hasta = sumarAFecha(hoy, { dias: -1 });
  const desde = sumarAFecha(hoy, { dias: -7 });
  const antesHasta = sumarAFecha(hoy, { dias: -8 });
  const antesDesde = sumarAFecha(hoy, { dias: -14 });
  const { inicio, fin } = rangoFechasReporte(desde, hasta);

  for (const emp of await empresasConCorreo()) {
    try {
      const [ventas, semanaAnterior, top, [dev], agotados, caducan] = await Promise.all([
        ventasEntre(emp.empresa_id, desde, hasta),
        ventasEntre(emp.empresa_id, antesDesde, antesHasta),
        q(`SELECT dv.nombre_producto AS nombre, SUM(dv.cantidad)::float AS cantidad
             FROM detalle_ventas dv JOIN ventas v ON v.venta_id = dv.venta_id
             JOIN sucursales s ON s.sucursal_id = v.sucursal_id
            WHERE s.empresa_id = :empresa_id AND v.fecha BETWEEN :inicio AND :fin
            GROUP BY dv.nombre_producto ORDER BY cantidad DESC LIMIT 5`, { empresa_id: emp.empresa_id, inicio, fin }),
        q(`SELECT COUNT(*)::int AS conteo, COALESCE(SUM(d.total_devuelto), 0)::float AS total
             FROM devoluciones d JOIN sucursales s ON s.sucursal_id = d.sucursal_id
            WHERE s.empresa_id = :empresa_id AND d.fecha BETWEEN :inicio AND :fin`, { empresa_id: emp.empresa_id, inicio, fin }),
        agotadosDe(emp.empresa_id),
        caducanDe(emp.empresa_id, 30)
      ]);
      if (ventas.conteo === 0 && semanaAnterior.conteo === 0) continue; // negocio sin uso: no se manda
      await enviarResumenSemanal({
        destinatario: emp.email_contacto, razon_social: emp.razon_social, desde, hasta,
        ventas, semanaAnterior, top, devoluciones: { conteo: Number(dev?.conteo || 0), total: Number(dev?.total || 0) },
        agotados: agotados.length, porCaducar: caducan.length
      });
    } catch (err) {
      console.error("[Resumen semanal]", emp.empresa_id, err.message);
    }
  }
}

/** Diario: agotados y productos que caducan en 7 dias (solo si hay algo que avisar). */
export async function correrAlertasInventario() {
  for (const emp of await empresasConCorreo()) {
    try {
      const [agotados, caducan] = await Promise.all([agotadosDe(emp.empresa_id), caducanDe(emp.empresa_id, 7)]);
      if (!agotados.length && !caducan.length) continue;
      await enviarAlertasInventario({ destinatario: emp.email_contacto, razon_social: emp.razon_social, agotados, caducan });
    } catch (err) {
      console.error("[Alertas inventario]", emp.empresa_id, err.message);
    }
  }
}

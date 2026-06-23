import sequelize from "../config/database.js";
import { QueryTypes } from "sequelize";
import CfdiVenta from "../models/CfdiVenta.js";
import { enviarFacturaPorCorreo } from "../services/emailService.js";

export const getCfdis = async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;
    const empresa_id = req.usuario.empresa_id;

    const replacements = { empresa_id };
    let dateClause = "";

    if (fechaInicio && fechaFin) {
      dateClause = "AND v.fecha >= :fechaInicio AND v.fecha < :fechaFin::date + INTERVAL '1 day'";
      replacements.fechaInicio = fechaInicio;
      replacements.fechaFin = fechaFin;
    } else if (fechaInicio) {
      dateClause = "AND v.fecha >= :fechaInicio";
      replacements.fechaInicio = fechaInicio;
    } else if (fechaFin) {
      dateClause = "AND v.fecha < :fechaFin::date + INTERVAL '1 day'";
      replacements.fechaFin = fechaFin;
    }

    const rows = await sequelize.query(
      `SELECT
         c.cfdi_id,
         c.venta_id,
         v.folio       AS folio_venta,
         v.fecha       AS fecha_venta,
         v.total       AS total_venta,
         c.receptor_rfc,
         c.receptor_nombre,
         c.receptor_cp,
         c.receptor_regimen,
         c.uso_cfdi,
         c.cfdi_uuid,
         c.estado,
         c.xml_cfdi,
         c.pdf_url,
         c.creado_en
       FROM cfdi_ventas c
       JOIN ventas v ON c.venta_id = v.venta_id
       JOIN sucursales s ON v.sucursal_id = s.sucursal_id
       WHERE s.empresa_id = :empresa_id
       ${dateClause}
       ORDER BY c.creado_en DESC`,
      { replacements, type: QueryTypes.SELECT }
    );

    const result = rows.map(r => ({
      ...r,
      total_venta: parseFloat(r.total_venta)
    }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

export const timbrarCfdi = async (req, res) => {
  try {
    const { cfdiId } = req.params;
    const { receptor_rfc, receptor_nombre, receptor_cp, receptor_regimen, uso_cfdi } = req.body;
    const empresa_id = req.usuario.empresa_id;

    const [cfdi] = await sequelize.query(
      `SELECT c.cfdi_id, c.estado FROM cfdi_ventas c
       JOIN ventas v ON c.venta_id = v.venta_id
       JOIN sucursales s ON v.sucursal_id = s.sucursal_id
       WHERE c.cfdi_id = :cfdiId AND s.empresa_id = :empresa_id`,
      { replacements: { cfdiId, empresa_id }, type: QueryTypes.SELECT }
    );
    if (!cfdi) return res.status(404).json({ error: "CFDI no encontrado" });

    if (cfdi.estado !== "PENDIENTE") {
      return res.status(400).json({ error: `El CFDI ya está en estado ${cfdi.estado}` });
    }

    if (!receptor_rfc || !receptor_nombre || !receptor_cp || !receptor_regimen || !uso_cfdi) {
      return res.status(400).json({ error: "Faltan datos fiscales del receptor" });
    }

    // Integración PAC pendiente — respuesta simulada con UUID v4 válido
    const uuid = crypto.randomUUID();

    await CfdiVenta.update({
      receptor_rfc:     receptor_rfc.toUpperCase(),
      receptor_nombre,
      receptor_cp,
      receptor_regimen,
      uso_cfdi,
      estado:    "TIMBRADO",
      cfdi_uuid: uuid
    }, { where: { cfdi_id: cfdiId } });

    res.json({ uuid, estado: "TIMBRADO" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

export const cancelarCfdi = async (req, res) => {
  try {
    const { cfdiId } = req.params;
    const { motivo } = req.body;
    const empresa_id = req.usuario.empresa_id;

    const motivosValidos = ["01", "02", "03", "04"];
    if (!motivo || !motivosValidos.includes(motivo)) {
      return res.status(400).json({ error: "motivo debe ser 01, 02, 03 o 04" });
    }

    const [cfdi] = await sequelize.query(
      `SELECT c.cfdi_id, c.estado FROM cfdi_ventas c
       JOIN ventas v ON c.venta_id = v.venta_id
       JOIN sucursales s ON v.sucursal_id = s.sucursal_id
       WHERE c.cfdi_id = :cfdiId AND s.empresa_id = :empresa_id`,
      { replacements: { cfdiId, empresa_id }, type: QueryTypes.SELECT }
    );
    if (!cfdi) return res.status(404).json({ error: "CFDI no encontrado" });

    if (cfdi.estado === "CANCELADO") {
      return res.status(400).json({ error: "El CFDI ya está cancelado" });
    }

    await CfdiVenta.update({ estado: "CANCELADO" }, { where: { cfdi_id: cfdiId } });

    res.json({ mensaje: "CFDI cancelado" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

export const enviarCorreoCfdi = async (req, res) => {
  try {
    const { cfdiId } = req.params;
    const { email } = req.body;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Email inválido" });
    }

    const empresa_id = req.usuario.empresa_id;
    const [cfdi] = await sequelize.query(
      `SELECT c.*, v.folio AS folio_venta, v.fecha AS fecha_venta, v.total AS total_venta
       FROM cfdi_ventas c
       JOIN ventas v ON c.venta_id = v.venta_id
       JOIN sucursales s ON v.sucursal_id = s.sucursal_id
       WHERE c.cfdi_id = :cfdiId AND s.empresa_id = :empresa_id`,
      { replacements: { cfdiId, empresa_id }, type: QueryTypes.SELECT }
    );

    if (!cfdi) return res.status(404).json({ error: "CFDI no encontrado" });
    if (cfdi.estado !== "TIMBRADO") {
      return res.status(400).json({ error: "Solo se pueden enviar CFDIs timbrados" });
    }

    const [dbConfig] = await sequelize.query(
      "SELECT email_host, email_port, email_user, email_pass, email_from, logo_b64, nombre_negocio FROM configuracion_fiscal WHERE empresa_id = :empresa_id",
      { replacements: { empresa_id }, type: QueryTypes.SELECT }
    );
    const transporterConfig = dbConfig?.email_host && dbConfig?.email_pass ? {
      host:   dbConfig.email_host,
      port:   dbConfig.email_port || 587,
      secure: false,
      auth:   { user: dbConfig.email_user, pass: dbConfig.email_pass },
      from:   dbConfig.email_from
    } : null;

    await enviarFacturaPorCorreo({
      destinatario:   email,
      cfdi,
      transporterConfig,
      logo_b64:       dbConfig?.logo_b64       || null,
      nombre_negocio: dbConfig?.nombre_negocio || null,
    });
    res.json({ mensaje: `Factura enviada a ${email}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo enviar el correo. Verifica la configuración SMTP en .env" });
  }
};

export const getXmlCfdi = async (req, res) => {
  try {
    const { cfdiId } = req.params;

    const empresa_id = req.usuario.empresa_id;
    const [row] = await sequelize.query(
      `SELECT c.xml_cfdi, v.folio
       FROM cfdi_ventas c
       JOIN ventas v ON c.venta_id = v.venta_id
       JOIN sucursales s ON v.sucursal_id = s.sucursal_id
       WHERE c.cfdi_id = :cfdiId AND s.empresa_id = :empresa_id`,
      { replacements: { cfdiId, empresa_id }, type: QueryTypes.SELECT }
    );

    if (!row) return res.status(404).json({ error: "CFDI no encontrado" });

    res.json({ xml: row.xml_cfdi, folio: row.folio });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

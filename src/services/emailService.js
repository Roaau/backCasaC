import nodemailer from "nodemailer";

const crearTransporter = () => nodemailer.createTransport({
  host:   process.env.EMAIL_HOST || 'smtp.gmail.com',
  port:   Number(process.env.EMAIL_PORT) || 465,
  secure: true,
  auth:   { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

const FROM = () => process.env.EMAIL_FROM || `SC POS <${process.env.EMAIL_USER}>`;

// ── Código de verificación de registro ───────────────────────────────────────
export const enviarCodigoRegistro = async ({ destinatario, codigo }) => {
  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:'Helvetica Neue',Arial,sans-serif;">
<div style="padding:40px 16px;">
  <div style="max-width:480px;margin:0 auto;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">
    <div style="background:#1e2227;padding:32px 40px;text-align:center;">
      <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">SC POS · Sistema de Punto de Venta</h1>
      <p style="margin:6px 0 0;color:#9aa0a6;font-size:13px;">Verificación de correo electrónico</p>
    </div>
    <div style="background:#ffffff;padding:40px;">
      <p style="margin:0 0 8px;font-size:15px;color:#333;">Hola,</p>
      <p style="margin:0 0 28px;font-size:14px;color:#555;line-height:1.6;">
        Recibimos una solicitud para registrar una nueva empresa en SC POS.<br>
        Usa el siguiente código para completar tu registro:
      </p>
      <div style="background:#f8fffe;border:2px solid #4cd96f;border-radius:12px;padding:24px;text-align:center;margin-bottom:28px;">
        <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:2px;">Código de verificación</p>
        <p style="margin:0;font-family:'Courier New',monospace;font-size:42px;font-weight:800;color:#1e2227;letter-spacing:10px;">${codigo}</p>
      </div>
      <div style="background:#fffbeb;border-left:4px solid #f59e0b;border-radius:0 8px 8px 0;padding:12px 16px;margin-bottom:20px;">
        <p style="margin:0;font-size:13px;color:#78350f;">⏱ Este código expira en <strong>15 minutos</strong> y es de un solo uso.</p>
      </div>
      <p style="margin:0;font-size:13px;color:#aaa;">Si no solicitaste este código, ignora este correo.</p>
    </div>
    <div style="background:#f8f9fa;border-top:1px solid #e8e8e8;padding:18px 40px;text-align:center;">
      <p style="margin:0;font-size:12px;color:#aaa;">SC POS · Sistema de Punto de Venta</p>
    </div>
  </div>
</div>
</body></html>`;

  await crearTransporter().sendMail({
    from: FROM(), to: destinatario,
    subject: 'Tu código de verificación — SC POS', html,
  });
};

// ── Código de restablecimiento de contraseña ─────────────────────────────────
export const enviarCodigoReset = async ({ destinatario, codigo, nombreUsuario }) => {
  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:'Helvetica Neue',Arial,sans-serif;">
<div style="padding:40px 16px;">
  <div style="max-width:480px;margin:0 auto;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">
    <div style="background:#1e2227;padding:32px 40px;text-align:center;">
      <h1 style="margin:0;color:#fff;font-size:20px;">SC POS · Sistema de Punto de Venta</h1>
      <p style="margin:6px 0 0;color:#9aa0a6;font-size:13px;">Restablecimiento de contraseña</p>
    </div>
    <div style="background:#fff;padding:40px;">
      <p style="margin:0 0 8px;font-size:15px;color:#333;">Hola, <strong>${nombreUsuario}</strong></p>
      <p style="margin:0 0 28px;font-size:14px;color:#555;line-height:1.6;">
        Recibimos una solicitud para restablecer tu contraseña. Usa el siguiente código:
      </p>
      <div style="background:#fff8f0;border:2px solid #f59e0b;border-radius:12px;padding:24px;text-align:center;margin-bottom:28px;">
        <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:2px;">Código de verificación</p>
        <p style="margin:0;font-family:'Courier New',monospace;font-size:42px;font-weight:800;color:#1e2227;letter-spacing:10px;">${codigo}</p>
      </div>
      <div style="background:#fffbeb;border-left:4px solid #f59e0b;border-radius:0 8px 8px 0;padding:12px 16px;margin-bottom:20px;">
        <p style="margin:0;font-size:13px;color:#78350f;">⏱ Este código expira en <strong>15 minutos</strong>.</p>
      </div>
      <p style="margin:0;font-size:13px;color:#aaa;">Si no solicitaste esto, ignora este correo.</p>
    </div>
    <div style="background:#f8f9fa;border-top:1px solid #e8e8e8;padding:18px 40px;text-align:center;">
      <p style="margin:0;font-size:12px;color:#aaa;">SC POS · Sistema de Punto de Venta</p>
    </div>
  </div>
</div>
</body></html>`;

  await crearTransporter().sendMail({
    from: FROM(), to: destinatario,
    subject: 'Restablece tu contraseña — SC POS', html,
  });
};

// ── Notificación al superadmin: nueva empresa pendiente ───────────────────────
export const notificarNuevaEmpresa = async ({ razon_social, rfc, email_admin, empresa_id }) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return;
  const destino = process.env.SUPERADMIN_EMAIL || process.env.EMAIL_USER;
  await crearTransporter().sendMail({
    from: FROM(), to: destino,
    subject: `[SC POS] Nueva empresa pendiente: ${razon_social}`,
    html: `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:'Helvetica Neue',Arial,sans-serif;">
<div style="padding:40px 16px;">
  <div style="max-width:480px;margin:0 auto;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">
    <div style="background:#1e2227;padding:32px 40px;text-align:center;">
      <h1 style="margin:0;color:#fff;font-size:20px;">SC POS · Panel de Control</h1>
      <p style="margin:6px 0 0;color:#9aa0a6;font-size:13px;">Nueva solicitud de registro</p>
    </div>
    <div style="background:#fff;padding:40px;">
      <p style="margin:0 0 20px;font-size:15px;color:#333;">Nueva empresa pendiente de aprobación:</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:28px;">
        <tr><td style="padding:9px 0;font-size:14px;color:#888;border-bottom:1px solid #f5f5f5;">Empresa</td>
            <td style="padding:9px 0;font-size:14px;font-weight:700;color:#1a1a1a;text-align:right;border-bottom:1px solid #f5f5f5;">${razon_social}</td></tr>
        <tr><td style="padding:9px 0;font-size:14px;color:#888;border-bottom:1px solid #f5f5f5;">RFC</td>
            <td style="padding:9px 0;font-size:14px;font-weight:700;color:#1a1a1a;text-align:right;font-family:monospace;border-bottom:1px solid #f5f5f5;">${rfc}</td></tr>
        <tr><td style="padding:9px 0;font-size:14px;color:#888;">Email admin</td>
            <td style="padding:9px 0;font-size:14px;font-weight:700;color:#1a1a1a;text-align:right;">${email_admin}</td></tr>
      </table>
      <div style="background:#fffbeb;border-left:4px solid #f59e0b;border-radius:0 8px 8px 0;padding:12px 16px;">
        <p style="margin:0;font-size:13px;color:#78350f;">Entra al panel de superadmin para aprobar o rechazar esta empresa (ID: ${empresa_id}).</p>
      </div>
    </div>
    <div style="background:#f8f9fa;border-top:1px solid #e8e8e8;padding:18px 40px;text-align:center;">
      <p style="margin:0;font-size:12px;color:#aaa;">SC POS · Panel de Administración</p>
    </div>
  </div>
</div>
</body></html>`,
  });
};

// ── Notificación al cliente: empresa aprobada ────────────────────────────────
export const notificarEmpresaAprobada = async ({ destinatario, razon_social }) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return;
  await crearTransporter().sendMail({
    from: FROM(), to: destinatario,
    subject: 'Tu empresa fue activada — SC POS',
    html: `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:'Helvetica Neue',Arial,sans-serif;">
<div style="padding:40px 16px;">
  <div style="max-width:480px;margin:0 auto;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">
    <div style="background:#1e2227;padding:32px 40px;text-align:center;">
      <h1 style="margin:0;color:#fff;font-size:20px;">SC POS · Sistema de Punto de Venta</h1>
      <p style="margin:6px 0 0;color:#9aa0a6;font-size:13px;">Cuenta activada</p>
    </div>
    <div style="background:#fff;padding:40px;">
      <div style="background:#f0fdf4;border:2px solid #86efac;border-radius:12px;padding:24px;text-align:center;margin-bottom:28px;">
        <p style="margin:0;font-size:36px;">✅</p>
        <p style="margin:8px 0 0;font-size:18px;font-weight:700;color:#166534;">¡Empresa activada!</p>
      </div>
      <p style="margin:0 0 16px;font-size:14px;color:#555;line-height:1.6;">
        Hola, tu empresa <strong>${razon_social}</strong> ha sido verificada y activada en SC POS.<br><br>
        Ya puedes iniciar sesión con tus credenciales y empezar a usar el sistema.
      </p>
    </div>
    <div style="background:#f8f9fa;border-top:1px solid #e8e8e8;padding:18px 40px;text-align:center;">
      <p style="margin:0;font-size:12px;color:#aaa;">SC POS · Sistema de Punto de Venta</p>
    </div>
  </div>
</div>
</body></html>`,
  });
};

// ── Notificación al cliente: empresa rechazada ───────────────────────────────
export const notificarEmpresaRechazada = async ({ destinatario, razon_social, motivo }) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return;
  const motivoHtml = motivo
    ? `<div style="background:#fef2f2;border-left:4px solid #f87171;border-radius:0 8px 8px 0;padding:12px 16px;margin-top:16px;">
         <p style="margin:0;font-size:13px;color:#991b1b;"><strong>Motivo:</strong> ${motivo}</p>
       </div>` : '';
  await crearTransporter().sendMail({
    from: FROM(), to: destinatario,
    subject: 'Tu solicitud en SC POS',
    html: `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:'Helvetica Neue',Arial,sans-serif;">
<div style="padding:40px 16px;">
  <div style="max-width:480px;margin:0 auto;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">
    <div style="background:#1e2227;padding:32px 40px;text-align:center;">
      <h1 style="margin:0;color:#fff;font-size:20px;">SC POS · Sistema de Punto de Venta</h1>
    </div>
    <div style="background:#fff;padding:40px;">
      <p style="margin:0 0 16px;font-size:14px;color:#555;line-height:1.6;">
        Tu solicitud para registrar <strong>${razon_social}</strong> no pudo ser procesada en este momento.
      </p>
      ${motivoHtml}
    </div>
    <div style="background:#f8f9fa;border-top:1px solid #e8e8e8;padding:18px 40px;text-align:center;">
      <p style="margin:0;font-size:12px;color:#aaa;">SC POS · Sistema de Punto de Venta</p>
    </div>
  </div>
</div>
</body></html>`,
  });
};

// ── Factura CFDI ──────────────────────────────────────────────────────────────
export const enviarFacturaPorCorreo = async ({
  destinatario, cfdi, transporterConfig = null, logo_b64 = null, nombre_negocio = null,
}) => {
  const smtpOpts = transporterConfig ?? {
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: Number(process.env.EMAIL_PORT) || 465,
    secure: true,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  };
  const from    = transporterConfig?.from ?? process.env.EMAIL_FROM;
  const negocio = nombre_negocio ?? "SC POS";
  const transporter = nodemailer.createTransport(smtpOpts);

  const attachments = [];
  let logoHtml = "";
  if (logo_b64) {
    const raw = logo_b64.includes(",") ? logo_b64.split(",")[1] : logo_b64;
    attachments.push({ filename: "logo.png", content: raw, encoding: "base64", cid: "negocio-logo" });
    logoHtml = `<img src="cid:negocio-logo" style="height:56px;width:auto;max-width:200px;object-fit:contain;display:block;margin:0 auto 14px;">`;
  }

  const fecha = new Date(cfdi.fecha_venta).toLocaleDateString("es-MX", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  const total = Number(cfdi.total_venta).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

  await transporter.sendMail({
    from, to: destinatario,
    subject: `Factura ${cfdi.folio_venta} — ${negocio}`,
    attachments,
    html: `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:'Helvetica Neue',Arial,sans-serif;">
<div style="padding:32px 16px;"><div style="max-width:600px;margin:0 auto;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">
  <div style="background:#1e2227;padding:32px 40px;text-align:center;">${logoHtml}
    <h1 style="margin:0;color:#fff;font-size:22px;">${negocio}</h1>
    <p style="margin:6px 0 0;color:#9aa0a6;font-size:13px;">Factura Electrónica · CFDI 4.0</p>
  </div>
  <div style="background:#fff;padding:36px 40px;">
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      <tr><td style="padding:9px 0;font-size:14px;color:#888;border-bottom:1px solid #f5f5f5;">Folio</td><td style="padding:9px 0;font-size:14px;font-weight:700;color:#1a1a1a;text-align:right;border-bottom:1px solid #f5f5f5;">${cfdi.folio_venta}</td></tr>
      <tr><td style="padding:9px 0;font-size:14px;color:#888;">Fecha</td><td style="padding:9px 0;font-size:14px;font-weight:600;color:#1a1a1a;text-align:right;">${fecha}</td></tr>
    </table>
    <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:18px 24px;margin-bottom:24px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="font-size:15px;color:#166534;font-weight:600;">Total</td><td style="font-size:28px;font-weight:800;color:#15803d;text-align:right;">${total}</td></tr>
      </table>
    </div>
    <div style="background:#f8f9fa;border:1px dashed #d0d0d0;border-radius:8px;padding:14px 18px;">
      <p style="margin:0 0 4px;font-size:11px;color:#aaa;text-transform:uppercase;">UUID</p>
      <p style="margin:0;font-family:'Courier New',monospace;font-size:13px;color:#333;word-break:break-all;">${cfdi.cfdi_uuid}</p>
    </div>
  </div>
  <div style="background:#f8f9fa;border-top:1px solid #e8e8e8;padding:22px 40px;text-align:center;">
    <p style="margin:0;font-size:12px;color:#aaa;">Emitido por ${negocio}</p>
  </div>
</div></div>
</body></html>`,
  });
};

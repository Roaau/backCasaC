import ConfiguracionFiscal from "../models/ConfiguracionFiscal.js";
import { obtenerEmpresaId, responderErrorScope } from "../utils/scope.js";

export const getConfiguracion = async (req, res) => {
  try {
    const empresa_id = obtenerEmpresaId(req.usuario);
    const [config] = await ConfiguracionFiscal.findOrCreate({
      where: { empresa_id },
      defaults: { empresa_id }
    });

    res.json({
      rfc_emisor:               config.rfc_emisor       || "",
      nombre_emisor:            config.nombre_emisor    || "",
      cp_emisor:                config.cp_emisor        || "",
      regimen_emisor:           config.regimen_emisor   || "",
      csd_cert_configurado:     !!config.csd_cert_b64,
      csd_key_configurado:      !!config.csd_key_b64,
      csd_password_configurado: !!config.csd_password,
      pac_nombre:               config.pac_nombre       || "",
      pac_url:                  config.pac_url          || "",
      pac_usuario:              config.pac_usuario      || "",
      pac_password_configurado: !!config.pac_password,
      email_host:               config.email_host       || "",
      email_port:               config.email_port       || 587,
      email_user:               config.email_user       || "",
      email_pass_configurado:   !!config.email_pass,
      email_from:               config.email_from       || "",
      logo_configurado:         !!config.logo_b64,
      nombre_negocio:           config.nombre_negocio   || "",
    });
  } catch (err) {
    console.error(err);
    responderErrorScope(res, err);
  }
};

export const guardarConfiguracion = async (req, res) => {
  try {
    const empresa_id = obtenerEmpresaId(req.usuario);
    const [config] = await ConfiguracionFiscal.findOrCreate({
      where: { empresa_id },
      defaults: { empresa_id }
    });

    const camposPlanos = [
      "rfc_emisor", "nombre_emisor", "cp_emisor", "regimen_emisor",
      "pac_nombre", "pac_url", "pac_usuario",
      "email_host", "email_port", "email_user", "email_from",
      "logo_b64", "nombre_negocio"
    ];
    const camposSensibles = ["csd_cert_b64", "csd_key_b64", "csd_password", "pac_password", "email_pass"];

    for (const campo of camposPlanos) {
      if (req.body[campo] !== undefined) config[campo] = req.body[campo];
    }
    for (const campo of camposSensibles) {
      if (req.body[campo]) config[campo] = req.body[campo]; // Solo actualiza si viene con valor
    }

    config.actualizado_en = new Date();
    await config.save();

    res.json({ mensaje: "Configuración guardada correctamente" });
  } catch (err) {
    console.error(err);
    responderErrorScope(res, err);
  }
};

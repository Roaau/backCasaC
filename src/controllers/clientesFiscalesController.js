import ClienteFiscal from "../models/ClienteFiscal.js";
import { obtenerEmpresaId, responderErrorScope } from "../utils/scope.js";

export const buscarClienteFiscal = async (req, res) => {
  try {
    const empresa_id = obtenerEmpresaId(req.usuario);
    const { rfc } = req.query;
    if (!rfc) return res.status(400).json({ error: "El parametro rfc es requerido" });

    const cliente = await ClienteFiscal.findOne({
      where: { empresa_id, rfc: rfc.toUpperCase(), activo: true }
    });
    if (!cliente) return res.status(404).json(null);

    res.json(cliente);
  } catch (err) {
    responderErrorScope(res, err);
  }
};

export const crearClienteFiscal = async (req, res) => {
  try {
    const empresa_id = obtenerEmpresaId(req.usuario);
    const { rfc, nombre_fiscal, cp_fiscal, regimen_fiscal, uso_cfdi_default, email } = req.body;

    if (!rfc || !nombre_fiscal || !cp_fiscal || !regimen_fiscal) {
      return res.status(400).json({ error: "rfc, nombre_fiscal, cp_fiscal y regimen_fiscal son requeridos" });
    }

    const cliente = await ClienteFiscal.create({
      empresa_id,
      rfc: rfc.toUpperCase(),
      nombre_fiscal,
      cp_fiscal,
      regimen_fiscal,
      uso_cfdi_default: uso_cfdi_default || "G03",
      email: email || null
    });

    res.status(201).json(cliente);
  } catch (err) {
    if (err.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ error: `Ya existe un cliente con RFC ${req.body.rfc} en tu empresa` });
    }
    responderErrorScope(res, err);
  }
};

export const actualizarClienteFiscal = async (req, res) => {
  try {
    const { id } = req.params;
    const empresa_id = obtenerEmpresaId(req.usuario);
    const cliente = await ClienteFiscal.findOne({ where: { cliente_id: id, empresa_id } });
    if (!cliente) return res.status(404).json({ error: "Cliente fiscal no encontrado" });

    const campos = ["nombre_fiscal", "cp_fiscal", "regimen_fiscal", "uso_cfdi_default", "email", "activo"];
    for (const campo of campos) {
      if (req.body[campo] !== undefined) cliente[campo] = req.body[campo];
    }
    if (req.body.rfc !== undefined) cliente.rfc = req.body.rfc.toUpperCase();

    await cliente.save();
    res.json(cliente);
  } catch (err) {
    responderErrorScope(res, err);
  }
};

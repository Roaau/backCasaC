import ClienteFiscal from "../models/ClienteFiscal.js";

export const buscarClienteFiscal = async (req, res) => {
  try {
    const { rfc } = req.query;
    if (!rfc) return res.status(400).json({ error: "El parámetro rfc es requerido" });

    const cliente = await ClienteFiscal.findOne({ where: { rfc: rfc.toUpperCase() } });
    if (!cliente) return res.status(404).json(null);

    res.json(cliente);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const crearClienteFiscal = async (req, res) => {
  try {
    const { rfc, nombre_fiscal, cp_fiscal, regimen_fiscal, uso_cfdi_default, email } = req.body;

    if (!rfc || !nombre_fiscal || !cp_fiscal || !regimen_fiscal) {
      return res.status(400).json({ error: "rfc, nombre_fiscal, cp_fiscal y regimen_fiscal son requeridos" });
    }

    const cliente = await ClienteFiscal.create({
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
      return res.status(409).json({ error: `Ya existe un cliente con RFC ${req.body.rfc}` });
    }
    res.status(500).json({ error: err.message });
  }
};

export const actualizarClienteFiscal = async (req, res) => {
  try {
    const { id } = req.params;
    const cliente = await ClienteFiscal.findByPk(id);
    if (!cliente) return res.status(404).json({ error: "Cliente fiscal no encontrado" });

    const campos = ["nombre_fiscal", "cp_fiscal", "regimen_fiscal", "uso_cfdi_default", "email", "activo"];
    for (const campo of campos) {
      if (req.body[campo] !== undefined) cliente[campo] = req.body[campo];
    }
    if (req.body.rfc !== undefined) cliente.rfc = req.body.rfc.toUpperCase();

    await cliente.save();
    res.json(cliente);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

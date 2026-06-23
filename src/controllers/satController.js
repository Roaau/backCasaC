import sequelize from "../config/database.js";
import { QueryTypes, Op } from "sequelize";
import CatSatFormaPago from "../models/CatSatFormaPago.js";
import CatSatUsoCfdi from "../models/CatSatUsoCfdi.js";
import CatSatRegimenFiscal from "../models/CatSatRegimenFiscal.js";
import CatSatUnidad from "../models/CatSatUnidad.js";
import CatSatProductoServicio from "../models/CatSatProductoServicio.js";
import CatSatColonia from "../models/CatSatColonia.js";

export const getFormasPago = async (req, res) => {
  try {
    const rows = await CatSatFormaPago.findAll({ order: [["clave", "ASC"]] });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getUsosCfdi = async (req, res) => {
  try {
    const rows = await CatSatUsoCfdi.findAll({ order: [["clave", "ASC"]] });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getRegimenesFiscales = async (req, res) => {
  try {
    const rows = await CatSatRegimenFiscal.findAll({ order: [["clave", "ASC"]] });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getUnidades = async (req, res) => {
  try {
    const rows = await CatSatUnidad.findAll({
      attributes: ["clave", "nombre"],
      order: [["nombre", "ASC"]]
    });
    res.json(rows.map(r => ({ clave: r.clave, descripcion: r.nombre })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getProductosServicios = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) {
      return res.json([]);
    }

    const rows = await sequelize.query(
      `SELECT clave, descripcion
       FROM cat_sat_producto_servicio
       WHERE descripcion ILIKE :q
       ORDER BY descripcion
       LIMIT 15`,
      { replacements: { q: `%${q.trim()}%` }, type: QueryTypes.SELECT }
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getColonias = async (req, res) => {
  try {
    const { cp } = req.query;
    if (!cp) return res.status(400).json({ error: "El parámetro cp es requerido" });

    const rows = await CatSatColonia.findAll({
      where: { cp },
      attributes: ["colonia", "tipo_asentamiento"],
      order: [["colonia", "ASC"]]
    });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

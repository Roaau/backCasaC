import { Router } from "express";
import { catalogoPublico, cotizar } from "../utils/planes.js";

// Publico (sin sesion): lo usan el registro y la pagina de inicio
const router = Router();

router.get("/", (req, res) => res.json(catalogoPublico()));

// GET /api/planes/cotizar?plan=basico&giro=abarrotes&periodo=anual&sucursales=3&usuarios_extra=1
// (usuarios_extra lo usa el superadmin para no perder los que ya paga una empresa)
router.get("/cotizar", (req, res) => {
  const q = req.query;
  res.json(cotizar({
    plan: q.plan,
    giro: q.giro,
    sucursales: q.sucursales,
    usuarios_extra: q.usuarios_extra,
    periodo: q.periodo
  }));
});

export default router;

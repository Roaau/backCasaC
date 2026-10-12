import { Router } from "express";
import { catalogoPublico, cotizar } from "../utils/planes.js";

// Publico (sin sesion): lo usan el registro y la pagina de inicio
const router = Router();

router.get("/", (req, res) => res.json(catalogoPublico()));

// GET /api/planes/cotizar?plan=basico&giro=abarrotes&periodo=anual&usuarios_extra=1&segunda_sucursal=true&sucursales=3
router.get("/cotizar", (req, res) => {
  const q = req.query;
  res.json(cotizar({
    plan: q.plan,
    giro: q.giro,
    sucursales: q.sucursales,
    usuarios_extra: q.usuarios_extra,
    segunda_sucursal: q.segunda_sucursal === "true",
    periodo: q.periodo
  }));
});

export default router;

import { Router } from "express";
import {
  getFormasPago,
  getUsosCfdi,
  getRegimenesFiscales,
  getUnidades,
  getProductosServicios,
  getColonias
} from "../controllers/satController.js";

const router = Router();

router.get("/formas-pago",        getFormasPago);
router.get("/usos-cfdi",          getUsosCfdi);
router.get("/regimenes-fiscales", getRegimenesFiscales);
router.get("/unidades",           getUnidades);
router.get("/productos",          getProductosServicios);
router.get("/colonias",           getColonias);

export default router;

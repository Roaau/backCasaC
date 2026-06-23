import express from "express";
import { crearVenta, getVentaPorId } from "../controllers/ventasController.js";
import { validarCrearVenta } from "../validators/ventas.js";
import { validate } from "../middleware/validate.js";

const router = express.Router();

router.post("/", validarCrearVenta, validate, crearVenta);
router.get("/:id", getVentaPorId);

export default router;

import express from "express";
import { listarCreditos, listarCreditosSaldados, registrarPago } from "../controllers/creditosController.js";

const router = express.Router();

router.get("/",            listarCreditos);
router.get("/saldados",    listarCreditosSaldados);
router.post("/:venta_id/pagos", registrarPago);

export default router;

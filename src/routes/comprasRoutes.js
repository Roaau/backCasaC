import express from "express";
import { listarCompras, crearCompra } from "../controllers/comprasController.js";

const router = express.Router();

router.get("/",  listarCompras);
router.post("/", crearCompra);

export default router;

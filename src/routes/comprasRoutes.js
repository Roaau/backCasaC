import express from "express";
import { listarCompras, crearCompra } from "../controllers/comprasController.js";
import { auditar } from "../middleware/auditar.js";

const router = express.Router();

router.get("/",  listarCompras);
router.post("/", auditar("COMPRA_CREAR", "compras", { detalle: (req) => ({ proveedor_id: req.body?.proveedor_id, total: req.body?.total, productos: (req.body?.detalles || []).length }) }), crearCompra);

export default router;

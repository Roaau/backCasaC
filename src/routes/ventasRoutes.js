import express from "express";
import { crearVenta, getVentaPorId, listarPedidos, actualizarEstadoPedido } from "../controllers/ventasController.js";
import { validarCrearVenta } from "../validators/ventas.js";
import { validate } from "../middleware/validate.js";

const router = express.Router();

router.post("/", validarCrearVenta, validate, crearVenta);
router.get("/pedidos", listarPedidos);
router.put("/:id/pedido-estado", actualizarEstadoPedido);
router.get("/:id", getVentaPorId);

export default router;

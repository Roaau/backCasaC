import express from "express";
import { crearVenta, getVentaPorId, listarPedidos, actualizarEstadoPedido, ventasDeHoy } from "../controllers/ventasController.js";
import { validarCrearVenta } from "../validators/ventas.js";
import { validate } from "../middleware/validate.js";
import { requierePin } from "../middleware/pinAutorizacion.js";

// Descuento grande: mas del 10 % requiere PIN si el dueno lo activo
export const DESCUENTO_MAX_SIN_PIN = 10;
const descuentoGrande = (req) => Number(req.body?.descuento_porcentaje || 0) > DESCUENTO_MAX_SIN_PIN;
const cancelaPedido = (req) => String(req.body?.estado || "").toUpperCase() === "CANCELADO";

const router = express.Router();

router.post("/", validarCrearVenta, validate, requierePin("Descuento mayor al 10 %", descuentoGrande), crearVenta);
router.get("/pedidos", listarPedidos);
router.get("/hoy", ventasDeHoy);
router.put("/:id/pedido-estado", requierePin("Cancelar pedido", cancelaPedido), actualizarEstadoPedido);
router.get("/:id", getVentaPorId);

export default router;

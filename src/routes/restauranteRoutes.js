import express from "express";
import {
  listarMesas, crearMesas, actualizarMesa,
  abrirComanda, verComanda, agregarItem, editarItem, quitarItem, enviarACocina, moverComanda, cerrarComanda, cancelarComanda,
  pantallaCocina, cambiarEstadoItem
} from "../controllers/restauranteController.js";
import { requierePin } from "../middleware/pinAutorizacion.js";
import { auditar } from "../middleware/auditar.js";
import { ComandaItem } from "../models/Restaurante.js";

const platilloYaEnCocina = async (req) => {
  const item = await ComandaItem.findOne({ where: { item_id: req.params.itemId, comanda_id: req.params.id }, attributes: ["estado"] });
  return !!item && item.estado !== "CAPTURADO";
};

const router = express.Router();

router.get("/mesas", listarMesas);
router.post("/mesas", auditar("MESAS_CREAR", "mesas"), crearMesas);
router.put("/mesas/:id", actualizarMesa);

router.post("/comandas", abrirComanda);
router.get("/comandas/:id", verComanda);
router.post("/comandas/:id/items", agregarItem);
router.put("/comandas/:id/items/:itemId", editarItem);
// Quitar un platillo que ya se cocinó pide PIN si el dueño lo activó (no aplica si aún no se mandó)
router.delete("/comandas/:id/items/:itemId", requierePin("Cancelar un platillo que ya está en cocina", platilloYaEnCocina), quitarItem);
router.post("/comandas/:id/enviar", enviarACocina);
router.put("/comandas/:id/mover", moverComanda);
router.post("/comandas/:id/cerrar", cerrarComanda);
router.post("/comandas/:id/cancelar", requierePin("Cancelar una cuenta sin cobrar"), cancelarComanda);

router.get("/cocina", pantallaCocina);
router.put("/cocina/:itemId", cambiarEstadoItem);

export default router;

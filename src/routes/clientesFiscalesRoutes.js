import { Router } from "express";
import {
  buscarClienteFiscal,
  crearClienteFiscal,
  actualizarClienteFiscal
} from "../controllers/clientesFiscalesController.js";

const router = Router();

router.get("/buscar",  buscarClienteFiscal);
router.post("/",       crearClienteFiscal);
router.put("/:id",     actualizarClienteFiscal);

export default router;

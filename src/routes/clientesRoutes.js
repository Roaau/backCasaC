import express from "express";
import { listarClientes, guardarCliente, actualizarCliente, eliminarCliente } from "../controllers/clientesController.js";

const router = express.Router();

router.get("/",       listarClientes);
router.post("/",      guardarCliente);
router.put("/:id",    actualizarCliente);
router.delete("/:id", eliminarCliente);

export default router;

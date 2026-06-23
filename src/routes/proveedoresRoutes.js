import express from "express";
import { listarProveedores, crearProveedor, actualizarProveedor, eliminarProveedor } from "../controllers/proveedoresController.js";

const router = express.Router();

router.get("/",       listarProveedores);
router.post("/",      crearProveedor);
router.put("/:id",    actualizarProveedor);
router.delete("/:id", eliminarProveedor);

export default router;

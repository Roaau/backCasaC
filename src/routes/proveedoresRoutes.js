import express from "express";
import { requierePin } from "../middleware/pinAutorizacion.js";
import { listarProveedores, crearProveedor, actualizarProveedor, eliminarProveedor } from "../controllers/proveedoresController.js";

const router = express.Router();

router.get("/",       listarProveedores);
router.post("/",      requierePin("Agregar proveedor"), crearProveedor);
router.put("/:id",    requierePin("Editar proveedor"), actualizarProveedor);
router.delete("/:id", requierePin("Eliminar proveedor"), eliminarProveedor);

export default router;

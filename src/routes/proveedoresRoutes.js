import express from "express";
import { requierePin } from "../middleware/pinAutorizacion.js";
import { auditar } from "../middleware/auditar.js";
import { listarProveedores, crearProveedor, actualizarProveedor, eliminarProveedor } from "../controllers/proveedoresController.js";

const router = express.Router();

router.get("/",       listarProveedores);
router.post("/",      requierePin("Agregar proveedor"), auditar("PROVEEDOR_CREAR", "proveedores"), crearProveedor);
router.put("/:id",    requierePin("Editar proveedor"), auditar("PROVEEDOR_EDITAR", "proveedores"), actualizarProveedor);
router.delete("/:id", requierePin("Eliminar proveedor"), auditar("PROVEEDOR_ELIMINAR", "proveedores", { detalle: () => ({}) }), eliminarProveedor);

export default router;

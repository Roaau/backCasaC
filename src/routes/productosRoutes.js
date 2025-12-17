import { Router } from "express";
import { 
    getAll, 
    createProducto, 
    updateProducto, 
    deleteProducto 
} from "../controllers/productosController.js";

const router = Router();

// Ruta para obtener todos
router.get("/", getAll);

// Ruta para crear uno nuevo
router.post("/", createProducto);

// Ruta para editar (necesita el ID)
router.put("/:id", updateProducto);

// Ruta para eliminar
router.delete("/productos/:id", deleteProducto);

export default router;

import { Router } from "express";
import {
    getAll,
    buscarProducto,
    createProducto,
    updateProducto,
    deleteProducto,
    importarProductos,
    stockBajoCount,
} from "../controllers/productosController.js";
import { validarCrearProducto, validarEditarProducto } from "../validators/productos.js";
import { validate } from "../middleware/validate.js";
import { verificarAdmin } from "../middleware/authMiddleware.js";

const router = Router();

router.get("/buscar/:texto",  buscarProducto);
router.get("/stock-bajo-count", stockBajoCount);
router.get("/",              getAll);
router.post("/", validarCrearProducto, validate, createProducto);
router.put("/:id", validarEditarProducto, validate, updateProducto);
router.delete("/:id", verificarAdmin, deleteProducto);
router.post("/importar", verificarAdmin, importarProductos);

export default router;

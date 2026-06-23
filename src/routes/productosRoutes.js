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

const router = Router();

router.get("/buscar/:texto",  buscarProducto);
router.get("/stock-bajo-count", stockBajoCount);
router.get("/",              getAll);
router.post("/", validarCrearProducto, validate, createProducto);
router.put("/:id", validarEditarProducto, validate, updateProducto);
router.delete("/:id", deleteProducto);
router.post("/importar", importarProductos);

export default router;

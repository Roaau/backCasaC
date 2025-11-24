import { Router } from "express";
import { getAll, deleteProducto } from "../controllers/productosController.js";

const router = Router();

router.get("/", getAll);
router.delete("/:id", deleteProducto);

export default router;

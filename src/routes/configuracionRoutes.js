import { Router } from "express";
import { getConfiguracion, guardarConfiguracion } from "../controllers/configuracionController.js";
import { verificarAdmin } from "../middleware/authMiddleware.js";

const router = Router();

router.get("/", verificarAdmin, getConfiguracion);
router.put("/", verificarAdmin, guardarConfiguracion);

export default router;

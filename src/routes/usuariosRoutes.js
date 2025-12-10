import { Router } from "express";
import { getUsuarios, createUsuario, updateUsuario, deleteUsuario } from "../controllers/usuariosController.js";

const router = Router();

router.get("/", getUsuarios);
router.post("/", createUsuario);
router.put("/:id", updateUsuario);
router.delete("/:id", deleteUsuario);

export default router;
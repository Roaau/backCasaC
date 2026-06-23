import { Router } from "express";
import { getUsuarios, createUsuario, updateUsuario, deleteUsuario } from "../controllers/usuariosController.js";
import { validarCrearUsuario, validarEditarUsuario } from "../validators/usuarios.js";
import { validate } from "../middleware/validate.js";
import { verificarAdmin } from "../middleware/authMiddleware.js";

const router = Router();

router.get("/", getUsuarios);
router.post("/", verificarAdmin, validarCrearUsuario, validate, createUsuario);
router.put("/:id", verificarAdmin, validarEditarUsuario, validate, updateUsuario);
router.delete("/:id", verificarAdmin, deleteUsuario);

export default router;

import { Router } from "express";
import { getUsuarios, createUsuario, updateUsuario, deleteUsuario } from "../controllers/usuariosController.js";
import { validarCrearUsuario, validarEditarUsuario } from "../validators/usuarios.js";
import { validate } from "../middleware/validate.js";
import { verificarAdmin, limpiarCacheSesion } from "../middleware/authMiddleware.js";

const router = Router();

// Cambios de estado de usuarios/empresas aplican de inmediato en la revision de sesion
router.use((req, res, next) => {
  if (req.method !== 'GET') res.on('finish', () => limpiarCacheSesion());
  next();
});

router.get("/", getUsuarios);
router.post("/", verificarAdmin, validarCrearUsuario, validate, createUsuario);
router.put("/:id", verificarAdmin, validarEditarUsuario, validate, updateUsuario);
router.delete("/:id", verificarAdmin, deleteUsuario);

export default router;

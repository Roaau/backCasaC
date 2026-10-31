import { Router } from "express";
import { getUsuarios, createUsuario, updateUsuario, deleteUsuario } from "../controllers/usuariosController.js";
import { validarCrearUsuario, validarEditarUsuario } from "../validators/usuarios.js";
import { validate } from "../middleware/validate.js";
import { verificarAdmin, limpiarCacheSesion } from "../middleware/authMiddleware.js";
import { auditar } from "../middleware/auditar.js";

const datosUsuario = (req) => ({ nombre: req.body?.nombre, usuario: req.body?.usuario, rol: req.body?.rol, sucursal_id: req.body?.sucursal_id, activo: req.body?.activo, cambio_contrasena: !!req.body?.contrasena });

const router = Router();

// Cambios de estado de usuarios/empresas aplican de inmediato en la revision de sesion
router.use((req, res, next) => {
  if (req.method !== 'GET') res.on('finish', () => limpiarCacheSesion());
  next();
});

router.get("/", getUsuarios);
router.post("/", verificarAdmin, validarCrearUsuario, validate, auditar("USUARIO_CREAR", "usuarios", { detalle: datosUsuario }), createUsuario);
router.put("/:id", verificarAdmin, validarEditarUsuario, validate, auditar("USUARIO_EDITAR", "usuarios", { detalle: datosUsuario }), updateUsuario);
router.delete("/:id", verificarAdmin, auditar("USUARIO_ELIMINAR", "usuarios", { detalle: () => ({}) }), deleteUsuario);

export default router;

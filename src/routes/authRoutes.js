import express from "express";
import { login, registro, actualizarPerfil, solicitarCodigoRegistro, solicitarResetContrasena, confirmarResetContrasena } from "../controllers/authController.js";
import { validarLogin } from "../validators/auth.js";
import { validate } from "../middleware/validate.js";
import { verificarToken } from "../middleware/authMiddleware.js";
import { getConfigNegocio } from "../controllers/empresasController.js";

const router = express.Router();

router.post("/login",              validarLogin, validate, login);
router.post("/registro",           registro);
router.post("/solicitar-registro", solicitarCodigoRegistro);
router.post("/solicitar-reset",    solicitarResetContrasena);
router.post("/confirmar-reset",    confirmarResetContrasena);
router.put("/perfil",              verificarToken, actualizarPerfil);
router.get("/negocio",             verificarToken, getConfigNegocio);

export default router;

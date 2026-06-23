import express from 'express';
import { registrarMovimiento, getHistorial } from '../controllers/inventarioController.js';
import { validarMovimiento } from '../validators/inventario.js';
import { validate } from '../middleware/validate.js';

const router = express.Router();

router.post('/movimiento', validarMovimiento, validate, registrarMovimiento);
router.get('/historial', getHistorial);

export default router;

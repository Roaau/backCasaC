import express from 'express';
import { registrarMovimiento, getHistorial, getLotes } from '../controllers/inventarioController.js';
import { validarMovimiento } from '../validators/inventario.js';
import { validate } from '../middleware/validate.js';
import { requierePin } from '../middleware/pinAutorizacion.js';
import { auditar } from '../middleware/auditar.js';

// Sacar mercancia (salida o perdida) requiere PIN si el dueno lo activo
const esSalida = (req) => ['SALIDA', 'PERDIDA'].includes(String(req.body?.tipo_movimiento || '').toUpperCase());

const router = express.Router();

router.post('/movimiento', validarMovimiento, validate, requierePin('Sacar mercancía del inventario', esSalida), auditar('INVENTARIO_MOVIMIENTO', 'inventario'), registrarMovimiento);
router.get('/historial', getHistorial);
router.get('/lotes/:producto_id', getLotes);

export default router;

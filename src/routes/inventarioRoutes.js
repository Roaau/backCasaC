import express from 'express';
import { registrarMovimiento } from '../controllers/inventarioController.js';

const router = express.Router();

// Ruta: POST /api/inventario/movimiento
router.post('/movimiento', registrarMovimiento);

export default router;
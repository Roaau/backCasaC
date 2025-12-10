// src/routes/cajaRoutes.js
import express from 'express';
import { estadoCaja, abrirCaja, obtenerTotalesCaja, registrarMovimiento, cerrarCaja } from '../controllers/cajaController.js';

const router = express.Router();

router.get('/estado/:usuarioId', estadoCaja);        // GET estado por usuario (o solo para comprobar abierta hoy)
router.post('/abrir', abrirCaja);                    // POST abrir caja
router.get('/totales/:cajaId', obtenerTotalesCaja);  // GET totales para el front
router.post('/movimiento', registrarMovimiento);     // POST registrar ingreso/egreso
router.post('/cerrar', cerrarCaja);                  // POST cerrar caja

export default router;

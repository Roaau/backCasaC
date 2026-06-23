import express from 'express';
import { estadoCaja, abrirCaja, obtenerTotalesCaja, registrarMovimiento, cerrarCaja } from '../controllers/cajaController.js';

const router = express.Router();

router.get('/estado/:usuarioId', estadoCaja);        
router.post('/abrir', abrirCaja);                    
router.get('/totales/:cajaId', obtenerTotalesCaja);  
router.post('/movimiento', registrarMovimiento);     
router.post('/cerrar', cerrarCaja);                  

export default router;

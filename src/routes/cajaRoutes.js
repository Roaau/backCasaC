import express from 'express';
import { requierePin } from '../middleware/pinAutorizacion.js';
import { estadoCaja, abrirCaja, obtenerTotalesCaja, registrarMovimiento, cerrarCaja } from '../controllers/cajaController.js';

const router = express.Router();

router.get('/estado/:usuarioId', estadoCaja);        
router.post('/abrir', abrirCaja);                    
router.get('/totales/:cajaId', obtenerTotalesCaja);  
router.post('/movimiento', requierePin('Retirar efectivo de caja', (req) => String(req.body?.tipo_movimiento || '').toUpperCase() === 'EGRESO'), registrarMovimiento);     
router.post('/cerrar', cerrarCaja);                  

export default router;

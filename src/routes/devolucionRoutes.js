import { Router } from 'express';
import { requierePin } from '../middleware/pinAutorizacion.js';
import { buscarVenta, crear, listar, getHoy, listarVentasParaDevolucion } from '../controllers/devolucionController.js';

const router = Router();

router.get('/hoy', getHoy);
router.get('/ventas', listarVentasParaDevolucion);
router.get('/venta/:folio', buscarVenta);
router.get('/', listar);
router.post('/', requierePin('Devolución'), crear);

export default router;

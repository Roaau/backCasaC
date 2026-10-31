import { Router } from 'express';
import { requierePin } from '../middleware/pinAutorizacion.js';
import { auditar } from '../middleware/auditar.js';
import { buscarVenta, crear, listar, getHoy, listarVentasParaDevolucion } from '../controllers/devolucionController.js';

const router = Router();

router.get('/hoy', getHoy);
router.get('/ventas', listarVentasParaDevolucion);
router.get('/venta/:folio', buscarVenta);
router.get('/', listar);
router.post('/', requierePin('Devolución'), auditar('DEVOLUCION', 'devoluciones', { detalle: (req) => ({ folio_venta: req.body?.folio_venta, motivo: req.body?.motivo, productos: (req.body?.detalles || []).length }) }), crear);

export default router;

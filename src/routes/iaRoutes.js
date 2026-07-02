import { Router } from 'express';
import {
 getStatus,
 consultar,
 resumenDashboard,
 analizarReportes,
 sugerirReabasto,
 revisarCorte,
 priorizarPedidos,
 analizarActividad,
 resumenNotificacionesIA
} from '../controllers/iaController.js';

const router = Router();

router.get('/status', getStatus);
router.post('/consultar', consultar);
router.post('/resumen-dashboard', resumenDashboard);
router.post('/analizar-reportes', analizarReportes);
router.post('/sugerir-reabasto', sugerirReabasto);
router.post('/revisar-corte', revisarCorte);
router.post('/priorizar-pedidos', priorizarPedidos);
router.post('/analizar-actividad', analizarActividad);
router.post('/resumen-notificaciones', resumenNotificacionesIA);

export default router;

import { Router } from 'express';
import { listarNotificaciones, resumenNotificaciones, cambiarEstadoNotificacion } from '../controllers/notificacionesController.js';

const router = Router();

router.get('/', listarNotificaciones);
router.get('/resumen', resumenNotificaciones);
router.put('/:id/estado', cambiarEstadoNotificacion);

export default router;

import express from 'express';
import { listar, detalle, crear, actualizarEstado } from '../controllers/cotizacionesController.js';

const router = express.Router();

router.get('/',          listar);
router.get('/:id',       detalle);
router.post('/',         crear);
router.put('/:id/estado', actualizarEstado);

export default router;

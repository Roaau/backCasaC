import express from 'express';
import { getEmpresas, getMiPlan, updateEmpresa } from '../controllers/empresasController.js';
import { generarCodigoInvitacion, listarCodigos } from '../controllers/authController.js';
import { verificarAdmin } from '../middleware/authMiddleware.js';
import { getTuPlan, cotizarSolicitud, crearSolicitud } from '../controllers/planClienteController.js';

const router = express.Router();

router.get('/',           getEmpresas);
router.get('/mi-plan',    verificarAdmin, getMiPlan);
router.get('/mi-plan/detalle',      verificarAdmin, getTuPlan);
router.post('/mi-plan/cotizar',     verificarAdmin, cotizarSolicitud);
router.post('/mi-plan/solicitudes', verificarAdmin, crearSolicitud);
router.put('/:id',        verificarAdmin, updateEmpresa);
router.post('/codigos',   verificarAdmin, generarCodigoInvitacion);
router.get('/codigos',    verificarAdmin, listarCodigos);

export default router;

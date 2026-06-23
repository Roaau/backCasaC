import express from 'express';
import { getEmpresas, updateEmpresa } from '../controllers/empresasController.js';
import { generarCodigoInvitacion, listarCodigos } from '../controllers/authController.js';
import { verificarAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/',           getEmpresas);
router.put('/:id',        verificarAdmin, updateEmpresa);
router.post('/codigos',   verificarAdmin, generarCodigoInvitacion);
router.get('/codigos',    verificarAdmin, listarCodigos);

export default router;

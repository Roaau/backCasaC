import { Router } from 'express';
import { getStatus, consultar } from '../controllers/iaController.js';

const router = Router();

router.get('/status', getStatus);
router.post('/consultar', consultar);

export default router;

import express from 'express';
import { getSucursales, createSucursal, updateSucursal } from '../controllers/sucursalesController.js';

const router = express.Router();
router.get('/', getSucursales);
router.post('/', createSucursal);
router.put('/:id', updateSucursal);
export default router;

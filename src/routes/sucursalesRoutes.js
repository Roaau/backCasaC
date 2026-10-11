import express from 'express';
import { getSucursales, createSucursal, updateSucursal, eliminarSucursal } from '../controllers/sucursalesController.js';

const router = express.Router();
router.get('/', getSucursales);
router.post('/', createSucursal);
router.put('/:id', updateSucursal);
router.delete('/:id', eliminarSucursal);
export default router;

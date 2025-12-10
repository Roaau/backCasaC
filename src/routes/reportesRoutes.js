import express from 'express';
import { 
    getReporteVentas, 
    getReporteProductos, 
    getReporteCaja,
    getDatosGraficas,
    getReporteInventario // <--- Importamos la nueva función
} from '../controllers/reportesController.js';
const router = express.Router();

// Todas son POST para enviar rango de fechas en el body
router.post('/ventas', getReporteVentas);
router.post('/productos', getReporteProductos);
router.post('/caja', getReporteCaja);
router.post('/inventario', getReporteInventario); // <--- La ruta nueva
router.post('/graficas', getDatosGraficas);
export default router;
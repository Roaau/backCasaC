import express from 'express';
import {
    getReporteVentas,
    getReporteProductos,
    getReporteCaja,
    getReporteDiario,
    getDatosGraficas,
    getReporteInventario,
    exportarExcel
} from '../controllers/reportesController.js';
import { listarBitacora } from '../controllers/bitacoraController.js';
import { getReporteAjustes } from '../controllers/ajustesController.js';
const router = express.Router();

router.post('/ventas', getReporteVentas);
router.post('/productos', getReporteProductos);
router.post('/caja', getReporteCaja);
router.post('/diario', getReporteDiario);
router.post('/inventario', getReporteInventario); 
router.post('/graficas', getDatosGraficas);
router.post('/exportar-excel', exportarExcel);
router.get('/bitacora', listarBitacora);
router.post('/ajustes', getReporteAjustes);
export default router;

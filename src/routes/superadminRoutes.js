import { Router } from 'express';
import {
  listarEmpresas,
  detalleEmpresa,
  aprobarEmpresa,
  rechazarEmpresa,
  suspenderEmpresa,
  reactivarEmpresa,
  actualizarNotas,
  toggleSucursal,
  toggleUsuario,
  statsCatalogo,
  importarCatalogo,
  limpiarCatalogo,
} from '../controllers/superadminController.js';

const router = Router();

router.get('/empresas',              listarEmpresas);
router.get('/empresas/:id/detalle',  detalleEmpresa);
router.put('/empresas/:id/aprobar',  aprobarEmpresa);
router.put('/empresas/:id/rechazar', rechazarEmpresa);
router.put('/empresas/:id/suspender', suspenderEmpresa);
router.put('/empresas/:id/reactivar', reactivarEmpresa);
router.put('/empresas/:id/notas',    actualizarNotas);
router.put('/sucursales/:id/toggle', toggleSucursal);
router.put('/usuarios/:id/toggle',   toggleUsuario);

router.get('/catalogo/stats',     statsCatalogo);
router.post('/catalogo/importar', importarCatalogo);
router.delete('/catalogo/limpiar', limpiarCatalogo);

export default router;

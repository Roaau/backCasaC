import { Router } from 'express';
import {
  listarEmpresas,
  detalleEmpresa,
  aprobarEmpresa,
  rechazarEmpresa,
  suspenderEmpresa,
  reactivarEmpresa,
  actualizarNotas,
  actualizarComercial,
  registrarPago,
  toggleSucursal,
  toggleUsuario,
  listarCatalogos,
  subirCatalogo,
  eliminarCatalogo,
  listarAuditoriaSuperadmin,
} from '../controllers/superadminController.js';

const router = Router();

router.get('/empresas',              listarEmpresas);
router.get('/empresas/:id/detalle',  detalleEmpresa);
router.put('/empresas/:id/aprobar',  aprobarEmpresa);
router.put('/empresas/:id/rechazar', rechazarEmpresa);
router.put('/empresas/:id/suspender', suspenderEmpresa);
router.put('/empresas/:id/reactivar', reactivarEmpresa);
router.put('/empresas/:id/notas',    actualizarNotas);
router.put('/empresas/:id/comercial', actualizarComercial);
router.post('/empresas/:id/pago',    registrarPago);
router.put('/sucursales/:id/toggle', toggleSucursal);
router.put('/usuarios/:id/toggle',   toggleUsuario);
router.get('/auditoria',             listarAuditoriaSuperadmin);

router.get('/catalogos',        listarCatalogos);
router.post('/catalogos',       subirCatalogo);
router.delete('/catalogos/:id', eliminarCatalogo);

export default router;

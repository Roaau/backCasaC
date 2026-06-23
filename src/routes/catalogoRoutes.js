import express from 'express';
import {
  buscarCatalogo,
  listarCatalogo,
  categoriasCatalogo,
  adoptarProductos,
  adoptarTodo,
} from '../controllers/catalogoController.js';

const router = express.Router();

router.get('/buscar',        buscarCatalogo);
router.get('/categorias',    categoriasCatalogo);
router.get('/',              listarCatalogo);
router.post('/adoptar',      adoptarProductos);
router.post('/adoptar-todo', adoptarTodo);

export default router;

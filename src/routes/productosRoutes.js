import { Router } from "express";
import {
    getAll,
    buscarProducto,
    createProducto,
    updateProducto,
    deleteProducto,
    importarProductos,
    stockBajoCount,
    descargarPlantilla,
    stockPorSucursal,
} from "../controllers/productosController.js";
import { validarCrearProducto, validarEditarProducto } from "../validators/productos.js";
import { validate } from "../middleware/validate.js";
import { verificarAdmin } from "../middleware/authMiddleware.js";
import { requierePin } from "../middleware/pinAutorizacion.js";
import Producto from "../models/Producto.js";
import { auditar } from "../middleware/auditar.js";

const CAMPOS_BITACORA = ["nombre", "codigo_barras", "precio_menudeo", "precio_mayoreo", "precio_compra", "stock_actual", "stock_minimo", "activo"];
const elegir = (obj) => Object.fromEntries(CAMPOS_BITACORA.filter(c => obj?.[c] !== undefined).map(c => [c, obj[c]]));
const productoAntes = async (req) => {
  const p = await Producto.findOne({ where: { producto_id: req.params.id, empresa_id: req.usuario.empresa_id } });
  return p ? elegir(p.toJSON()) : null;
};

// Cambiar un precio requiere PIN si el dueno lo activo (solo si el precio cambia de verdad)
const CAMPOS_PRECIO = ["precio_menudeo", "precio_mayoreo", "precio_compra"];
const cambiaPrecio = async (req) => {
  const enviados = CAMPOS_PRECIO.filter(c => req.body?.[c] !== undefined && req.body?.[c] !== null && req.body?.[c] !== "");
  if (!enviados.length) return false;
  const actual = await Producto.findOne({ where: { producto_id: req.params.id, empresa_id: req.usuario.empresa_id } });
  if (!actual) return false;
  return enviados.some(c => Number(req.body[c]) !== Number(actual[c] ?? 0));
};

const router = Router();

router.get("/buscar/:texto",  buscarProducto);
router.get("/stock-bajo-count", stockBajoCount);
router.get("/plantilla", descargarPlantilla);
router.get("/:id/stock-sucursales", verificarAdmin, stockPorSucursal);
router.get("/",              getAll);
router.post("/", validarCrearProducto, validate, auditar("PRODUCTO_CREAR", "productos", { detalle: (req) => elegir(req.body) }), createProducto);
router.put("/:id", validarEditarProducto, validate, requierePin("Cambiar precio", cambiaPrecio), auditar("PRODUCTO_EDITAR", "productos", { antes: productoAntes, detalle: (req) => elegir(req.body) }), updateProducto);
router.delete("/:id", verificarAdmin, auditar("PRODUCTO_ELIMINAR", "productos", { antes: productoAntes, detalle: () => ({}) }), deleteProducto);
router.post("/importar", verificarAdmin, auditar("PRODUCTO_IMPORTAR", "productos", { detalle: () => ({}) }), importarProductos);

export default router;

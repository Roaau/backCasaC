import express from "express";
import { listarCompras, crearCompra, compraCambiaPrecio } from "../controllers/comprasController.js";
import { auditar } from "../middleware/auditar.js";
import { requierePin } from "../middleware/pinAutorizacion.js";

const router = express.Router();

router.get("/",  listarCompras);
// Si la compra cambia precios de venta, se pide el PIN del dueno igual que al editar un producto
router.post("/", requierePin("Cambiar precio", compraCambiaPrecio), auditar("COMPRA_CREAR", "compras", { detalle: (req) => ({
  proveedor_id: req.body?.proveedor_id,
  productos: (req.body?.items || []).length,
  precios_nuevos: (req.body?.items || [])
    .filter(i => i?.producto_id && i.precio_venta !== undefined && i.precio_venta !== null && i.precio_venta !== '')
    .map(i => ({ producto_id: i.producto_id, nombre: i.nombre_producto, precio_venta: Number(i.precio_venta) }))
}) }), crearCompra);

export default router;

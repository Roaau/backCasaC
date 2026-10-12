import StockSucursal from "../models/StockSucursalModel.js";
import Producto from "../models/Producto.js";
import MovimientoInventario from "../models/MovimientoInventario.js";

// Regresa mercancia al inventario de una sucursal (devoluciones, pedidos cancelados).
// Es el inverso exacto de una venta: suma en stock_sucursal y en el total del producto,
// y deja el movimiento de ENTRADA para el historial. Debe correr dentro de la transaccion de quien llama.
export async function regresarAInventario({
  producto_id, nombre_producto, codigo_barras = null, cantidad,
  sucursal_id, usuario_id, motivo, observaciones, transaction
}) {
  let stock = await StockSucursal.findOne({
    where: { producto_id, sucursal_id },
    transaction,
    lock: true
  });
  const anterior = stock ? Number(stock.stock_actual) || 0 : 0;
  if (stock) {
    await stock.increment("stock_actual", { by: cantidad, transaction });
  } else {
    stock = await StockSucursal.create({ producto_id, sucursal_id, stock_actual: cantidad, stock_minimo: 0 }, { transaction });
  }
  await Producto.increment("stock_actual", { by: cantidad, where: { producto_id }, transaction });
  await MovimientoInventario.create({
    producto_id,
    nombre_producto,
    codigo_barras,
    usuario_id,
    sucursal_id,
    tipo_movimiento: "ENTRADA",
    motivo,
    cantidad,
    stock_anterior: anterior,
    stock_nuevo: anterior + cantidad,
    observaciones,
    fecha: new Date()
  }, { transaction });
}

// Calculo de precios de venta del lado del servidor.
// Replica la regla de caja: precio de mayoreo si la cantidad alcanza minimo_mayoreo, si no menudeo.

const redondear = (n) => Math.round(n * 100) / 100;
// Margen para diferencias de redondeo entre navegador y servidor (varias lineas con centavos)
const TOLERANCIA = 0.1;

const errorVenta = (mensaje) => {
  const error = new Error(mensaje);
  error.status = 409;
  return error;
};

export const precioUnitarioServidor = (producto, cantidad) => {
  const menudeo = Number(producto.precio_menudeo) || 0;
  const mayoreo = Number(producto.precio_mayoreo) || 0;
  const minimo = Number(producto.minimo_mayoreo) || 0;
  if (minimo > 0 && mayoreo > 0 && cantidad >= minimo) return mayoreo;
  return menudeo;
};

// Valida el precio que mando caja contra el catalogo y devuelve el precio/subtotal reales.
export const validarLineaVenta = (producto, cantidad, precioEnviado) => {
  const precio = precioUnitarioServidor(producto, cantidad);
  if (Math.abs(precio - Number(precioEnviado)) > 0.009) {
    throw errorVenta(`El precio de ${producto.nombre} cambio ($${precio.toFixed(2)}). Actualiza el carrito e intenta de nuevo.`);
  }
  return { precio_unitario: precio, subtotal: redondear(precio * cantidad) };
};

// Total = subtotal + IVA (si el negocio lo cobra aparte) - descuento.
// Si el front no manda iva_porcentaje (version anterior) se acepta 0% o 16%.
export const calcularTotalVenta = ({ subtotal, ivaPorcentaje, descuentoPorcentaje, totalEnviado }) => {
  const desc = Math.min(Math.max(Number(descuentoPorcentaje) || 0, 0), 100);
  const candidatos = ivaPorcentaje === undefined || ivaPorcentaje === null || ivaPorcentaje === ''
    ? [0, 16]
    : [Number(ivaPorcentaje)];

  if (candidatos.some(p => !Number.isFinite(p) || p < 0 || p > 30)) {
    const error = new Error("iva_porcentaje invalido");
    error.status = 400;
    throw error;
  }

  for (const iva of candidatos) {
    const total = redondear(subtotal * (1 + iva / 100) * (1 - desc / 100));
    if (Math.abs(total - Number(totalEnviado)) <= TOLERANCIA) return total;
  }
  throw errorVenta("El total de la venta no coincide con los precios actuales. Actualiza el carrito e intenta de nuevo.");
};

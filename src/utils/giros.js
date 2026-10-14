// Giros de negocio soportados por el POS general.
// La configuracion visual (campos y categorias por giro) vive en el front: src/app/core/giros.ts.
export const GIROS = {
  general:       "Negocio general",
  abarrotes:     "Tienda de abarrotes / Miscelánea",
  minisuper:     "Minisúper",
  farmacia:      "Farmacia",
  ferreteria:    "Ferretería / Tlapalería",
  materiales:    "Materiales de construcción",
  ropa:          "Ropa / Boutique",
  gorras:        "Gorras y accesorios",
  zapateria:     "Zapatería",
  papeleria:     "Papelería / Librería",
  refaccionaria: "Refaccionaria / Autopartes",
  cosmeticos:    "Cosméticos / Perfumería",
  electronica:   "Celulares / Electrónica",
  mascotas:      "Mascotas / Veterinaria",
  dulceria:      "Dulcería / Botanas",
  panaderia:     "Panadería / Pastelería",
  carniceria:    "Carnicería / Pollería",
  fruteria:      "Frutería / Verdulería",
  vinos:         "Vinos y licores",
  naturista:     "Tienda naturista",
  regalos:       "Regalos / Juguetería / Novedades",
  joyeria:       "Joyería / Bisutería",
  optica:        "Óptica",
  forrajeria:    "Forrajería / Semillas",
};

export const UNIDADES_VENTA = ["pieza", "kg", "litro", "metro", "bulto"];
// Se venden completas: no aceptan decimales
const UNIDADES_ENTERAS = ["pieza", "bulto"];

export const normalizarGiro = (valor) => {
  const clave = String(valor || "").toLowerCase().trim();
  return Object.hasOwn(GIROS, clave) ? clave : "general";
};

export const nombreGiro = (clave) => GIROS[normalizarGiro(clave)];

// pieza y bulto se venden en enteros; kg, litro y metro permiten decimales (venta a granel)
export const permiteDecimales = (unidad) => UNIDADES_VENTA.includes(unidad) && !UNIDADES_ENTERAS.includes(unidad);

// Valida una cantidad segun la unidad del producto. Hasta 3 decimales (gramos / mililitros).
export const cantidadValida = (cantidad, unidad = "pieza") => {
  const n = Number(cantidad);
  if (!Number.isFinite(n) || n <= 0) return false;
  if (!permiteDecimales(unidad)) return Number.isInteger(n);
  return Math.abs(Math.round(n * 1000) - n * 1000) < 1e-6;
};

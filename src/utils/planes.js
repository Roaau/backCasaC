// Lista de precios de SC POS: UNICO lugar donde viven precios, limites e incluidos.
// El registro, la pagina publica y el superadmin la leen de aqui (GET /api/planes).
// Precios en MXN, sin IVA. Cambiar un precio aqui no afecta a empresas ya registradas:
// su precio queda guardado en empresas.precio_mensual.
import { GIROS, normalizarGiro } from "./giros.js";

// Plan de 1 sucursal: el precio depende del giro (que tan complejo es el negocio)
export const NIVELES = {
  esencial: {
    nombre: "Esencial", precio: 349, usuarios: 2, configuracion: 0, ia_diaria: 10, segunda_sucursal: true,
    giros: ["abarrotes", "dulceria", "fruteria", "panaderia", "forrajeria"],
  },
  comercio: {
    nombre: "Comercio", precio: 499, usuarios: 3, configuracion: 0, ia_diaria: 15, segunda_sucursal: true,
    giros: ["papeleria", "carniceria", "mascotas", "cosmeticos", "naturista", "regalos", "gorras", "vinos"],
  },
  especializado: {
    nombre: "Especializado", precio: 699, usuarios: 5, configuracion: 999, ia_diaria: 25, segunda_sucursal: false,
    giros: ["minisuper", "ropa", "zapateria", "joyeria", "optica", "electronica", "general"],
  },
  catalogo_grande: {
    nombre: "Catálogo grande", precio: 849, usuarios: 5, configuracion: 999, ia_diaria: 25, segunda_sucursal: false,
    giros: ["farmacia", "ferreteria", "materiales", "refaccionaria"],
  },
};

// Varias sucursales: igual para todos los giros
export const PLAN_PRO = { nombre: "Pro", precio: 1199, sucursales: 2, usuarios: 10, configuracion: 999, ia_diaria: 40 };
export const PLAN_MULTI = { nombre: "Multi", precio_sucursal: 549, min_sucursales: 3, usuarios_por_sucursal: 5, configuracion: 999, ia_diaria: 40 };

export const EXTRAS = {
  usuario: 99,            // por usuario adicional al mes
  max_usuarios_extra: 20,
  segunda_sucursal: 449,  // solo Esencial y Comercio
  usuarios_segunda_sucursal: 2,
};

export const MESES_GRATIS_ANUAL = 2;
export const DIAS_PRUEBA = 30;
export const DIAS_BONO_REFERIDO = 30;
export const PLANES = ["basico", "pro", "multisucursal"];

export const nivelDeGiro = (giro) => {
  const clave = normalizarGiro(giro);
  return Object.keys(NIVELES).find(n => NIVELES[n].giros.includes(clave)) || "especializado";
};

const entero = (valor, min, max) => {
  const n = Math.trunc(Number(valor));
  if (!Number.isFinite(n)) return min;
  return Math.min(Math.max(n, min), max);
};

/**
 * Calcula el plan a partir de lo que elige el cliente. El servidor SIEMPRE usa esto:
 * nunca toma precio ni limites del navegador.
 */
export function cotizar({ plan = "basico", giro, sucursales, usuarios_extra = 0, segunda_sucursal = false, periodo = "mensual" } = {}) {
  const planId = PLANES.includes(String(plan).toLowerCase()) ? String(plan).toLowerCase() : "basico";
  const nivelId = nivelDeGiro(giro);
  const nivel = NIVELES[nivelId];
  const extrasUsuarios = entero(usuarios_extra, 0, EXTRAS.max_usuarios_extra);

  let nombre, limiteSucursales, limiteUsuarios, precio, configuracion, iaDiaria;
  let conSegunda = false;
  if (planId === "pro") {
    ({ nombre, sucursales: limiteSucursales, usuarios: limiteUsuarios, precio, configuracion, ia_diaria: iaDiaria } = PLAN_PRO);
  } else if (planId === "multisucursal") {
    limiteSucursales = entero(sucursales, PLAN_MULTI.min_sucursales, 100);
    limiteUsuarios = limiteSucursales * PLAN_MULTI.usuarios_por_sucursal;
    precio = limiteSucursales * PLAN_MULTI.precio_sucursal;
    nombre = PLAN_MULTI.nombre;
    configuracion = PLAN_MULTI.configuracion;
    iaDiaria = PLAN_MULTI.ia_diaria;
  } else {
    conSegunda = segunda_sucursal === true && nivel.segunda_sucursal;
    nombre = nivel.nombre;
    limiteSucursales = conSegunda ? 2 : 1;
    limiteUsuarios = nivel.usuarios + (conSegunda ? EXTRAS.usuarios_segunda_sucursal : 0);
    precio = nivel.precio + (conSegunda ? EXTRAS.segunda_sucursal : 0);
    configuracion = nivel.configuracion;
    iaDiaria = nivel.ia_diaria;
  }

  limiteUsuarios += extrasUsuarios;
  precio += extrasUsuarios * EXTRAS.usuario;

  const anual = periodo === "anual";
  const mesesPagados = anual ? 12 - MESES_GRATIS_ANUAL : 1;
  return {
    plan: planId,
    nombre_plan: nombre,
    nivel: nivelId,
    nombre_nivel: nivel.nombre,
    giro: normalizarGiro(giro),
    limite_sucursales: limiteSucursales,
    limite_usuarios: limiteUsuarios,
    usuarios_extra: extrasUsuarios,
    segunda_sucursal: conSegunda,
    precio_mensual: precio,
    configuracion,
    periodo: anual ? "anual" : "mensual",
    meses_cubiertos: anual ? 12 : 1,
    total_periodo: precio * mesesPagados,
    ahorro: anual ? precio * MESES_GRATIS_ANUAL : 0,
    ia_limite_diario: iaDiaria,
    dias_prueba: DIAS_PRUEBA,
  };
}

// Catalogo publico para el registro y la pagina de inicio
export function catalogoPublico() {
  return {
    niveles: Object.entries(NIVELES).map(([clave, n]) => ({
      clave, nombre: n.nombre, precio: n.precio, usuarios: n.usuarios, configuracion: n.configuracion,
      segunda_sucursal: n.segunda_sucursal,
      giros: n.giros.map(g => ({ clave: g, nombre: GIROS[g] })),
    })),
    pro: PLAN_PRO,
    multi: PLAN_MULTI,
    extras: EXTRAS,
    meses_gratis_anual: MESES_GRATIS_ANUAL,
    dias_prueba: DIAS_PRUEBA,
    dias_bono_referido: DIAS_BONO_REFERIDO,
  };
}

// Fecha YYYY-MM-DD sumando dias o meses a partir de otra (o de hoy)
export function sumarAFecha(base, { dias = 0, meses = 0 } = {}) {
  const fecha = base ? new Date(`${String(base).slice(0, 10)}T12:00:00`) : new Date();
  if (meses) fecha.setMonth(fecha.getMonth() + meses);
  if (dias) fecha.setDate(fecha.getDate() + dias);
  const pad = (n) => String(n).padStart(2, "0");
  return `${fecha.getFullYear()}-${pad(fecha.getMonth() + 1)}-${pad(fecha.getDate())}`;
}

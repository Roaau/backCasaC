const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
const OFFSET_LOCAL = process.env.APP_TIMEZONE_OFFSET || "-06:00";

const validarFecha = (valor, nombre) => {
  if (!FECHA_RE.test(String(valor || ""))) {
    const error = new Error(`${nombre} debe tener formato YYYY-MM-DD`);
    error.status = 400;
    throw error;
  }
  return valor;
};

export const rangoFechasReporte = (fechaInicio, fechaFin = fechaInicio) => {
  const inicio = validarFecha(fechaInicio, "fechaInicio");
  const fin = validarFecha(fechaFin, "fechaFin");
  return {
    inicio: new Date(`${inicio}T00:00:00.000${OFFSET_LOCAL}`),
    fin: new Date(`${fin}T23:59:59.999${OFFSET_LOCAL}`)
  };
};

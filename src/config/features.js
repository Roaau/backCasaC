// Modulos opcionales que se activan por variable de entorno.
// CFDI queda apagado por defecto: el timbrado aun no esta integrado con un PAC real.
export const cfdiHabilitado = () => process.env.CFDI_HABILITADO === "true";

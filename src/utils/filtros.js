/**
 * Construye la cláusula WHERE y los params para aislar datos por empresa/sucursal.
 * ADMIN (rol=1): ve todas las sucursales de su empresa.
 * EMPLEADO (rol=2): solo ve su propia sucursal.
 *
 * @param {object} usuario  - req.usuario del JWT
 * @param {string} colSuc   - alias SQL de la columna sucursal_id en la query (ej: 'v.sucursal_id')
 * @param {string} aliasSuc - alias del JOIN con sucursales (ej: 's')
 */
export const filtroEmpresa = (usuario, colSuc = 'v.sucursal_id', aliasSuc = 's') => {
  const esAdmin = usuario.rol === 1;
  return {
    clausula: esAdmin
      ? `AND ${aliasSuc}.empresa_id = :empresa_id`
      : `AND ${colSuc} = :sucursal_id`,
    params: esAdmin
      ? { empresa_id: usuario.empresa_id }
      : { sucursal_id: usuario.sucursal_id }
  };
};

import { esAdminEmpresa, parseIdPositivo, quiereTodasSucursales } from "./scope.js";

/**
 * Construye la clausula WHERE y los params para aislar datos por empresa/sucursal.
 * ADMIN: ve una sucursal concreta o todas las de su empresa si manda todas_sucursales=true.
 * EMPLEADO: solo ve su propia sucursal, aunque mande otra por body/query.
 */
export const filtroEmpresa = (usuario, colSuc = "v.sucursal_id", aliasSuc = "s", fuente = {}) => {
  const empresaId = parseIdPositivo(usuario?.empresa_id);
  const sucursalUsuario = parseIdPositivo(usuario?.sucursal_id);
  if (!empresaId && !usuario?.es_superadmin) {
    return { clausula: "AND 1 = 0", params: {} };
  }

  const admin = esAdminEmpresa(usuario);
  const todas = quiereTodasSucursales(fuente?.todas_sucursales);
  const sucursalSolicitada = parseIdPositivo(fuente?.sucursal_id);

  if (admin && todas) {
    return {
      clausula: `AND ${aliasSuc}.empresa_id = :empresa_id`,
      params: { empresa_id: empresaId }
    };
  }

  const sucursalId = admin
    ? (sucursalSolicitada ?? sucursalUsuario)
    : sucursalUsuario;

  if (!sucursalId) return { clausula: "AND 1 = 0", params: {} };

  return {
    clausula: `AND ${colSuc} = :sucursal_id AND ${aliasSuc}.empresa_id = :empresa_id`,
    params: { sucursal_id: sucursalId, empresa_id: empresaId }
  };
};

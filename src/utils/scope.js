import { Op } from "sequelize";
import Sucursal from "../models/SucursalModel.js";

export const esAdminEmpresa = (usuario) =>
  usuario?.rol === 1 || usuario?.rol_id === 1 || usuario?.es_superadmin === true;

export const parseIdPositivo = (valor) => {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : null;
};

export const quiereTodasSucursales = (valor) =>
  valor === true || valor === "true" || valor === "1" || valor === 1;

export const obtenerEmpresaId = (usuario) => {
  const empresaId = parseIdPositivo(usuario?.empresa_id);
  if (!empresaId && !usuario?.es_superadmin) {
    const error = new Error("El token no incluye empresa_id valido");
    error.status = 401;
    throw error;
  }
  return empresaId;
};

export const validarSucursalEmpresa = async (usuario, sucursalId, options = {}) => {
  const empresaId = obtenerEmpresaId(usuario);
  const id = parseIdPositivo(sucursalId);
  if (!id) {
    const error = new Error(options.mensajeRequerida || "sucursal_id requerido");
    error.status = 400;
    throw error;
  }

  const sucursal = await Sucursal.findOne({
    where: { sucursal_id: id, empresa_id: empresaId, activa: true },
    attributes: ["sucursal_id", "empresa_id", "nombre", "cp_sat"]
  });
  if (!sucursal) {
    const error = new Error("La sucursal no pertenece a tu empresa o esta inactiva");
    error.status = 403;
    throw error;
  }

  if (!esAdminEmpresa(usuario) && parseIdPositivo(usuario?.sucursal_id) !== id) {
    const error = new Error("No tienes permiso para operar esta sucursal");
    error.status = 403;
    throw error;
  }

  return sucursal;
};

export const resolverSucursalOperativa = async (req, origen = {}) => {
  const solicitada = origen.sucursal_id ?? req.body?.sucursal_id ?? req.query?.sucursal_id;
  const sucursalId = parseIdPositivo(solicitada) ?? parseIdPositivo(req.usuario?.sucursal_id);
  const sucursal = await validarSucursalEmpresa(req.usuario, sucursalId);
  return sucursal.sucursal_id;
};

export const resolverScopeSucursales = async (req, options = {}) => {
  const empresaId = obtenerEmpresaId(req.usuario);
  const todas = quiereTodasSucursales(req.body?.todas_sucursales ?? req.query?.todas_sucursales);
  const solicitada = parseIdPositivo(req.body?.sucursal_id ?? req.query?.sucursal_id);
  const admin = esAdminEmpresa(req.usuario);

  if (todas) {
    if (!admin) {
      const error = new Error("Solo el administrador puede consultar todas sus sucursales");
      error.status = 403;
      throw error;
    }
    const sucursales = await Sucursal.findAll({
      where: { empresa_id: empresaId, activa: true },
      attributes: ["sucursal_id"]
    });
    return {
      empresa_id: empresaId,
      todas: true,
      sucursalIds: sucursales.map(s => s.sucursal_id),
      whereSucursal: { [Op.in]: sucursales.map(s => s.sucursal_id) }
    };
  }

  const fallback = options.permitirFallbackUsuario !== false ? req.usuario?.sucursal_id : null;
  const sucursal = await validarSucursalEmpresa(req.usuario, solicitada ?? fallback);
  return {
    empresa_id: empresaId,
    todas: false,
    sucursal_id: sucursal.sucursal_id,
    sucursalIds: [sucursal.sucursal_id],
    whereSucursal: sucursal.sucursal_id
  };
};

export const responderErrorScope = (res, error) =>
  res.status(error.status || 500).json({ error: error.message });

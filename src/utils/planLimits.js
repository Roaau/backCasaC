import Empresa from "../models/EmpresaModel.js";
import Sucursal from "../models/SucursalModel.js";
import Usuario from "../models/Usuario.js";

const normalizarLimite = (valor) => {
  const limite = Number(valor);
  return Number.isInteger(limite) && limite > 0 ? limite : null;
};

const errorLimite = (mensaje, detalle = {}) => {
  const error = new Error(mensaje);
  error.status = 403;
  error.detalle = detalle;
  return error;
};

export const validarLimiteSucursales = async (empresa_id, incremento = 1, options = {}) => {
  const empresa = await Empresa.findByPk(empresa_id, {
    attributes: ["empresa_id", "plan", "limite_sucursales"],
    transaction: options.transaction
  });
  const limite = normalizarLimite(empresa?.limite_sucursales);
  if (!limite) return;

  const actuales = await Sucursal.count({
    where: { empresa_id, activa: true },
    transaction: options.transaction
  });

  if (actuales + incremento > limite) {
    throw errorLimite("Tu plan llego al limite de sucursales activas.", {
      plan: empresa.plan,
      limite,
      actuales
    });
  }
};

export const validarLimiteUsuarios = async (empresa_id, incremento = 1, options = {}) => {
  const empresa = await Empresa.findByPk(empresa_id, {
    attributes: ["empresa_id", "plan", "limite_usuarios"],
    transaction: options.transaction
  });
  const limite = normalizarLimite(empresa?.limite_usuarios);
  if (!limite) return;

  const actuales = await Usuario.count({
    where: { empresa_id, es_superadmin: false, activo: true },
    transaction: options.transaction
  });

  if (actuales + incremento > limite) {
    throw errorLimite("Tu plan llego al limite de usuarios activos.", {
      plan: empresa.plan,
      limite,
      actuales
    });
  }
};

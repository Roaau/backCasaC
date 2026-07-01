import Sucursal from '../models/SucursalModel.js';
import StockSucursal from '../models/StockSucursalModel.js';
import Producto from '../models/Producto.js';
import sequelize from '../config/database.js';
import { esAdminEmpresa, obtenerEmpresaId, responderErrorScope } from '../utils/scope.js';

const exigirAdmin = (usuario) => {
  if (!esAdminEmpresa(usuario)) {
    const error = new Error('Solo el administrador puede administrar sucursales');
    error.status = 403;
    throw error;
  }
};

const payloadSucursal = (body) => ({
  nombre: body.nombre,
  direccion: body.direccion,
  cp_sat: body.cp_sat,
  latitud: body.latitud,
  longitud: body.longitud,
  logo_b64: body.logo_b64
});

export const getSucursales = async (req, res) => {
  try {
    const empresa_id = obtenerEmpresaId(req.usuario);
    const sucursales = await Sucursal.findAll({
      where: { empresa_id, activa: true },
      attributes: ['sucursal_id', 'nombre', 'direccion', 'cp_sat', 'latitud', 'longitud', 'logo_b64']
    });
    res.json(sucursales);
  } catch (e) {
    responderErrorScope(res, e);
  }
};

export const createSucursal = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    exigirAdmin(req.usuario);
    const empresa_id = obtenerEmpresaId(req.usuario);
    const sucursal = await Sucursal.create(
      { ...payloadSucursal(req.body), empresa_id },
      { transaction: t }
    );

    // Crear stock_sucursal para todos los productos de la empresa
    const productos = await Producto.findAll({ where: { empresa_id } });
    if (productos.length > 0) {
      await StockSucursal.bulkCreate(
        productos.map(p => ({ producto_id: p.producto_id, sucursal_id: sucursal.sucursal_id, stock_actual: 0, stock_minimo: 0 })),
        { transaction: t }
      );
    }

    await t.commit();
    res.status(201).json(sucursal);
  } catch (e) {
    await t.rollback();
    responderErrorScope(res, e);
  }
};

export const updateSucursal = async (req, res) => {
  try {
    exigirAdmin(req.usuario);
    const empresa_id = obtenerEmpresaId(req.usuario);
    await Sucursal.update(payloadSucursal(req.body), { where: { sucursal_id: req.params.id, empresa_id } });
    res.json({ mensaje: 'Sucursal actualizada' });
  } catch (e) {
    responderErrorScope(res, e);
  }
};

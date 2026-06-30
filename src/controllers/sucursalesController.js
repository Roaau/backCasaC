import Sucursal from '../models/SucursalModel.js';
import StockSucursal from '../models/StockSucursalModel.js';
import Producto from '../models/Producto.js';
import sequelize from '../config/database.js';
import { obtenerEmpresaId, responderErrorScope } from '../utils/scope.js';

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
    const empresa_id = obtenerEmpresaId(req.usuario);
    const sucursal = await Sucursal.create(
      { ...req.body, empresa_id },
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
    const empresa_id = req.usuario.empresa_id;
    await Sucursal.update(req.body, { where: { sucursal_id: req.params.id, empresa_id } });
    res.json({ mensaje: 'Sucursal actualizada' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

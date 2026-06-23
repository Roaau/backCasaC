import Empresa from "../models/EmpresaModel.js";
import Sucursal from "../models/SucursalModel.js";
import Usuario from "../models/Usuario.js";
import Venta from "../models/Venta.js";
import MovimientoInventario from "../models/MovimientoInventario.js";
import CatalogoMaestro from "../models/CatalogoMaestro.js";
import { notificarEmpresaAprobada, notificarEmpresaRechazada } from "../services/emailService.js";
import { Op } from "sequelize";
import sequelize from "../config/database.js";
import multer from "multer";
import XLSX from "xlsx";

const uploadCatalogo = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } }).single('archivo');

// GET /api/superadmin/empresas
export const listarEmpresas = async (req, res) => {
  try {
    const empresas = await Empresa.findAll({ order: [['empresa_id', 'DESC']] });

    const result = await Promise.all(empresas.map(async (emp) => {
      const [total_sucursales, total_usuarios] = await Promise.all([
        Sucursal.count({ where: { empresa_id: emp.empresa_id } }),
        Usuario.count({ where: { empresa_id: emp.empresa_id, es_superadmin: false } })
      ]);
      return { ...emp.toJSON(), total_sucursales, total_usuarios };
    }));

    res.json(result);
  } catch {
    res.status(500).json({ error: 'Error al listar empresas' });
  }
};

// GET /api/superadmin/empresas/:id/detalle
export const detalleEmpresa = async (req, res) => {
  const { id } = req.params;
  try {
    const empresa = await Empresa.findByPk(id);
    if (!empresa) return res.status(404).json({ error: 'Empresa no encontrada' });

    const sucursales = await Sucursal.findAll({
      where: { empresa_id: id },
      attributes: ['sucursal_id', 'nombre', 'direccion', 'cp_sat', 'activa'],
      order: [['sucursal_id', 'ASC']]
    });

    const usuarios = await Usuario.findAll({
      where: { empresa_id: id, es_superadmin: false },
      attributes: ['usuario_id', 'nombre', 'usuario', 'rol_id', 'sucursal_id', 'activo'],
      order: [['rol_id', 'ASC']]
    });

    const sucursalIds = sucursales.map(s => s.sucursal_id);
    const hace30dias  = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Ventas de los últimos 30 días
    const ventas = sucursalIds.length
      ? await Venta.findAll({
          where: { sucursal_id: { [Op.in]: sucursalIds }, fecha: { [Op.gte]: hace30dias } },
          attributes: ['venta_id', 'folio', 'fecha', 'total', 'tipo_pago', 'sucursal_id'],
          order: [['fecha', 'DESC']],
          limit: 15
        })
      : [];

    // Totales por sucursal (últimos 30 días)
    const totalesPorSucursal = sucursalIds.length
      ? await sequelize.query(`
          SELECT s.nombre AS nombre_sucursal,
                 COUNT(v.venta_id)::int AS conteo,
                 COALESCE(SUM(v.total), 0)::float AS total
          FROM sucursales s
          LEFT JOIN ventas v ON v.sucursal_id = s.sucursal_id
            AND v.fecha >= NOW() - INTERVAL '30 days'
          WHERE s.empresa_id = :empresa_id
          GROUP BY s.sucursal_id, s.nombre
          ORDER BY total DESC
        `, { replacements: { empresa_id: id }, type: sequelize.QueryTypes.SELECT })
      : [];

    // Movimientos recientes
    const movimientos = sucursalIds.length
      ? await MovimientoInventario.findAll({
          where: { sucursal_id: { [Op.in]: sucursalIds } },
          attributes: ['movimiento_id', 'nombre_producto', 'tipo_movimiento', 'cantidad', 'motivo', 'fecha', 'sucursal_id'],
          order: [['fecha', 'DESC']],
          limit: 10
        })
      : [];

    res.json({
      empresa:           empresa.toJSON(),
      sucursales:        sucursales.map(s => s.toJSON()),
      usuarios:          usuarios.map(u => u.toJSON()),
      ventas_recientes:  ventas.map(v => v.toJSON()),
      totales_sucursal:  totalesPorSucursal,
      movimientos:       movimientos.map(m => m.toJSON())
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener detalle', detalle: err.message });
  }
};

// PUT /api/superadmin/empresas/:id/aprobar
export const aprobarEmpresa = async (req, res) => {
  const { id } = req.params;
  const { notas } = req.body;
  try {
    const empresa = await Empresa.findByPk(id);
    if (!empresa) return res.status(404).json({ error: 'Empresa no encontrada' });

    await empresa.update({ estado: 'activa', notas_admin: notas || empresa.notas_admin });

    if (empresa.email_contacto) {
      notificarEmpresaAprobada({
        destinatario: empresa.email_contacto,
        razon_social: empresa.razon_social
      }).catch(() => {});
    }

    res.json({ mensaje: `${empresa.razon_social} aprobada correctamente` });
  } catch {
    res.status(500).json({ error: 'Error al aprobar empresa' });
  }
};

// PUT /api/superadmin/empresas/:id/rechazar
export const rechazarEmpresa = async (req, res) => {
  const { id } = req.params;
  const { notas } = req.body;
  try {
    const empresa = await Empresa.findByPk(id);
    if (!empresa) return res.status(404).json({ error: 'Empresa no encontrada' });

    await empresa.update({ estado: 'rechazada', notas_admin: notas || empresa.notas_admin });

    if (empresa.email_contacto) {
      notificarEmpresaRechazada({
        destinatario: empresa.email_contacto,
        razon_social: empresa.razon_social,
        motivo: notas || null
      }).catch(() => {});
    }

    res.json({ mensaje: `${empresa.razon_social} rechazada` });
  } catch {
    res.status(500).json({ error: 'Error al rechazar empresa' });
  }
};

// PUT /api/superadmin/empresas/:id/suspender
export const suspenderEmpresa = async (req, res) => {
  const { id } = req.params;
  const { notas } = req.body;
  try {
    const empresa = await Empresa.findByPk(id);
    if (!empresa) return res.status(404).json({ error: 'Empresa no encontrada' });

    await empresa.update({ estado: 'suspendida', notas_admin: notas || empresa.notas_admin });
    res.json({ mensaje: `${empresa.razon_social} suspendida` });
  } catch {
    res.status(500).json({ error: 'Error al suspender empresa' });
  }
};

// PUT /api/superadmin/empresas/:id/reactivar
export const reactivarEmpresa = async (req, res) => {
  const { id } = req.params;
  try {
    const empresa = await Empresa.findByPk(id);
    if (!empresa) return res.status(404).json({ error: 'Empresa no encontrada' });

    await empresa.update({ estado: 'activa' });

    if (empresa.email_contacto) {
      notificarEmpresaAprobada({
        destinatario: empresa.email_contacto,
        razon_social: empresa.razon_social
      }).catch(() => {});
    }

    res.json({ mensaje: `${empresa.razon_social} reactivada` });
  } catch {
    res.status(500).json({ error: 'Error al reactivar empresa' });
  }
};

// PUT /api/superadmin/sucursales/:id/toggle
export const toggleSucursal = async (req, res) => {
  const { id } = req.params;
  try {
    const sucursal = await Sucursal.findByPk(id);
    if (!sucursal) return res.status(404).json({ error: 'Sucursal no encontrada' });
    await sucursal.update({ activa: !sucursal.activa });
    res.json({ mensaje: `Sucursal ${sucursal.activa ? 'activada' : 'desactivada'}`, activa: sucursal.activa });
  } catch {
    res.status(500).json({ error: 'Error al actualizar sucursal' });
  }
};

// PUT /api/superadmin/usuarios/:id/toggle
export const toggleUsuario = async (req, res) => {
  const { id } = req.params;
  try {
    const usuario = await Usuario.findByPk(id);
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (usuario.es_superadmin) return res.status(403).json({ error: 'No se puede desactivar al superadmin' });
    await usuario.update({ activo: !usuario.activo });
    res.json({ mensaje: `Usuario ${usuario.activo ? 'activado' : 'desactivado'}`, activo: usuario.activo });
  } catch {
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
};

// PUT /api/superadmin/empresas/:id/notas
export const actualizarNotas = async (req, res) => {
  const { id } = req.params;
  const { notas } = req.body;
  try {
    const empresa = await Empresa.findByPk(id);
    if (!empresa) return res.status(404).json({ error: 'Empresa no encontrada' });
    await empresa.update({ notas_admin: notas });
    res.json({ mensaje: 'Notas actualizadas' });
  } catch {
    res.status(500).json({ error: 'Error al actualizar notas' });
  }
};

// GET /api/superadmin/catalogo/stats
export const statsCatalogo = async (req, res) => {
  try {
    const total = await CatalogoMaestro.count();
    const cats  = await CatalogoMaestro.count({ distinct: true, col: 'categoria_sugerida' });
    res.json({ total, categorias: cats });
  } catch {
    res.status(500).json({ error: 'Error al obtener stats del catálogo' });
  }
};

// POST /api/superadmin/catalogo/importar  (multipart: archivo .xlsx)
export const importarCatalogo = (req, res) => {
  uploadCatalogo(req, res, async (err) => {
    if (err) return res.status(400).json({ error: 'Error al recibir el archivo' });
    if (!req.file) return res.status(400).json({ error: 'No se envió ningún archivo' });

    try {
      const wb   = XLSX.read(req.file.buffer, { type: 'buffer' });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: null });

      const registros = rows
        .filter(row => row.nombre?.toString().trim())
        .map(row => ({
          codigo_barras:        row.codigo_barras?.toString().trim() || null,
          nombre:               row.nombre.toString().trim(),
          descripcion:          row.descripcion?.toString().trim()   || null,
          categoria_sugerida:   row.categoria?.toString().trim()     || 'Varios',
          precio_menudeo:       Number(row.precio_menudeo)   || 0,
          precio_mayoreo:       Number(row.precio_mayoreo)   || 0,
          precio_oferta:        Number(row.precio_oferta)    || 0,
          stock_minimo:         Number(row.stock_minimo)     || 0,
          minimo_mayoreo:       Number(row.minimo_mayoreo)   || null,
          clave_sat_sugerida:   row.clave_sat?.toString()    || '01010101',
          unidad_sat_sugerida:  row.clave_unidad_sat?.toString() || 'H87',
          objeto_imp:           row.objeto_imp?.toString()   || '02',
        }));

      // Reemplaza todo el catálogo de golpe
      await CatalogoMaestro.destroy({ where: {}, truncate: true });
      await CatalogoMaestro.bulkCreate(registros);

      res.json({ mensaje: 'Catálogo importado', total: registros.length });
    } catch (e) {
      res.status(500).json({ error: 'Error al procesar el Excel', detalle: e.message });
    }
  });
};

// DELETE /api/superadmin/catalogo/limpiar
export const limpiarCatalogo = async (req, res) => {
  try {
    await CatalogoMaestro.destroy({ where: {}, truncate: true });
    res.json({ mensaje: 'Catálogo limpiado' });
  } catch {
    res.status(500).json({ error: 'Error al limpiar catálogo' });
  }
};

import sequelize from '../config/database.js';
import { QueryTypes } from 'sequelize';
import Cotizacion from '../models/Cotizacion.js';
import DetalleCotizacion from '../models/DetalleCotizacion.js';

const generarFolio = async (empresaId) => {
    const count = await Cotizacion.count({ where: { empresa_id: empresaId } });
    return `COT-${String(count + 1).padStart(4, '0')}`;
};

export const listar = async (req, res) => {
    try {
        const { empresa_id, sucursal_id, es_admin } = req.usuario;
        const filtroSucursal = es_admin ? '' : 'AND c.sucursal_id = :sucursal_id';

        const cotizaciones = await sequelize.query(`
            SELECT c.*, u.nombre as nombre_usuario, s.nombre as nombre_sucursal
            FROM cotizaciones c
            LEFT JOIN usuarios u ON c.usuario_id = u.usuario_id
            LEFT JOIN sucursales s ON c.sucursal_id = s.sucursal_id
            WHERE c.empresa_id = :empresa_id ${filtroSucursal}
            ORDER BY c.fecha DESC
            LIMIT 100
        `, {
            replacements: { empresa_id, sucursal_id },
            type: QueryTypes.SELECT
        });

        res.json(cotizaciones);
    } catch (err) {
        res.status(500).json({ error: 'Error al listar cotizaciones' });
    }
};

export const detalle = async (req, res) => {
    try {
        const { empresa_id } = req.usuario;
        const { id } = req.params;

        const cotizacion = await Cotizacion.findOne({ where: { cotizacion_id: id, empresa_id } });
        if (!cotizacion) return res.status(404).json({ error: 'No encontrada' });

        const detalles = await DetalleCotizacion.findAll({ where: { cotizacion_id: id } });
        res.json({ ...cotizacion.toJSON(), detalles });
    } catch (err) {
        res.status(500).json({ error: 'Error al obtener cotización' });
    }
};

export const crear = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { empresa_id, sucursal_id, idUsuario } = req.usuario;
        const { cliente_nombre, cliente_telefono, cliente_email, vigencia_dias, notas, items } = req.body;

        if (!items || items.length === 0) {
            await t.rollback();
            return res.status(400).json({ error: 'La cotización debe tener al menos un producto' });
        }

        const folio = await generarFolio(empresa_id);
        const total = items.reduce((acc, i) => acc + parseFloat(i.subtotal), 0);

        const cotizacion = await Cotizacion.create({
            empresa_id, sucursal_id,
            usuario_id: idUsuario,
            folio, cliente_nombre, cliente_telefono, cliente_email,
            vigencia_dias: vigencia_dias || 7,
            notas, total
        }, { transaction: t });

        const detalles = items.map(i => ({
            cotizacion_id: cotizacion.cotizacion_id,
            producto_id: i.producto_id || null,
            nombre_producto: i.nombre_producto,
            cantidad: i.cantidad,
            precio_unitario: i.precio_unitario,
            descuento_pct: i.descuento_pct || 0,
            subtotal: i.subtotal
        }));

        await DetalleCotizacion.bulkCreate(detalles, { transaction: t });
        await t.commit();

        res.status(201).json({ cotizacion_id: cotizacion.cotizacion_id, folio });
    } catch (err) {
        await t.rollback();
        res.status(500).json({ error: 'Error al crear cotización: ' + err.message });
    }
};

export const actualizarEstado = async (req, res) => {
    try {
        const { empresa_id } = req.usuario;
        const { id } = req.params;
        const { estado } = req.body;

        const validos = ['BORRADOR', 'ENVIADA', 'ACEPTADA', 'VENCIDA'];
        if (!validos.includes(estado)) return res.status(400).json({ error: 'Estado no válido' });

        const [updated] = await Cotizacion.update(
            { estado },
            { where: { cotizacion_id: id, empresa_id } }
        );
        if (!updated) return res.status(404).json({ error: 'No encontrada' });

        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: 'Error al actualizar estado' });
    }
};

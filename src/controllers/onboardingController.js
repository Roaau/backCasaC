import sequelize from '../config/database.js';
import { QueryTypes } from 'sequelize';

export const getStatus = async (req, res) => {
    try {
        const { empresa_id } = req.usuario;

        const [empresa] = await sequelize.query(
            `SELECT logo_empresa FROM empresas WHERE empresa_id = :empresa_id`,
            { replacements: { empresa_id }, type: QueryTypes.SELECT }
        );

        const [{ total_productos }] = await sequelize.query(
            `SELECT COUNT(*) as total_productos FROM productos WHERE empresa_id = :empresa_id`,
            { replacements: { empresa_id }, type: QueryTypes.SELECT }
        );

        const [{ total_usuarios }] = await sequelize.query(
            `SELECT COUNT(*) as total_usuarios FROM usuarios WHERE empresa_id = :empresa_id`,
            { replacements: { empresa_id }, type: QueryTypes.SELECT }
        );

        const [{ total_ventas }] = await sequelize.query(
            `SELECT COUNT(*) as total_ventas FROM ventas v
             JOIN sucursales s ON v.sucursal_id = s.sucursal_id
             WHERE s.empresa_id = :empresa_id`,
            { replacements: { empresa_id }, type: QueryTypes.SELECT }
        );

        const pasos = [
            { id: 1, label: 'Empresa creada',                    completado: true },
            { id: 2, label: 'Logo del negocio configurado',       completado: !!empresa?.logo_empresa },
            { id: 3, label: 'Productos en inventario',            completado: parseInt(total_productos) > 0 },
            { id: 4, label: 'Usuario adicional creado',           completado: parseInt(total_usuarios) > 1 },
            { id: 5, label: 'Primera venta realizada',            completado: parseInt(total_ventas) > 0 }
        ];

        const completado = pasos.every(p => p.completado);
        const progreso = pasos.filter(p => p.completado).length;

        res.json({ pasos, completado, progreso, total: pasos.length });
    } catch (err) {
        res.status(500).json({ error: 'Error al obtener estado de onboarding' });
    }
};

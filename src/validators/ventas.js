import { body } from 'express-validator';

export const validarCrearVenta = [
  body('usuario_id').isInt({ min: 1 }).withMessage('usuario_id inválido'),
  body('total').isFloat({ min: 0 }).withMessage('El total debe ser un número no negativo'),
  body('tipo_venta').isIn(['Tienda', 'Pedido']).withMessage('tipo_venta debe ser Tienda o Pedido'),
  body('folio').trim().notEmpty().withMessage('El folio es requerido'),
  body('detalles').isArray({ min: 1 }).withMessage('La venta debe tener al menos un producto'),
  body('detalles.*.cantidad').isInt({ min: 1 }).withMessage('La cantidad de cada producto debe ser al menos 1'),
  body('detalles.*.precio_unitario').isFloat({ min: 0 }).withMessage('El precio unitario no puede ser negativo'),
];

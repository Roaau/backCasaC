import { body, param } from 'express-validator';

export const validarCrearProducto = [
  body('nombre').trim().notEmpty().withMessage('El nombre del producto es requerido')
    .isLength({ max: 255 }).withMessage('El nombre no puede superar 255 caracteres'),
  body('codigo_barras').trim().notEmpty().withMessage('El código de barras es requerido'),
  body('precio_menudeo').isFloat({ min: 0 }).withMessage('El precio público debe ser un número mayor o igual a 0'),
  body('precio_mayoreo').optional().isFloat({ min: 0 }).withMessage('El precio mayoreo debe ser mayor o igual a 0'),
  body('stock_actual').optional().isInt({ min: 0 }).withMessage('El stock actual debe ser entero no negativo'),
  body('stock_minimo').optional().isInt({ min: 0 }).withMessage('El stock mínimo debe ser entero no negativo'),
  body('minimo_mayoreo').optional({ nullable: true }).isInt({ min: 0 }).withMessage('El mínimo de mayoreo debe ser entero no negativo'),
];

export const validarEditarProducto = [
  param('id').isInt({ min: 1 }).withMessage('ID de producto inválido'),
  body('precio_menudeo').optional().isFloat({ min: 0 }).withMessage('El precio público debe ser mayor o igual a 0'),
  body('precio_mayoreo').optional().isFloat({ min: 0 }).withMessage('El precio mayoreo debe ser mayor o igual a 0'),
  body('stock_actual').optional().isInt({ min: 0 }).withMessage('El stock no puede ser negativo'),
  body('stock_minimo').optional().isInt({ min: 0 }).withMessage('El stock mínimo no puede ser negativo'),
  body('minimo_mayoreo').optional({ nullable: true }).isInt({ min: 0 }).withMessage('El mínimo de mayoreo debe ser entero no negativo'),
];

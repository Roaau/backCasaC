import { body } from 'express-validator';

export const validarMovimiento = [
  body('producto_id').isInt({ min: 1 }).withMessage('producto_id inválido'),
  body('usuario_id').isInt({ min: 1 }).withMessage('usuario_id inválido'),
  body('tipo_movimiento')
    .isIn(['ENTRADA', 'SALIDA', 'PERDIDA'])
    .withMessage('tipo_movimiento debe ser ENTRADA, SALIDA o PERDIDA'),
  body('cantidad').isInt({ min: 1 }).withMessage('La cantidad debe ser un entero mayor a 0'),
  body('motivo').optional({ nullable: true }).isString().withMessage('El motivo debe ser texto'),
  body('observaciones').optional({ nullable: true }).isString()
    .isLength({ max: 255 }).withMessage('Las observaciones no pueden superar 255 caracteres'),
];

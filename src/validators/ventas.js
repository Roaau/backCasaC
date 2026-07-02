import { body } from 'express-validator';

export const validarCrearVenta = [
  body('usuario_id').isInt({ min: 1 }).withMessage('usuario_id invalido'),
  body('total').isFloat({ min: 0 }).withMessage('El total debe ser un numero no negativo'),
  body('tipo_venta').isIn(['Tienda', 'Pedido']).withMessage('tipo_venta debe ser Tienda o Pedido'),
  body('folio').trim().notEmpty().withMessage('El folio es requerido'),
  body('forma_pago').optional({ nullable: true }).isLength({ min: 2, max: 2 }).withMessage('forma_pago debe tener 2 caracteres'),
  body('tipo_pago').optional({ nullable: true }).isIn(['efectivo', 'tarjeta']).withMessage('tipo_pago debe ser efectivo o tarjeta'),
  body('descuento_porcentaje').optional({ nullable: true }).isFloat({ min: 0, max: 100 }).withMessage('El descuento debe estar entre 0 y 100'),
  body('nombre_cliente').optional({ nullable: true }).trim().isLength({ max: 200 }).withMessage('El nombre del cliente es demasiado largo'),
  body('telefono_cliente').optional({ nullable: true }).trim().isLength({ max: 30 }).withMessage('El telefono del cliente es demasiado largo'),
  body('direccion_entrega').optional({ nullable: true }).trim().isLength({ max: 500 }).withMessage('La direccion de entrega es demasiado larga'),
  body('referencia_entrega').optional({ nullable: true }).trim().isLength({ max: 500 }).withMessage('La referencia de entrega es demasiado larga'),
  body('estado_pedido').optional({ nullable: true }).isIn(['PENDIENTE', 'ENVIADO', 'ENTREGADO', 'CANCELADO']).withMessage('estado_pedido invalido'),
  body('detalles').isArray({ min: 1 }).withMessage('La venta debe tener al menos un producto'),
  body('detalles.*.cantidad').isInt({ min: 1 }).withMessage('La cantidad de cada producto debe ser al menos 1'),
  body('detalles.*.precio_unitario').isFloat({ min: 0 }).withMessage('El precio unitario no puede ser negativo'),
];

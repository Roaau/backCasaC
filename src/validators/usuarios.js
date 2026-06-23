import { body, param } from 'express-validator';

export const validarCrearUsuario = [
  body('nombre').trim().notEmpty().withMessage('El nombre es requerido')
    .isLength({ max: 100 }).withMessage('El nombre no puede superar 100 caracteres'),
  body('usuario').trim().notEmpty().withMessage('El usuario es requerido')
    .isLength({ min: 3, max: 50 }).withMessage('El usuario debe tener entre 3 y 50 caracteres')
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('El usuario solo puede contener letras, números y guion bajo'),
  body('contrasena').notEmpty().withMessage('La contraseña es requerida')
    .isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
  body('rol').notEmpty().withMessage('El rol es requerido')
    .isIn(['ADMINISTRADOR', 'EMPLEADO']).withMessage('El rol debe ser ADMINISTRADOR o EMPLEADO'),
];

export const validarEditarUsuario = [
  param('id').isInt({ min: 1 }).withMessage('ID de usuario inválido'),
  body('nombre').optional().trim().notEmpty().withMessage('El nombre no puede estar vacío')
    .isLength({ max: 100 }).withMessage('El nombre no puede superar 100 caracteres'),
  body('contrasena').optional().isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
  body('rol').optional().isIn(['ADMINISTRADOR', 'EMPLEADO']).withMessage('El rol debe ser ADMINISTRADOR o EMPLEADO'),
];

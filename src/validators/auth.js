import { body } from 'express-validator';

export const validarLogin = [
  body('usuario').trim().notEmpty().withMessage('El usuario es requerido'),
  body('contrasena').notEmpty().withMessage('La contraseña es requerida'),
];

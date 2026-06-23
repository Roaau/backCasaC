import Usuario from "../models/Usuario.js";
import Empresa from "../models/EmpresaModel.js";
import Sucursal from "../models/SucursalModel.js";
import CodigoInvitacion from "../models/CodigoInvitacion.js";
import SolicitudRegistro from "../models/SolicitudRegistro.js";
import SolicitudReset from "../models/SolicitudReset.js";
import sequelize from "../config/database.js";
import { Op } from "sequelize";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { enviarCodigoRegistro, enviarCodigoReset, notificarNuevaEmpresa } from "../services/emailService.js";

const generarCodigo = () =>
  'INV-' + crypto.randomBytes(3).toString('hex').toUpperCase();

// ── POST /api/auth/login ─────────────────────────────────────────────────────
export const login = async (req, res) => {
  const { usuario, contrasena } = req.body;
  if (!usuario || !contrasena) {
    return res.status(400).json({ mensaje: "Usuario y contraseña requeridos" });
  }

  try {
    const user = await Usuario.findOne({ where: { usuario } });
    if (!user) return res.status(401).json({ mensaje: "Usuario no encontrado" });

    const passwordMatch = await bcrypt.compare(contrasena, user.contrasena);
    if (!passwordMatch) return res.status(401).json({ mensaje: "Contraseña incorrecta" });

    if (user.activo === false) {
      return res.status(403).json({ mensaje: "Cuenta desactivada. Contacta al administrador." });
    }

    // Verificar estado de la empresa (solo para usuarios normales)
    if (!user.es_superadmin && user.empresa_id) {
      const empresa = await Empresa.findByPk(user.empresa_id, { attributes: ['estado', 'razon_social'] });
      if (empresa) {
        if (empresa.estado === 'pendiente') {
          return res.status(403).json({
            mensaje: "Tu empresa está pendiente de aprobación. Te notificaremos por correo cuando sea activada."
          });
        }
        if (empresa.estado === 'suspendida' || empresa.estado === 'rechazada') {
          return res.status(403).json({
            mensaje: "El acceso a esta empresa ha sido suspendido. Contacta al soporte de CasaC."
          });
        }
      }
    }

    const sucursal = user.sucursal_id
      ? await Sucursal.findByPk(user.sucursal_id, {
          attributes: ['sucursal_id', 'nombre', 'cp_sat', 'logo_b64']
        })
      : null;

    const empresa = user.empresa_id
      ? await Empresa.findByPk(user.empresa_id, { attributes: ['logo_empresa', 'razon_social'] })
      : null;

    const token = jwt.sign(
      {
        id:            user.usuario_id,
        rol:           user.rol_id,
        empresa_id:    user.empresa_id  || 1,
        sucursal_id:   user.sucursal_id || 1,
        es_superadmin: user.es_superadmin === true
      },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    const empresaInfo = user.empresa_id
      ? await Empresa.findByPk(user.empresa_id, { attributes: ['logo_empresa', 'razon_social'] })
      : null;

    return res.json({
      mensaje:           "Login correcto",
      token,
      usuario_id:        user.usuario_id,
      usuario:           user.usuario,
      nombre:            user.nombre,
      rol_id:            user.rol_id,
      empresa_id:        user.empresa_id  || 1,
      sucursal_id:       user.sucursal_id || 1,
      foto_perfil:       user.foto_perfil ?? null,
      color_tema:        user.color_tema  ?? null,
      sucursal_nombre:   sucursal?.nombre      ?? 'Sucursal Principal',
      sucursal_cp_sat:   sucursal?.cp_sat      ?? '06600',
      sucursal_logo:     sucursal?.logo_b64    ?? null,
      empresa_logo:      empresaInfo?.logo_empresa ?? null,
      empresa_nombre:    empresaInfo?.razon_social ?? null,
      es_superadmin:     user.es_superadmin === true
    });
  } catch (error) {
    return res.status(500).json({ mensaje: "Error en login" });
  }
};

// ── POST /api/auth/solicitar-registro ───────────────────────────────────────
export const solicitarCodigoRegistro = async (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ mensaje: 'Ingresa un correo electrónico válido.' });
  }

  const emailNorm = email.toLowerCase().trim();
  const yaRegistrado = await Empresa.findOne({ where: { email_contacto: emailNorm } });
  if (yaRegistrado) {
    return res.status(409).json({ mensaje: 'Ya existe una empresa registrada con ese correo. Inicia sesión o contacta al soporte.' });
  }

  // Elimina solicitudes expiradas del mismo email
  await SolicitudRegistro.destroy({
    where: { email: emailNorm, expira_en: { [Op.lt]: new Date() } }
  });

  // Limita a 1 solicitud activa por email
  const activa = await SolicitudRegistro.findOne({
    where: { email: emailNorm, usado: false, expira_en: { [Op.gt]: new Date() } }
  });
  if (activa) {
    return res.status(429).json({ mensaje: 'Ya enviamos un código a ese correo. Espera antes de solicitar otro.' });
  }

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    return res.status(503).json({
      mensaje: 'El servidor no tiene configurado el correo de salida. Contacta al proveedor del sistema.'
    });
  }

  const codigo    = crypto.randomInt(100000, 999999).toString();
  const expira_en = new Date(Date.now() + 15 * 60 * 1000); // 15 min

  await SolicitudRegistro.create({ email: emailNorm, codigo, expira_en, usado: false });

  try {
    await enviarCodigoRegistro({ destinatario: emailNorm, codigo });
    return res.json({ mensaje: 'Código enviado. Revisa tu correo (y la carpeta de spam).' });
  } catch {
    await SolicitudRegistro.destroy({ where: { email: emailNorm, codigo } });
    return res.status(500).json({ mensaje: 'Error al enviar el correo. Verifica EMAIL_USER y EMAIL_PASS en el servidor.' });
  }
};

// ── POST /api/auth/registro ──────────────────────────────────────────────────
//  Escenario A — Crear empresa (ADMIN):
//    body: { nombre, usuario, contrasena, rfc, razon_social, regimen_fiscal }
//  Escenario B — Unirse con código (EMPLEADO):
//    body: { nombre, usuario, contrasena, codigo_invitacion }
const RFC_REGEX = /^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/;

export const registro = async (req, res) => {
  const {
    nombre, usuario, contrasena, codigo_invitacion,
    rfc, razon_social, regimen_fiscal,
    email, codigo_verificacion
  } = req.body;

  if (!nombre || !usuario || !contrasena) {
    return res.status(400).json({ mensaje: 'nombre, usuario y contraseña son requeridos' });
  }
  if (contrasena.length < 8 || !/[A-Za-z]/.test(contrasena) || !/[0-9]/.test(contrasena)) {
    return res.status(400).json({ mensaje: 'La contraseña debe tener al menos 8 caracteres, una letra y un número.' });
  }

  const t = await sequelize.transaction();
  try {
    const existe = await Usuario.findOne({ where: { usuario }, transaction: t });
    if (existe) {
      await t.rollback();
      return res.status(409).json({ mensaje: 'El nombre de usuario ya está en uso' });
    }

    let empresa_id, sucursal_id, rol_id;

    // ── B: EMPLEADO con código de invitación ────────────────
    if (codigo_invitacion) {
      const codigo = await CodigoInvitacion.findOne({
        where: { codigo: codigo_invitacion.toUpperCase(), activo: true },
        transaction: t
      });

      if (!codigo || codigo.usos_restantes <= 0) {
        await t.rollback();
        return res.status(400).json({ mensaje: 'Código de invitación inválido o agotado' });
      }

      empresa_id  = codigo.empresa_id;
      sucursal_id = codigo.sucursal_id;

      if (!sucursal_id) {
        const primera = await Sucursal.findOne({
          where: { empresa_id, activa: true },
          order: [['sucursal_id', 'ASC']],
          transaction: t
        });
        sucursal_id = primera?.sucursal_id ?? null;
      }

      rol_id = codigo.rol_id ?? 2;

      const nuevosUsos = codigo.usos_restantes - 1;
      await CodigoInvitacion.update(
        { usos_restantes: nuevosUsos, activo: nuevosUsos > 0 },
        { where: { codigo_id: codigo.codigo_id }, transaction: t }
      );

    // ── A: ADMIN — crear empresa nueva ──────────────────────
    } else {
      // Validar OTP de correo electrónico
      if (!email || !codigo_verificacion) {
        await t.rollback();
        return res.status(400).json({ mensaje: 'Se requiere correo y código de verificación.' });
      }
      const emailNorm = email.toLowerCase().trim();

      const emailEnUso = await Empresa.findOne({ where: { email_contacto: emailNorm } });
      if (emailEnUso) {
        await t.rollback();
        return res.status(409).json({ mensaje: 'Ya existe una empresa registrada con ese correo electrónico.' });
      }

      const solicitud = await SolicitudRegistro.findOne({
        where: {
          email:    emailNorm,
          codigo:   codigo_verificacion.trim(),
          usado:    false,
          expira_en: { [Op.gt]: new Date() }
        }
      });
      if (!solicitud) {
        await t.rollback();
        return res.status(403).json({ mensaje: 'Código de verificación inválido o expirado.' });
      }
      // Marca el código como usado dentro de la transacción
      await SolicitudRegistro.update({ usado: true }, { where: { id: solicitud.id }, transaction: t });

      const empresa = await Empresa.create(
        {
          rfc:            rfc ? rfc.trim().toUpperCase() : null,
          razon_social:   razon_social?.trim() || nombre.trim(),
          regimen_fiscal: regimen_fiscal || null,
          activo:         true,
          estado:         'pendiente',
          email_contacto: email.toLowerCase().trim()
        },
        { transaction: t }
      );

      const sucursal = await Sucursal.create(
        {
          nombre: 'Sucursal Principal',
          empresa_id: empresa.empresa_id,
          cp_sat: '06600',
          activa: true
        },
        { transaction: t }
      );

      empresa_id  = empresa.empresa_id;
      sucursal_id = sucursal.sucursal_id;
      rol_id      = 1;
    }

    const hash = await bcrypt.hash(contrasena, 10);
    const nuevoUsuario = await Usuario.create(
      { nombre, usuario, contrasena: hash, rol_id, empresa_id, sucursal_id },
      { transaction: t }
    );

    await t.commit();

    // Notificar al superadmin si se creó una empresa nueva (fire-and-forget)
    if (rol_id === 1 && email) {
      try {
        const empresaCreada = await Empresa.findByPk(empresa_id, { attributes: ['razon_social', 'rfc', 'email_contacto'] });
        notificarNuevaEmpresa({
          razon_social: empresaCreada.razon_social,
          rfc:          empresaCreada.rfc,
          email_admin:  email,
          empresa_id
        }).catch(() => {});
      } catch { /* no bloquear el registro si el email falla */ }
    }

    return res.status(201).json({
      mensaje:    rol_id === 1
        ? 'Empresa registrada. Tu cuenta será activada pronto.'
        : 'Cuenta creada correctamente',
      usuario_id: nuevoUsuario.usuario_id,
      rol_id,
      empresa_id,
      sucursal_id
    });

  } catch (error) {
    await t.rollback();
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ mensaje: 'El RFC ya está registrado' });
    }
    return res.status(500).json({ mensaje: 'Error al registrar', detalle: error.message });
  }
};

// ── POST /api/empresas/codigos  (verificarToken + verificarAdmin) ────────────
export const generarCodigoInvitacion = async (req, res) => {
  const { sucursal_id = null, usos_max = 1, rol_id = 2 } = req.body;
  const empresa_id = req.usuario.empresa_id;

  try {
    if (sucursal_id) {
      const sucursal = await Sucursal.findOne({ where: { sucursal_id, empresa_id } });
      if (!sucursal) {
        return res.status(400).json({ error: 'La sucursal no pertenece a tu empresa' });
      }
    }

    const codigo = generarCodigo();
    await CodigoInvitacion.create({
      empresa_id,
      sucursal_id,
      rol_id: [1, 2].includes(rol_id) ? rol_id : 2,
      codigo,
      usos_restantes: Math.min(Math.max(usos_max, 1), 20),
      creado_por: req.usuario.id
    });

    return res.json({ codigo, usos_max, sucursal_id, rol_id });
  } catch (error) {
    return res.status(500).json({ error: 'Error al generar código' });
  }
};

// ── PUT /api/auth/perfil  (verificarToken) ───────────────────────────────────
export const actualizarPerfil = async (req, res) => {
  const { foto_perfil, color_tema } = req.body;
  const usuario_id = req.usuario.id;
  try {
    const datos = {};
    if (foto_perfil !== undefined) datos.foto_perfil = foto_perfil;
    if (color_tema  !== undefined) datos.color_tema  = color_tema;
    if (Object.keys(datos).length === 0) return res.json({ msg: 'Sin cambios' });
    await Usuario.update(datos, { where: { usuario_id } });
    res.json({ msg: 'Perfil actualizado' });
  } catch {
    res.status(500).json({ error: 'Error al actualizar perfil' });
  }
};

// ── POST /api/auth/solicitar-reset ───────────────────────────────────────────
export const solicitarResetContrasena = async (req, res) => {
  const { usuario } = req.body;
  if (!usuario?.trim()) return res.status(400).json({ mensaje: 'Ingresa tu nombre de usuario.' });

  const user = await Usuario.findOne({ where: { usuario: usuario.trim() } });
  // Siempre responde igual para no revelar si el usuario existe
  const respuestaOk = { mensaje: 'Si el usuario existe, recibirás un código en el correo configurado por tu empresa.' };

  if (!user) return res.json(respuestaOk);

  // Necesita empresa con correo configurado
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return res.json(respuestaOk);

  // Limpia resets expirados
  await SolicitudReset.destroy({ where: { usuario: usuario.trim(), expira_en: { [Op.lt]: new Date() } } });
  const activa = await SolicitudReset.findOne({
    where: { usuario: usuario.trim(), usado: false, expira_en: { [Op.gt]: new Date() } }
  });
  if (activa) return res.status(429).json({ mensaje: 'Ya enviamos un código. Espera antes de solicitar otro.' });

  const codigo    = crypto.randomInt(100000, 999999).toString();
  const expira_en = new Date(Date.now() + 15 * 60 * 1000);
  await SolicitudReset.create({ usuario: usuario.trim(), codigo, expira_en });

  // Obtiene el email del admin de la empresa
  const admin = await Usuario.findOne({ where: { empresa_id: user.empresa_id, rol_id: 1 } });
  // Usa el correo del sistema como destinatario si no hay email de usuario
  const destinatario = process.env.EMAIL_USER;

  try {
    await enviarCodigoReset({ destinatario, codigo, nombreUsuario: user.nombre });
  } catch {
    await SolicitudReset.destroy({ where: { usuario: usuario.trim(), codigo } });
  }

  return res.json(respuestaOk);
};

// ── POST /api/auth/confirmar-reset ───────────────────────────────────────────
export const confirmarResetContrasena = async (req, res) => {
  const { usuario, codigo, nueva_contrasena } = req.body;
  if (!usuario || !codigo || !nueva_contrasena) {
    return res.status(400).json({ mensaje: 'Todos los campos son requeridos.' });
  }
  if (nueva_contrasena.length < 8 || !/[A-Za-z]/.test(nueva_contrasena) || !/[0-9]/.test(nueva_contrasena)) {
    return res.status(400).json({ mensaje: 'La contraseña debe tener al menos 8 caracteres, una letra y un número.' });
  }

  const solicitud = await SolicitudReset.findOne({
    where: { usuario: usuario.trim(), codigo: codigo.trim(), usado: false, expira_en: { [Op.gt]: new Date() } }
  });
  if (!solicitud) return res.status(403).json({ mensaje: 'Código inválido o expirado.' });

  const hash = await bcrypt.hash(nueva_contrasena, 10);
  await Usuario.update({ contrasena: hash }, { where: { usuario: usuario.trim() } });
  await SolicitudReset.update({ usado: true }, { where: { id: solicitud.id } });

  return res.json({ mensaje: 'Contraseña actualizada correctamente.' });
};

// ── GET /api/empresas/codigos  (verificarToken + verificarAdmin) ─────────────
export const listarCodigos = async (req, res) => {
  try {
    const codigos = await CodigoInvitacion.findAll({
      where: { empresa_id: req.usuario.empresa_id },
      order: [['createdAt', 'DESC']]
    });
    return res.json(codigos);
  } catch {
    return res.status(500).json({ error: 'Error al obtener códigos' });
  }
};

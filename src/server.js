import dotenv from "dotenv";
dotenv.config({ override: true });
import * as Sentry from "@sentry/node";

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    tracesSampleRate: 0.2
  });
}

if (!process.env.JWT_SECRET) {
  console.error("JWT_SECRET no esta definido en .env; el servidor no puede iniciar de forma segura.");
  process.exit(1);
}

import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import http from "http";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import sequelize from "./config/database.js";
import { QueryTypes } from "sequelize";
import { verificarToken, verificarAdmin, verificarSuperAdmin } from "./middleware/authMiddleware.js";

import cajaRoutes from "./routes/cajaRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import productosRoutes from "./routes/productosRoutes.js";
import usuariosRoutes from "./routes/usuariosRoutes.js";
import ventasRoutes from "./routes/ventasRoutes.js";
import reportesRoutes from "./routes/reportesRoutes.js";
import inventarioRoutes from "./routes/inventarioRoutes.js";
import escanerRoutes from "./routes/escanerRoutes.js";
import planesRoutes from "./routes/planesRoutes.js";
import satRoutes from "./routes/satRoutes.js";
import clientesFiscalesRoutes from "./routes/clientesFiscalesRoutes.js";
import cfdiRoutes from "./routes/cfdiRoutes.js";
import configuracionRoutes from "./routes/configuracionRoutes.js";
import empresasRoutes from "./routes/empresasRoutes.js";
import sucursalesRoutes from "./routes/sucursalesRoutes.js";
import catalogoRoutes from "./routes/catalogoRoutes.js";
import proveedoresRoutes from "./routes/proveedoresRoutes.js";
import clientesRoutes from "./routes/clientesRoutes.js";
import comprasRoutes from "./routes/comprasRoutes.js";
import devolucionRoutes from "./routes/devolucionRoutes.js";
import iaRoutes from "./routes/iaRoutes.js";
import superadminRoutes from "./routes/superadminRoutes.js";
import cotizacionesRoutes from "./routes/cotizacionesRoutes.js";
import onboardingRoutes from "./routes/onboardingRoutes.js";
import notificacionesRoutes from "./routes/notificacionesRoutes.js";
import restauranteRoutes from "./routes/restauranteRoutes.js";
import cron from "node-cron";
import { realizarBackup } from "./backup.js";
import { cfdiHabilitado } from "./config/features.js";
import { registrarErroresServidor, registrarUso } from "./controllers/saludController.js";
import { datosDeSoporte } from "./models/PlataformaConfig.js";
import { leerCookie } from "./utils/sesionCookie.js";
import { correrResumenSemanal, correrAlertasInventario } from "./services/correosAutomaticos.js";

import "./models/CajaModel.js";
import "./models/MovimientoCaja.js";
import "./models/Venta.js";
import "./models/DetalleVenta.js";
import "./models/Devolucion.js";
import "./models/DetalleDevolucion.js";
import "./models/MovimientoInventario.js";
import "./models/CatSatFormaPago.js";
import "./models/CatSatMetodoPago.js";
import "./models/CatSatUsoCfdi.js";
import "./models/CatSatRegimenFiscal.js";
import "./models/CatSatUnidad.js";
import "./models/CatSatProductoServicio.js";
import "./models/CatSatCp.js";
import "./models/CatSatColonia.js";
import "./models/ClienteFiscal.js";
import "./models/CfdiVenta.js";
import "./models/ConfiguracionFiscal.js";
import "./models/CodigoInvitacion.js";
import "./models/CatalogoGiro.js";
import "./models/SolicitudPlan.js";
import "./models/PagoEmpresa.js";
import "./models/PlataformaConfig.js";
import "./models/CatalogoMaestro.js";
import "./models/SolicitudRegistro.js";
import "./models/SolicitudReset.js";
import "./models/Proveedor.js";
import "./models/Compra.js";
import "./models/DetalleCompra.js";
import "./models/Cotizacion.js";
import "./models/DetalleCotizacion.js";
import "./models/Auditoria.js";
import "./models/Notificacion.js";
import "./models/Lote.js";
import "./models/Restaurante.js";
import Empresa from "./models/EmpresaModel.js";
import { notificarVencimientoProximo } from "./services/emailService.js";
import { sumarAFecha } from "./utils/planes.js";
import { fechaLocalISO } from "./utils/fechas.js";
import Sucursal from "./models/SucursalModel.js";
import Producto from "./models/Producto.js";
import StockSucursal from "./models/StockSucursalModel.js";
import MovimientoInventario from "./models/MovimientoInventario.js";

// Asociaciones multi-empresa
Empresa.hasMany(Sucursal, { foreignKey: 'empresa_id' });
Sucursal.belongsTo(Empresa, { foreignKey: 'empresa_id' });
Producto.hasMany(StockSucursal, { foreignKey: 'producto_id' });
StockSucursal.belongsTo(Producto, { foreignKey: 'producto_id' });
Sucursal.hasMany(StockSucursal, { foreignKey: 'sucursal_id' });
StockSucursal.belongsTo(Sucursal, { foreignKey: 'sucursal_id' });
MovimientoInventario.belongsTo(Sucursal, { foreignKey: 'sucursal_id' });
Sucursal.hasMany(MovimientoInventario, { foreignKey: 'sucursal_id' });

const app = express();
app.set('trust proxy', 1);
// Dominio propio: https://pos.kairuma.dev (sesion en cookie httpOnly, ver utils/sesionCookie.js)
const defaultFrontendOrigins = ['https://sc-gamma-flame.vercel.app', 'https://pos.kairuma.dev'];
const allowedOrigins = [...new Set([
  ...defaultFrontendOrigins,
  ...(process.env.FRONTEND_URL || '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean)
])];
const allowVercelPreview = process.env.ALLOW_VERCEL_PREVIEW === 'true' || process.env.NODE_ENV !== 'production';

app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const allowed =
      allowedOrigins.includes(origin) ||
      (allowVercelPreview && /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin)) ||
      origin === 'http://localhost:4200';
    callback(allowed ? null : new Error('CORS'), allowed);
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true,
}));
app.use((req, res, next) => {
  if (req.headers["access-control-request-private-network"]) {
    res.setHeader("Access-Control-Allow-Private-Network", "true");
  }
  next();
});
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting - proteccion contra brute-force
const loginLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { mensaje: 'Demasiados intentos de acceso. Espera 15 minutos e intenta de nuevo.' }
});
const otpLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { mensaje: 'Demasiadas solicitudes de codigo. Espera una hora.' }
});

// Lectura de codigo por foto: no pide sesion (la usa el celular), asi que tiene su propio limite
const escanerLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas fotos en poco tiempo. Espera unos minutos.' }
});

const apiLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { mensaje: 'Demasiadas solicitudes. Espera unos minutos e intenta de nuevo.' }
});
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const ok = allowedOrigins.includes(origin)
        || (allowVercelPreview && /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin))
        || origin === 'http://localhost:4200';
      callback(ok ? null : new Error('CORS socket'), ok);
    },
    methods: ["GET", "POST"],
    credentials: true,
  }
});

// Middleware Socket.io: verifica JWT si viene; permite conexiones sin token para escaner movil
io.use((socket, next) => {
  // Token del handshake (dominios viejos) o cookie de sesion (dominio propio)
  const token = socket.handshake.auth?.token || leerCookie(socket.handshake.headers?.cookie);
  if (token) {
    try {
      socket.usuario = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      // Token invalido: conectar sin usuario
    }
  }
  next();
});

io.on("connection", (socket) => {
  // La caja del escritorio se une a su sala
  socket.on("unirse-caja", (salaId) => {
    socket.join(salaId);
  });

  // El celular se une a la misma sala por QR
  socket.on("unirse-movil", (salaId) => {
    socket.join(salaId);
  });

  // El celular emite codigo-leido y el backend lo reenvia a la sala
  socket.on("codigo-leido", (data) => {
    const sala = data.salaId || data.cajaId;
    socket.to(sala).emit("codigo-leido", data.codigo);
  });

  // Alertas de stock: solo si el JWT pertenece a esa empresa
  socket.on("unirse-empresa", (empresaId) => {
    if (socket.usuario && socket.usuario.empresa_id === Number(empresaId)) {
      socket.join(`empresa-${empresaId}`);
    }
  });

  // Pantalla de cocina: aviso "hay cambios" (sin datos; la pantalla vuelve a pedir la lista con su sesion)
  socket.on("unirse-cocina", (sucursalId) => {
    if (socket.usuario && Number(sucursalId) > 0) socket.join(`cocina-${Number(sucursalId)}`);
  });

  socket.on("disconnect", () => {});
});
app.set("io", io);

// Cron diario (9:00 hora de Mexico): avisa por correo a las empresas cuyo plan vence en 7 dias o mañana.
// aviso_vencimiento_enviado evita mandar dos veces el mismo dia.
cron.schedule('0 9 * * *', async () => {
  try {
    const hoy = fechaLocalISO();
    const en7 = sumarAFecha(hoy, { dias: 7 });
    const en1 = sumarAFecha(hoy, { dias: 1 });
    const porVencer = await Empresa.findAll({
      where: { estado: 'activa', fecha_vencimiento: [en7, en1] },
      attributes: ['empresa_id', 'razon_social', 'email_contacto', 'fecha_vencimiento', 'precio_mensual', 'periodo_pago', 'aviso_vencimiento_enviado']
    });
    for (const emp of porVencer) {
      if (!emp.email_contacto || emp.aviso_vencimiento_enviado === hoy) continue;
      await notificarVencimientoProximo({
        destinatario: emp.email_contacto,
        razon_social: emp.razon_social,
        dias: emp.fecha_vencimiento === en1 ? 1 : 7,
        fecha: emp.fecha_vencimiento,
        precio_mensual: emp.precio_mensual,
        periodo_pago: emp.periodo_pago
      }).catch(err => console.error('[Recordatorio] No se envio a', emp.email_contacto, err.message));
      await emp.update({ aviso_vencimiento_enviado: hoy });
    }
  } catch (err) {
    console.error('[Recordatorio] Error:', err.message);
  }
}, { timezone: 'America/Mexico_City' });

// Correos al dueño: resumen semanal los lunes 8:10 y alertas de agotados/caducidad diario 7:40 (hora MX).
// Se pueden apagar por negocio en Configuracion (empresas.correos_automaticos).
cron.schedule('10 8 * * 1', () => {
  correrResumenSemanal().catch(err => console.error('[Resumen semanal]', err.message));
}, { timezone: 'America/Mexico_City' });
cron.schedule('40 7 * * *', () => {
  correrAlertasInventario().catch(err => console.error('[Alertas inventario]', err.message));
}, { timezone: 'America/Mexico_City' });

// Cron: verificar stock bajo cada 30 min y notificar via socket
cron.schedule('*/30 * * * *', async () => {
  try {
    const alertas = await sequelize.query(`
      SELECT p.nombre, ss.stock_actual, p.stock_minimo, s.empresa_id, s.nombre as sucursal
      FROM stock_sucursal ss
      JOIN productos p ON ss.producto_id = p.producto_id
      JOIN sucursales s ON ss.sucursal_id = s.sucursal_id
      WHERE ss.stock_actual <= p.stock_minimo AND p.stock_minimo IS NOT NULL
      ORDER BY s.empresa_id, ss.stock_actual ASC
    `, { type: QueryTypes.SELECT });

    const porEmpresa = {};
    for (const a of alertas) {
      if (!porEmpresa[a.empresa_id]) porEmpresa[a.empresa_id] = [];
      porEmpresa[a.empresa_id].push(a);
    }
    for (const [empresaId, lista] of Object.entries(porEmpresa)) {
      io.to(`empresa-${empresaId}`).emit('alerta-stock', lista);
    }
  } catch (_) {}
});
const responderHealth = async (req, res) => {
  const timestamp = new Date().toISOString();
  const started = Date.now();
  try {
    await sequelize.authenticate();
    return res.status(200).json({
      ok: true,
      service: "SC POS API",
      status: "healthy",
      database: "connected",
      latency_ms: Date.now() - started,
      timestamp
    });
  } catch (error) {
    if (process.env.SENTRY_DSN) Sentry.captureException(error);
    return res.status(500).json({
      ok: false,
      service: "SC POS API",
      status: "unhealthy",
      database: "disconnected",
      error: "No se pudo conectar con la base de datos",
      latency_ms: Date.now() - started,
      timestamp
    });
  }
};

app.get("/api/health", responderHealth);
app.get("/api/health/deep", responderHealth);
// Contacto de soporte (publico: se muestra tambien en login y en la pagina de ayuda)
app.get("/api/soporte", async (req, res) => {
  try {
    res.json(await datosDeSoporte());
  } catch {
    res.json({ whatsapp: null, email: null, horario: null });
  }
});
app.use("/api", apiLimit);
app.use("/api", registrarErroresServidor);
app.use("/api/auth/login",               loginLimit);
app.use("/api/auth/solicitar-registro", otpLimit);
app.use("/api/auth/solicitar-reset",    otpLimit);
app.use("/api/auth", authRoutes);
app.use("/api/escaner", escanerLimit, escanerRoutes);
app.use("/api/planes", planesRoutes);

app.use("/api/productos", verificarToken, productosRoutes);
app.use("/api/usuarios", verificarToken, usuariosRoutes);
app.use("/api/ventas", verificarToken, ventasRoutes);
app.use("/api/caja", verificarToken, cajaRoutes);
app.use("/api/reportes", verificarToken, verificarAdmin, reportesRoutes);
app.use("/api/inventario", verificarToken, inventarioRoutes);
app.use("/api/sat", verificarToken, satRoutes);
app.use("/api/clientes-fiscales", verificarToken, clientesFiscalesRoutes);
if (cfdiHabilitado()) {
  app.use("/api/cfdi", verificarToken, verificarAdmin, cfdiRoutes);
} else {
  app.use("/api/cfdi", (req, res) => res.status(404).json({ error: "La facturacion CFDI no esta habilitada" }));
}
app.use("/api/configuracion", verificarToken, verificarAdmin, configuracionRoutes);
app.use("/api/empresas",     verificarToken, verificarAdmin, empresasRoutes);
app.use("/api/sucursales",   verificarToken, sucursalesRoutes);
app.use("/api/catalogo",     verificarToken, catalogoRoutes);
app.use("/api/proveedores",  verificarToken, proveedoresRoutes);
app.use("/api/clientes",     verificarToken, clientesRoutes);
app.use("/api/compras",      verificarToken, comprasRoutes);
app.use("/api/devoluciones", verificarToken, devolucionRoutes);
app.use("/api/ia",           verificarToken, iaRoutes);
app.use("/api/cotizaciones", verificarToken, cotizacionesRoutes);
app.use("/api/onboarding",  verificarToken, onboardingRoutes);
app.use("/api/notificaciones", verificarToken, notificacionesRoutes);
app.post("/api/uso", verificarToken, registrarUso);
app.use("/api/restaurante", verificarToken, restauranteRoutes);
app.use("/api/superadmin",   verificarToken, verificarSuperAdmin, superadminRoutes);

app.get("/api", (req, res) => res.json({ mensaje: "Servidor arriba" }));

// Error handler Sentry
if (process.env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app);
}

// Error handler generico
app.use((err, req, res, next) => {
  res.status(500).json({ error: "Error interno del servidor" });
});

const PORT = process.env.PORT || 3000;

try {
  await sequelize.authenticate();
  console.log("Conexion a PostgreSQL correcta.");
  // Los cambios de esquema van por migraciones. alter solo si se pide explicitamente,
  // para no modificar la BD de produccion al correr el backend en local con DATABASE_URL de Supabase.
  await sequelize.sync({ alter: process.env.DB_SYNC_ALTER === "true" });
  console.log("Modelos sincronizados.");
  // Tablas creadas por sync: cerrar la API publica de Supabase igual que las demas
  await sequelize.query("ALTER TABLE IF EXISTS clientes ENABLE ROW LEVEL SECURITY").catch(() => {});
  // Columnas opcionales que pueden haber quedado NOT NULL en BD antigua
  await sequelize.query("ALTER TABLE IF EXISTS sucursales ALTER COLUMN cp_sat DROP NOT NULL").catch(() => {});
  await sequelize.query("ALTER TABLE IF EXISTS sucursales ALTER COLUMN direccion DROP NOT NULL").catch(() => {});
  // Columnas nuevas (migraciones 20261031*); idempotente por si no se corrio db:migrate
  for (const sql of [
    "ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS intentos_fallidos INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS bloqueado_hasta TIMESTAMPTZ NULL",
    "ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS sesion_version INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE empresas ADD COLUMN IF NOT EXISTS pin_autorizacion_activo BOOLEAN NOT NULL DEFAULT false",
    "ALTER TABLE empresas ADD COLUMN IF NOT EXISTS pin_autorizacion_hash VARCHAR(100) NULL",
    // Pagos mixtos / transferencia (migracion 20261031010000)
    "ALTER TABLE ventas ADD COLUMN IF NOT EXISTS monto_efectivo DECIMAL(10,2) NULL",
    "ALTER TABLE ventas ADD COLUMN IF NOT EXISTS monto_tarjeta DECIMAL(10,2) NULL",
    "ALTER TABLE ventas ADD COLUMN IF NOT EXISTS monto_transferencia DECIMAL(10,2) NULL",
    "ALTER TABLE ventas ADD COLUMN IF NOT EXISTS referencia_pago VARCHAR(60) NULL",
    "CREATE INDEX IF NOT EXISTS idx_auditoria_empresa_fecha ON auditoria (empresa_id, fecha DESC)",
    // Correos automaticos, salud y uso (migracion 20261031020000)
    "ALTER TABLE empresas ADD COLUMN IF NOT EXISTS correos_automaticos BOOLEAN NOT NULL DEFAULT true",
    "ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS ultimo_acceso TIMESTAMPTZ NULL",
    `CREATE TABLE IF NOT EXISTS errores_servidor (
      error_id SERIAL PRIMARY KEY, fecha TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      metodo VARCHAR(10), ruta VARCHAR(200), status INTEGER, empresa_id INTEGER NULL, usuario_id INTEGER NULL)`,
    "CREATE INDEX IF NOT EXISTS idx_errores_servidor_fecha ON errores_servidor (fecha DESC)",
    `CREATE TABLE IF NOT EXISTS uso_pantallas (
      fecha DATE NOT NULL, empresa_id INTEGER NOT NULL, usuario_id INTEGER NOT NULL,
      ruta VARCHAR(80) NOT NULL, visitas INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (fecha, empresa_id, usuario_id, ruta))`,
    "ALTER TABLE errores_servidor ENABLE ROW LEVEL SECURITY",
    "ALTER TABLE uso_pantallas ENABLE ROW LEVEL SECURITY",
    // Ventas sin internet (migracion 20261031030000)
    "ALTER TABLE ventas ADD COLUMN IF NOT EXISTS id_local VARCHAR(40) NULL",
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_ventas_id_local ON ventas (sucursal_id, id_local) WHERE id_local IS NOT NULL",
    // Lotes (migracion 20261031040000)
    `CREATE TABLE IF NOT EXISTS lotes (
      lote_id SERIAL PRIMARY KEY, empresa_id INTEGER NOT NULL, producto_id INTEGER NOT NULL, sucursal_id INTEGER NOT NULL,
      lote VARCHAR(60) NULL, fecha_caducidad DATE NULL, cantidad DECIMAL(12,3) NOT NULL DEFAULT 0,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
    "CREATE INDEX IF NOT EXISTS idx_lotes_producto_sucursal ON lotes (producto_id, sucursal_id)",
    "ALTER TABLE lotes ENABLE ROW LEVEL SECURITY",
    // Restaurantes (migracion 20261031050000); las tablas las crea sync, aqui solo se cierran a la API publica
    "ALTER TABLE IF EXISTS mesas ENABLE ROW LEVEL SECURITY",
    "ALTER TABLE IF EXISTS comandas ENABLE ROW LEVEL SECURITY",
    "ALTER TABLE IF EXISTS comanda_items ENABLE ROW LEVEL SECURITY",
    "CREATE INDEX IF NOT EXISTS idx_comandas_sucursal_estado ON comandas (sucursal_id, estado)",
    "CREATE INDEX IF NOT EXISTS idx_comanda_items_comanda ON comanda_items (comanda_id)"
  ]) {
    await sequelize.query(sql).catch(err => console.error("Columna nueva:", err.message));
  }
  server.listen(PORT, () => {
    console.log(`Servidor corriendo en: http://localhost:${PORT}`);
    // Backup automatico diario a las 3 AM
    cron.schedule('0 3 * * *', () => {
      console.log('Iniciando backup automatico...');
      realizarBackup().catch(err => console.error("Backup automatico fallido:", err.message));
    });
    console.log('Backup automatico programado todos los dias a las 3:00 AM');
  });
} catch (err) {
  console.error("Error al iniciar:", err);
  process.exit(1);
}


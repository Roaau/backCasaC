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
  console.error("❌ JWT_SECRET no está definido en .env — el servidor no puede iniciar de forma segura.");
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
import { verificarToken, verificarSuperAdmin } from "./middleware/authMiddleware.js";

import cajaRoutes from "./routes/cajaRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import productosRoutes from "./routes/productosRoutes.js";
import usuariosRoutes from "./routes/usuariosRoutes.js";
import ventasRoutes from "./routes/ventasRoutes.js";
import reportesRoutes from "./routes/reportesRoutes.js";
import inventarioRoutes from "./routes/inventarioRoutes.js";
import escanerRoutes from "./routes/escanerRoutes.js";
import satRoutes from "./routes/satRoutes.js";
import clientesFiscalesRoutes from "./routes/clientesFiscalesRoutes.js";
import cfdiRoutes from "./routes/cfdiRoutes.js";
import configuracionRoutes from "./routes/configuracionRoutes.js";
import empresasRoutes from "./routes/empresasRoutes.js";
import sucursalesRoutes from "./routes/sucursalesRoutes.js";
import catalogoRoutes from "./routes/catalogoRoutes.js";
import proveedoresRoutes from "./routes/proveedoresRoutes.js";
import comprasRoutes from "./routes/comprasRoutes.js";
import creditosRoutes from "./routes/creditosRoutes.js";
import devolucionRoutes from "./routes/devolucionRoutes.js";
import iaRoutes from "./routes/iaRoutes.js";
import superadminRoutes from "./routes/superadminRoutes.js";
import cotizacionesRoutes from "./routes/cotizacionesRoutes.js";
import onboardingRoutes from "./routes/onboardingRoutes.js";
import cron from "node-cron";
import { realizarBackup } from "./backup.js";

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
import "./models/CatalogoMaestro.js";
import "./models/SolicitudRegistro.js";
import "./models/SolicitudReset.js";
import "./models/Proveedor.js";
import "./models/Compra.js";
import "./models/DetalleCompra.js";
import "./models/PagoCredito.js";
import "./models/Cotizacion.js";
import "./models/DetalleCotizacion.js";
import Empresa from "./models/EmpresaModel.js";
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
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map(o => o.trim())
  : null;

app.use(helmet());
app.use(cors({
  origin: allowedOrigins ?? "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
}));
app.use((req, res, next) => {
  if (req.headers["access-control-request-private-network"]) {
    res.setHeader("Access-Control-Allow-Private-Network", "true");
  }
  next();
});
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting — protección contra brute-force
const loginLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { mensaje: 'Demasiados intentos de acceso. Espera 15 minutos e intenta de nuevo.' }
});
const otpLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { mensaje: 'Demasiadas solicitudes de código. Espera una hora.' }
});

const server = http.createServer(app);

const socketCorsOrigin = allowedOrigins ?? "*";
const io = new Server(server, {
  cors: { origin: socketCorsOrigin, methods: ["GET", "POST"] }
});

// Middleware Socket.io: verifica JWT si viene — permite conexiones sin token (escáner móvil)
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (token) {
    try {
      socket.usuario = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      // Token inválido — conectar sin usuario (el escáner no tiene sesión)
    }
  }
  next();
});

io.on("connection", (socket) => {
  // La caja del escritorio se une a su sala
  socket.on("unirse-caja", (salaId) => {
    socket.join(salaId);
  });

  // El celular se une a la misma sala (no requiere auth — accede por QR)
  socket.on("unirse-movil", (salaId) => {
    socket.join(salaId);
  });

  // El celular emite "codigo-leido" — el backend lo reenvía a la sala
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

  socket.on("disconnect", () => {});
});

// Cron: verificar stock bajo cada 30 min y notificar vía socket
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
app.use("/api/auth/login",               loginLimit);
app.use("/api/auth/solicitar-registro", otpLimit);
app.use("/api/auth/solicitar-reset",    otpLimit);
app.use("/api/auth", authRoutes);
app.use("/api/escaner", escanerRoutes);

app.use("/api/productos", verificarToken, productosRoutes);
app.use("/api/usuarios", verificarToken, usuariosRoutes);
app.use("/api/ventas", verificarToken, ventasRoutes);
app.use("/api/caja", verificarToken, cajaRoutes);
app.use("/api/reportes", verificarToken, reportesRoutes);
app.use("/api/inventario", verificarToken, inventarioRoutes);
app.use("/api/sat", verificarToken, satRoutes);
app.use("/api/clientes-fiscales", verificarToken, clientesFiscalesRoutes);
app.use("/api/cfdi", verificarToken, cfdiRoutes);
app.use("/api/configuracion", verificarToken, configuracionRoutes);
app.use("/api/empresas",     verificarToken, empresasRoutes);
app.use("/api/sucursales",   verificarToken, sucursalesRoutes);
app.use("/api/catalogo",     verificarToken, catalogoRoutes);
app.use("/api/proveedores",  verificarToken, proveedoresRoutes);
app.use("/api/compras",      verificarToken, comprasRoutes);
app.use("/api/creditos",      verificarToken, creditosRoutes);
app.use("/api/devoluciones", verificarToken, devolucionRoutes);
app.use("/api/ia",           verificarToken, iaRoutes);
app.use("/api/cotizaciones", verificarToken, cotizacionesRoutes);
app.use("/api/onboarding",  verificarToken, onboardingRoutes);
app.use("/api/superadmin",   verificarToken, verificarSuperAdmin, superadminRoutes);

app.get("/api", (req, res) => res.json({ mensaje: "Servidor arriba" }));

// Error handler Sentry (debe ir antes del handler genérico)
if (process.env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app);
}

// Error handler genérico
app.use((err, req, res, next) => {
  res.status(500).json({ error: "Error interno del servidor" });
});

const PORT = process.env.PORT || 3000;

try {
  await sequelize.authenticate();
  console.log("🔌 Conexión a PostgreSQL correcta.");
  await sequelize.sync({ alter: process.env.NODE_ENV !== "production" });
  console.log("📦 Modelos sincronizados.");
  server.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en: http://localhost:${PORT}`);
    // Backup automático diario a las 3 AM
    cron.schedule('0 3 * * *', () => {
      console.log('⏰ Iniciando backup automático...');
      realizarBackup();
    });
    console.log('🗄️  Backup automático programado — todos los días a las 3:00 AM');
  });
} catch (err) {
  console.error("❌ Error al iniciar:", err);
  process.exit(1);
}
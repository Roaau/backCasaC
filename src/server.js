// =====================
// 📌 DEPENDENCIAS
// =====================
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import sequelize from "./config/database.js";

// 📌 RUTAS
import cajaRoutes from "./routes/cajaRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import productosRoutes from "./routes/productosRoutes.js";
import usuariosRoutes from "./routes/usuariosRoutes.js";
import ventasRoutes from "./routes/ventasRoutes.js";
import reportesRoutes from "./routes/reportesRoutes.js";
import inventarioRoutes from "./routes/inventarioRoutes.js";

// 📌 MODELADO (SE IMPORTAN PARA REGISTRO)
import "./models/CajaModel.js";
import "./models/MovimientoCaja.js";
import "./models/Venta.js";
import "./models/DetalleVenta.js";
import "./models/MovimientoInventario.js";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// =====================
// 📌 USO DE RUTAS
// =====================
app.use("/api/auth", authRoutes);
app.use("/api/productos", productosRoutes);
app.use("/api/usuarios", usuariosRoutes);
app.use("/api/ventas", ventasRoutes);
app.use("/api/caja", cajaRoutes);
app.use("/api/reportes", reportesRoutes);
app.use("/api/inventario", inventarioRoutes);

// =====================
// 🔌 CONEXIÓN BD + SYNC
// =====================
try {
  await sequelize.authenticate();
  console.log("🔌 Conexión a PostgreSQL correcta.");
  await sequelize.sync({ alter: true });
  console.log("📦 Modelos sincronizados.");
} catch (err) {
  console.error("❌ Error en BD:", err);
}

// =====================
// 🔍 TEST
// =====================
app.get("/api", (req, res) => {
  res.json({ mensaje: "Servidor arriba 🚀" });
});

// =====================
// 🚀 LEVANTAR SERVER
// =====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor: http://localhost:${PORT}`));

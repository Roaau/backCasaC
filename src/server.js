import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import sequelize from "./config/database.js";
import authRoutes from "./routes/authRoutes.js";
import productosRoutes from "./routes/productosRoutes.js";


dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/productos", productosRoutes);

try {
  await sequelize.authenticate();
  console.log("Conexión a PostgreSQL establecida correctamente.");
} catch (error) {
  console.error("Error al conectar con la base de datos:", error);
}

app.get("/api", (req, res) => {
  res.json({ mensaje: "ya jalaaaaaaaaaaaa" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

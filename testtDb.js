import sequelize from "./src/config/database.js";

async function testConnection() {
  try {
    await sequelize.authenticate();
    console.log("Conectado a Supabase ✅");
  } catch (err) {
    console.error("Error de conexión ❌", err);
  } finally {
    await sequelize.close();
  }
}

testConnection();

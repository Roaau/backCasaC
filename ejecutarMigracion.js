import "src/config/database.js";
import { migrarContrasenas } from "migrarContrasenas.js";

(async () => {
  try {
    await migrarContrasenas();
    console.log("✅ Migración completada");
  } catch (e) {
    console.error("❌ Error:", e);
    process.exit(1);
  }
})();

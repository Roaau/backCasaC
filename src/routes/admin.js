// routes/admin.js
import { migrarContrasenas } from "../../migrarContrasenas.js";

router.post("/migrar-contrasenas", async (req, res) => {
  const { SECRET_KEY } = req.headers;

  if (SECRET_KEY !== process.env.MIGRATION_SECRET) {
    return res.status(403).json({ msg: "No autorizado" });
  }

  await migrarContrasenas();
  res.json({ ok: true });
});

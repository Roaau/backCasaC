import dotenv from "dotenv";
dotenv.config({ override: true });
import { realizarBackup } from "../src/backup.js";

realizarBackup()
  .then((archivo) => {
    console.log(`Backup creado: ${archivo}`);
    process.exit(0);
  })
  .catch((err) => {
    console.error(`Backup fallido: ${err.message}`);
    process.exit(1);
  });

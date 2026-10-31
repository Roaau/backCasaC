// Restaura un respaldo .sql (de "npm run backup" o del workflow "Backup Supabase Database")
// en una base de datos SEPARADA para probarlo, o en produccion solo si se confirma explicitamente.
//
// Uso (prueba en una base aparte, lo recomendado):
//   RESTORE_DATABASE_URL="postgres://usuario:clave@host:5432/prueba" node scripts/restaurar.js backups/supabase-2026-10-31.sql
//
// El respaldo trae CREATE TABLE: la base destino debe estar VACIA (un proyecto nuevo de Supabase o
// un Postgres local recien creado). Para una emergencia real lo seguro es restaurar en una base nueva
// y cambiar DATABASE_URL en Render a esa base. Si aun asi apuntas a la de produccion:
//   RESTORE_DATABASE_URL="$DATABASE_URL" node scripts/restaurar.js archivo.sql --confirmo-produccion
//
// Requiere psql instalado (PostgreSQL client). Si no esta en el PATH, define PSQL_PATH.
import dotenv from "dotenv";
dotenv.config({ override: true });
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";

const archivo = process.argv[2];
const confirmoProduccion = process.argv.includes("--confirmo-produccion");
const destino = process.env.RESTORE_DATABASE_URL;
const produccion = process.env.DATABASE_URL;
const psql = process.env.PSQL_PATH || "psql";

const salir = (msg) => { console.error(`\n✖ ${msg}\n`); process.exit(1); };

if (!archivo) salir("Indica el archivo .sql a restaurar. Ej: node scripts/restaurar.js backups/supabase-2026-10-31.sql");
if (!fs.existsSync(archivo)) salir(`No existe el archivo ${archivo}`);
if (!destino) salir("Define RESTORE_DATABASE_URL con la base donde se va a restaurar.");
if (produccion && destino.trim() === produccion.trim() && !confirmoProduccion) {
  salir("RESTORE_DATABASE_URL es la base de PRODUCCION. Si de verdad quieres restaurar ahi, agrega --confirmo-produccion.");
}

const tamanoMb = (fs.statSync(archivo).size / 1024 / 1024).toFixed(1);
console.log(`Restaurando ${path.basename(archivo)} (${tamanoMb} MB)...`);

const resultado = spawnSync(psql, [destino, "-v", "ON_ERROR_STOP=1", "--single-transaction", "-q", "-f", archivo], {
  stdio: ["ignore", "inherit", "inherit"]
});
if (resultado.error) salir(`No se pudo ejecutar psql: ${resultado.error.message}. Instala el cliente de PostgreSQL o define PSQL_PATH.`);
if (resultado.status !== 0) salir("La restauracion fallo. No se aplico nada (todo corre en una sola transaccion).");

// Verificacion rapida: conteo de tablas principales
const conteo = spawnSync(psql, [destino, "-At", "-c",
  "SELECT 'empresas', COUNT(*) FROM empresas UNION ALL SELECT 'usuarios', COUNT(*) FROM usuarios " +
  "UNION ALL SELECT 'productos', COUNT(*) FROM productos UNION ALL SELECT 'ventas', COUNT(*) FROM ventas " +
  "UNION ALL SELECT 'caja', COUNT(*) FROM caja"
], { encoding: "utf8" });
console.log("\n✔ Restauracion terminada. Registros por tabla:");
console.log((conteo.stdout || "").split("\n").filter(Boolean).map(l => "  " + l.replace("|", ": ")).join("\n"));

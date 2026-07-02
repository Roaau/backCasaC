import { spawn } from 'child_process';
import { existsSync, mkdirSync, readdirSync, unlinkSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BACKUP_DIR = process.env.BACKUP_DIR || join(__dirname, '..', 'backups');
const MAX_BACKUPS = Number(process.env.MAX_BACKUPS || 7);

function resolverPgDump() {
  if (process.env.PG_DUMP_PATH) return process.env.PG_DUMP_PATH;

  const rutasWindows = [
    'C:\\Program Files\\PostgreSQL\\18\\bin\\pg_dump.exe',
    'C:\\Program Files\\PostgreSQL\\18\\pgAdmin 4\\runtime\\pg_dump.exe',
    'C:\\Program Files\\PostgreSQL\\17\\bin\\pg_dump.exe',
    'C:\\Program Files\\PostgreSQL\\16\\bin\\pg_dump.exe',
    'C:\\Program Files\\PostgreSQL\\15\\bin\\pg_dump.exe'
  ];

  const encontrada = rutasWindows.find(ruta => existsSync(ruta));
  return encontrada || 'pg_dump';
}

export function realizarBackup() {
  if (!existsSync(BACKUP_DIR)) mkdirSync(BACKUP_DIR, { recursive: true });

  const ahora = new Date();
  const fecha = ahora.toISOString().split('T')[0];
  const hora  = ahora.toTimeString().slice(0, 5).replace(':', '-');
  const archivo = join(BACKUP_DIR, `backup-${fecha}_${hora}.sql`);

  const { DATABASE_URL, DB_HOST = 'localhost', DB_PORT = '5432', DB_NAME, DB_USER, DB_PASSWORD } = process.env;
  const env = { ...process.env, PGPASSWORD: DB_PASSWORD };
  const args = DATABASE_URL
    ? [DATABASE_URL, '-f', archivo]
    : ['-h', DB_HOST, '-p', DB_PORT, '-U', DB_USER, '-d', DB_NAME, '-f', archivo];

  if (!DATABASE_URL && (!DB_NAME || !DB_USER)) {
    return Promise.reject(new Error('Configura DATABASE_URL o DB_NAME/DB_USER para crear backups.'));
  }

  return new Promise((resolve, reject) => {
    const pgDump = resolverPgDump();
    const child = spawn(pgDump, args, { env, shell: false });
    let stderr = '';

    child.stderr.on('data', data => { stderr += data.toString(); });
    child.on('error', err => reject(new Error(`pg_dump no pudo iniciar (${pgDump}): ${err.message}`)));
    child.on('close', code => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `pg_dump termino con codigo ${code}`));
        return;
      }
      eliminarAntiguos();
      console.log(`Backup guardado: ${archivo}`);
      resolve(archivo);
    });
  });
}

function eliminarAntiguos() {
  const archivos = readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('backup-') && f.endsWith('.sql'))
    .map(f => ({ nombre: f, mtime: statSync(join(BACKUP_DIR, f)).mtime }))
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

  archivos.slice(MAX_BACKUPS).forEach(({ nombre }) => {
    unlinkSync(join(BACKUP_DIR, nombre));
    console.log(`Backup antiguo eliminado: ${nombre}`);
  });
}

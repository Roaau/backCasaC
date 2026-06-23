import { exec } from 'child_process';
import { existsSync, mkdirSync, readdirSync, unlinkSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BACKUP_DIR = join(__dirname, '..', 'backups');
const MAX_BACKUPS = 7;

export function realizarBackup() {
  if (!existsSync(BACKUP_DIR)) mkdirSync(BACKUP_DIR, { recursive: true });

  const ahora = new Date();
  const fecha = ahora.toISOString().split('T')[0];
  const hora  = ahora.toTimeString().slice(0, 5).replace(':', '-');
  const archivo = join(BACKUP_DIR, `backup-${fecha}_${hora}.sql`);

  const { DB_HOST = 'localhost', DB_PORT = '5432', DB_NAME, DB_USER, DB_PASSWORD } = process.env;
  const env = { ...process.env, PGPASSWORD: DB_PASSWORD };
  const cmd = `pg_dump -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USER} -d ${DB_NAME} -f "${archivo}"`;

  exec(cmd, { env }, (err) => {
    if (err) {
      console.error('❌ Backup falló (¿pg_dump en PATH?):', err.message);
      return;
    }
    console.log(`✅ Backup guardado: ${archivo}`);
    eliminarAntiguos();
  });
}

function eliminarAntiguos() {
  const archivos = readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('backup-') && f.endsWith('.sql'))
    .map(f => ({ nombre: f, mtime: statSync(join(BACKUP_DIR, f)).mtime }))
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

  archivos.slice(MAX_BACKUPS).forEach(({ nombre }) => {
    unlinkSync(join(BACKUP_DIR, nombre));
    console.log(`🗑️  Backup antiguo eliminado: ${nombre}`);
  });
}

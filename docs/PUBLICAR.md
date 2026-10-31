# Cómo publicar, respaldar y restaurar

## Publicar un cambio

1. Trabaja en una rama o directo en `main` (los dos repos publican solos desde `main`).
2. Antes de subir:
   - Back: `npm test`
   - Front: `npm run build`
3. `git push origin main`.
   - Render reconstruye el back (2–4 min). Revisa **Logs** y luego `https://backcasac-e1h9.onrender.com/api/health/deep`.
   - Vercel reconstruye el front (1–3 min). Si el build falla, Vercel deja la versión anterior.
4. Para que **no se publique si fallan las pruebas**:
   - Render → backCasaC → Settings → Build & Deploy → *Auto-Deploy: After CI Checks Pass*.
   - GitHub → frontcasac → Settings → Branches → regla para `main` que exija el check "Compilar y probar frontend".

### Cambios de base de datos

- Cada cambio de esquema va en `src/migrations/AAAAMMDDHHMMSS-descripcion.js` **y**, si el deploy debe funcionar sin correr migraciones, también como `ADD COLUMN IF NOT EXISTS` en la lista de `server.js`.
- Para aplicarlas a mano: `npm run db:migrate` con `DATABASE_URL` de Supabase.
- Nunca corras el back local con `DB_SYNC_ALTER=true` apuntando a Supabase.

### Variables de entorno (Render)

Obligatorias: `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV=production`, `FRONTEND_URL`.
Correo: `BREVO_API_KEY`, `EMAIL_USER`. IA: `GEMINI_API_KEY`. Opcionales: `SENTRY_DSN`, `IA_DAILY_LIMIT`, `APP_TIMEZONE_OFFSET`, `CFDI_HABILITADO`.

## Respaldos

- **Automático**: GitHub → backCasaC → Actions → "Backup Supabase Database", diario 3:15 a. m. (hora MX). Guarda el `.sql` 14 días como artifact. Necesita el secret `SUPABASE_DATABASE_URL`.
- **Manual**: `npm run backup` (necesita `pg_dump` instalado).

## Restaurar (probarlo al menos una vez al mes)

1. Descarga el `.sql` del artifact más reciente (Actions → la última ejecución → Artifacts).
2. Crea una base **vacía** para la prueba (un proyecto nuevo de Supabase o `createdb prueba_restaurar` en tu compu).
3. Corre:
   ```bash
   RESTORE_DATABASE_URL="postgres://usuario:clave@host:5432/prueba_restaurar" npm run restaurar -- ruta/al/respaldo.sql
   ```
   Todo corre en una sola transacción: si algo falla, no queda nada a medias. Al final imprime cuántas empresas, usuarios, productos, ventas y cajas quedaron.
4. Para una emergencia real: restaura en una base nueva y cambia `DATABASE_URL` en Render a esa base. El script se niega a escribir sobre la de producción si no agregas `--confirmo-produccion`.

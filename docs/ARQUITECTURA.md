# SC POS — Arquitectura técnica

Punto de venta SaaS multiempresa y multisucursal. Dos repos:

| Pieza | Repo | Tecnología | Publica en |
|---|---|---|---|
| API | `Roaau/backCasaC` | Node 22 (ESM), Express 5, Sequelize 6 + PostgreSQL, Socket.IO | Render (auto-deploy desde `main`) |
| App | `Roaau/frontcasac` | Angular 19 standalone, RxJS, PWA (service worker) | Vercel (auto-deploy desde `main`) |
| Base | — | PostgreSQL en Supabase (RLS activado en todas las tablas) | — |

```
Navegador / app instalada (Vercel)
   │  HTTPS + JWT (Authorization: Bearer)        Socket.IO (escáner y alertas)
   ▼                                              ▼
Express (Render) ── middlewares ── rutas ── controladores ── Sequelize ── PostgreSQL (Supabase)
                   helmet, CORS, rate limit,
                   registrarErroresServidor,
                   verificarToken / verificarAdmin / verificarSuperAdmin,
                   requierePin, auditar
```

## Backend (`src/`)

- `server.js`: arranque, CORS, helmet, rate limits, montaje de rutas, Socket.IO, crons y columnas nuevas idempotentes (`ADD COLUMN IF NOT EXISTS`) para que un deploy no dependa de correr migraciones.
- `routes/` → `controllers/` → `models/` (Sequelize). SQL "a mano" con `sequelize.query` y `replacements` (nunca concatenar valores del usuario).
- `middleware/`
  - `authMiddleware.js`: `verificarToken` valida el JWT **y** revisa en la BD (caché 15 s) que el usuario siga activo, que su negocio no esté suspendido/vencido y que `sesion_version` coincida (cerrar sesión en todos los aparatos). Rol, empresa y sucursal salen de la BD, no del token.
  - `pinAutorizacion.js`: `requierePin(accion, condicion?)`. Si el dueño activó el PIN, el empleado manda `X-Pin-Autorizacion`; el admin nunca lo necesita. 5 fallos → 15 min bloqueado.
  - `auditar.js`: `auditar(accion, entidad, { antes?, detalle? })` guarda en `auditoria` cuando la respuesta sale bien. Es lo que alimenta la **Bitácora** del dueño.
- `utils/`
  - `scope.js`: **toda operación por sucursal pasa por aquí** (`resolverSucursalOperativa`, `resolverScopeSucursales`, `validarSucursalEmpresa`). Empleado solo su sucursal; admin cualquier sucursal activa de su empresa.
  - `filtros.js`: `filtroEmpresa()` para SQL crudo.
  - `pagos.js`: efectivo / terminal / transferencia / mixto. `sqlEfectivo('v')` etc. dan el monto por forma de cobro tanto de ventas nuevas (`monto_*`) como viejas (solo `tipo_pago`).
  - `planes.js`, `planLimits.js`, `giros.js`, `importarExcel.js`, `fechas.js`, `inventario.js`, `auditoria.js`.
- `services/`: `emailService.js` (Brevo), `correosAutomaticos.js` (resumen semanal y alertas).

### Reglas de negocio que no se deben romper

1. Una venta necesita **caja abierta del día** en esa sucursal; caja de un día anterior → 409 `requiere_cierre`.
2. El servidor recalcula totales y precios (`utils/ventas.js`); no confía en lo que manda el navegador.
3. El efectivo esperado del corte = inicial + ventas **en efectivo** + entradas − retiros − devoluciones en efectivo. Terminal y transferencia no entran al cajón.
4. Devolución/cancelación regresa al cajón solo lo cobrado en efectivo.
5. Todo dato de negocio se filtra por `empresa_id` (y `sucursal_id` cuando aplica). La prueba `tests/aislamiento-rutas.test.js` revisa el montaje de cada ruta.

### Crons (hora de México)

| Cuándo | Qué |
|---|---|
| cada 30 min | alerta de stock bajo por Socket.IO |
| 7:40 diario | correo de agotados / por caducar (si hay) |
| 8:10 lunes | resumen semanal por correo |
| 9:00 diario | aviso de vencimiento del plan (7 y 1 día antes) |

> En el plan gratis de Render el servidor se duerme; si está dormido a esa hora el cron no corre. Con el plan de pago sí.

### Tablas agregadas en octubre 2026

`usuarios.intentos_fallidos / bloqueado_hasta / sesion_version / ultimo_acceso`, `empresas.pin_autorizacion_* / correos_automaticos`, `ventas.monto_efectivo / monto_tarjeta / monto_transferencia / referencia_pago`, `errores_servidor`, `uso_pantallas`. Migraciones `20261031*`.

## Frontend (`src/app/`)

- Rutas lazy en `app.routes.ts`; guards `authGuard`, `adminGuard`, `superadminGuard`.
- `core/interceptors/auth.interceptor.ts`: pone el JWT, manda al login con mensaje cuando el servidor responde 401, y **pide el PIN y reintenta** cuando responde `PIN_REQUERIDO`.
- `core/errores.ts`: `mensajeError(err, 'cargar las ventas')` → texto claro para el usuario (sin conexión, permiso, servidor caído…).
- Servicios globales: `ToastService`, `ConfirmService`, `PinService`, `SucursalActivaService`, `NegocioService`, `UsoService` (cuenta visitas por pantalla).
- Librerías pesadas (`html5-qrcode`, `jspdf`, `chart.js`) se importan con `import()` solo cuando se usan.

## Pruebas y CI

- Back: `npm test` (Jest, modelos simulados; no necesita base). CI: `.github/workflows/pruebas.yml`.
- Front: `npm run build` y `ng test`. CI: `.github/workflows/pruebas.yml` del repo front.
- Respaldo diario: workflow `backup-supabase.yml`. Restaurar y probar: `docs/PUBLICAR.md`.

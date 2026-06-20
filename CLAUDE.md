# ANMA Hub — Contexto para Claude Code

## ¿Qué es este proyecto?
Dos SaaS en React/Vite para gestión de negocios pequeños, mercado argentino, idioma español rioplatense (vos/tenés). Dueña del producto: Ana (`ana.mbperalta@gmail.com`).

| App | Repo local | GitHub | Producción |
|---|---|---|---|
| **ANMA Hub** | `C:\Users\anamb\Downloads\ANMA\anma-app` | `anambperalta-droid/ANMA` | anmahub.com |
| **ANMA Regalos** | `C:\Users\anamb\Downloads\ANMA\anma-regalos` | `anambperalta-droid/ANMA-host` | anma-host.vercel.app |

Infra compartida: **un solo proyecto Supabase** (`paxsvjdimqlfxnlipplx`) — Auth + DB + RLS + Realtime. Aislamiento por `allowed_sites: ['hub']` / `['host']` en `user_metadata`.

---

## Stack
- React 19 + Vite 8 + react-router-dom v7
- Supabase (auth + DB + edge functions)
- Vercel (hosting + serverless `api/` + cron diario `api/cron-daily.js` a las 9:00 AR)
- MercadoPago CheckoutPro para cobros reales (ARS)
- EmailJS para envío de presupuestos por email

---

## Arquitectura de routing (ANMA Hub)
- `anmahub.com/` → landing (`index.html` en raíz del proyecto — HTML estático puro)
- `anmahub.com/app` → React SPA (`app/index.html` como entrada Vite MPA)
- `BrowserRouter` usa `basename="/app"` → todas las rutas React son relativas a `/app/`
- `vercel.json`: rewrites `/app` y `/app/(.*)` → `dist/app/index.html`

⚠️ **REGLA CRÍTICA de URLs (Hub):** `navigate()` y `<Link>` de react-router ya respetan el `basename="/app"` automáticamente. PERO cualquier URL construida a mano con `window.location.origin + '/ruta'`, `window.location.href = '/ruta'`, o un `redirectTo`/`emailRedirectTo` de Supabase debe incluir `/app` explícito (ej: `${window.location.origin}/app/bienvenida`). Esto aplica a: auth redirects (Login, Registro, reset password en AuthContext), back_urls de MP (mercadopago.js + api/mp-create-preference.js), y links compartidos (Alta→/app/clientes, Clientes→/app/alta, Proveedores→/app/portal-proveedor). En Regalos NO aplica (no tiene split /app).

---

## Datos y sync
**Fuente de verdad primaria = localStorage** (offline-first). Sincronización a Supabase via `src/lib/sync.js`:
- Sync se dispara en: `pagehide` + `visibilitychange` + `online` + `beforeunload` (fix para iOS Safari)
- Hook `setWriteHook` debe limpiarse a `null` en logout para evitar escrituras al workspace anterior

**Regla crítica de storage**: NUNCA usar `localStorage.getItem/setItem` con claves crudas en componentes. Siempre usar `db(key, fallback)` / `dbW(key, value)` de `src/lib/storage.js` — auto-prefijan con userId para aislar datos entre usuarios que comparten dispositivo.

---

## Patrones de seguridad (nunca violar)

1. **No `dangerouslySetInnerHTML`** para datos de APIs externas (MP, Sheets, Supabase). Renderizar siempre con JSX usando objetos estructurados `{ ok, message, ... }`.
2. **Vocabulario de roles**: `'owner'` / `'operator'` / `'viewer'`. Nunca `'admin'` ni `'user'` — el Edge Function `invite-user` los convierte silenciosamente a `'operator'`.
3. **`MP_ACCESS_TOKEN`** vive solo en env vars de Vercel (server-side). Nunca en el cliente ni en `.env` versionado.
4. **`service_role` key** de Supabase: solo en funciones serverless (`api/`), nunca en el cliente.
5. **`stockDeducted: true`** es el patrón correcto para idempotencia — el flag persiste en el presupuesto. NO usar la comparación de transición `wasQualifying` (no previene doble deducción en ciclos draft→qualifying→draft→qualifying).

---

## Restricciones del cliente (NO negociables)
- ❌ Nada con **Resend** (mala experiencia previa)
- ❌ Nada con **Telegram**
- ✅ Emails: solo Supabase Auth nativo (templates con Go conditionals)
- El `demo.html` debe reflejar SOLO features reales de la app — nada inventado

---

## Voz de marca
Cálida, cercana, empática. "Un respiro para tu día a día", "tu aliada". **NO** tono confrontativo, transaccional ni agresivo. Si se edita la landing, mantener esta voz.

---

## Modales (arquitectura CSS)
- `.modal-bg.open` → `display:flex; align-items:center; justify-content:center`
- Modales detalle (`cli-detail-card`, `prod-modal-card`, `pay-modal-card`) → `max-height: 95vh; height: auto`
- Modales form (`modal-form-card` sin clase detail) → crecen con contenido, sin height forzado

---

## Mapa de archivos clave (ANMA Hub)

```
anma-app/
├── index.html              ← landing (HTML estático, entrada Vite MPA)
├── app/index.html          ← entrada React SPA (entrada Vite MPA)
├── api/
│   ├── mp-create-preference.js   ← crea preferencia MP (back_urls usan /app/)
│   ├── mp-webhook.js             ← recibe notificación de pago
│   ├── mark-paid.js              ← activa workspace post-pago
│   └── cron-daily.js             ← cron 9:00 AR (expirar trials, etc.)
├── public/
│   ├── sw.js               ← Service Worker v4 network-first
│   ├── demo.html           ← demo interactivo (pasada 1/2 completa)
│   └── landing.html        ← redirect a / (no editar, contenido está en index.html)
└── src/
    ├── App.jsx             ← rutas + NavigateToNext + onboarding gate
    ├── main.jsx            ← BrowserRouter basename="/app" + SW register + chunk-error recovery
    ├── lib/
    │   ├── storage.js      ← db() / dbW() — SIEMPRE usar esto, nunca localStorage crudo
    │   ├── sync.js         ← DATA_KEYS (17 claves), push/pull Supabase, write hooks
    │   ├── supabase.js     ← cliente (flowType pkce, detectSessionInUrl true)
    │   ├── subscription.js ← STATUS, MONTHLY=30000, ONBOARDING=120000, getBillingStatus
    │   ├── metrics.js      ← MRR/churn/LTV/funnel/series para /admin
    │   └── acquisitionTracking.js  ← captura UTM first-touch + persist cross-OAuth
    └── components/pages/
        ├── Bienvenida.jsx  ← detectSession robusto (PKCE race, webview, token legacy)
        ├── Registro.jsx    ← email+Google con acquisition en metadata
        ├── Admin.jsx       ← tabs metrics/trials/billing/paid + realtime signups
        ├── Activar.jsx     ← flow de pago MP
        └── Onboarding.jsx  ← guard anti-repetición (si rubro ya seteado → /)
```

---

## Deploy
```bash
git add <archivos>
git commit -m "descripción"
git push origin main
# Vercel auto-deploya en ~90s
```
**PowerShell**: no uses `&&` para encadenar comandos — usar `;` o `if ($?) { ... }`.

---

## Modelo de negocio (Hub)
- Trial 7 días gratis → $120.000 ARS pago de ingreso (onboarding) + $30.000/mes
- Workspace se activa automáticamente via webhook MP (`mark-paid.js`)
- Admin global: `ana.mbperalta@gmail.com` (único con acceso a `/admin`)

---

## Supabase
- Proyecto: `paxsvjdimqlfxnlipplx`
- Redirect URLs configuradas: `https://anmahub.com/app/login`, `https://anmahub.com/app/bienvenida`
- Templates de email: `SUPABASE_EMAIL_TEMPLATES.md` (usan `token_hash` directo, inmunes al prefetch de Gmail)
- Channel tracking SQL: `SUPABASE_CHANNEL_TRACKING.sql` — ya ejecutado en prod

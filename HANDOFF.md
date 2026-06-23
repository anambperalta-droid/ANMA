# HANDOFF — ANMA Hub

> Documento de traspaso para retomar el trabajo en un chat nuevo.
> Última actualización: **23/06/2026**.

---

## 1. Qué es / dónde está

- **ANMA Hub** — SaaS de gestión para comercios argentinos (clientes, pedidos, stock, caja, comunicación por WhatsApp).
- **Stack:** React 19 + Vite (MPA), Supabase (Auth + DB + RLS + RPC + Realtime), Vercel (hosting + serverless `/api/`), MercadoPago (pagos), PWA.
- **Estructura MPA:** `index.html` = **landing** (en `/`); `app/index.html` = **SPA React** (en `/app`, `BrowserRouter basename="/app"`).
- **Local:** `C:\Users\anamb\Downloads\ANMA\anma-app`
- **Repo:** `anambperalta-droid/ANMA` · **Producción:** https://anmahub.com
- **App hermana:** **ANMA Regalos** (repo `anambperalta-droid/ANMA-host`, local `anma-regalos`, prod anma-host.vercel.app). Comparte el **mismo proyecto Supabase** (`paxsvjdimqlfxnlipplx`).

## 2. Cómo deployar

```bash
cd "C:\Users\anamb\Downloads\ANMA\anma-app"
npm run build           # valida que no rompió nada
git add <archivos>
git commit -m "..."     # firmar con Co-Authored-By
git push origin main    # Vercel auto-deploya
```
- Hard-refresh (`Ctrl+Shift+R`) para ver cambios: fuentes y CSS cachean.
- Los archivos en `public/` (recursos, sitemap, favicons) se copian tal cual al deploy.
- Vercel `cleanUrls:true` → las URLs `.html` hacen 308 a la versión sin extensión.

## 3. Reglas de trabajo (IMPORTANTE)

- **NO cambiar la estética de la app interna** (`/app`). A Ana le gusta como está. Los rediseños son **solo landing (`index.html`) + recursos (`public/recursos/`)**.
- **Sin emojis** en ningún lado (templates, portal, copy).
- **Voz de marca:** cálida, no agresiva. Español argentino (vos/tenés).
- **Admin global:** ana.mbperalta@gmail.com
- **Secretos** (MP_ACCESS_TOKEN, service_role) **solo server-side** en `/api/` + env vars de Vercel. Nunca en el cliente.

## 4. Sistema de diseño (definido y aplicado)

| Uso | Fuente | Detalle |
|-----|--------|---------|
| Títulos display (h1/h2/h3 landing y artículos) | **Fraunces** serif | weight 600, editorial |
| Wordmark "ANMA Hub" (nav/logo/Login/Sidebar) | **Poppins** | weight 600, letter-spacing .2px |
| Cuerpo / UI | **Inter** | 400–700 |

- **Violeta institucional: `#7C3AED`** (un solo tono; los degradados del hero usan tints).
- ❌ **Nunca Inter weight 900** para títulos ni wordmark (Ana lo rechazó: "tosco, rígido").
- ❌ **Nunca íconos multicolor** en las tarjetas/features del landing (Ana lo rechazó: "colorinche"). Íconos unificados en violeta.
- **Control de viudas:** `text-wrap:balance` en títulos, `text-wrap:pretty` en párrafos/listas. (Método responsive-safe, no usar `white-space:nowrap` fijo.)

## 5. Hecho en la sesión 23/06 (todo deployado)

1. Wordmark Poppins (landing + recursos + app Login/Sidebar).
2. Títulos Fraunces en el landing.
3. **CORS restringido al dominio** en Hub → `api/_cors.js` aplicado en `mp-create-preference.js`, `mark-paid.js`, `mp-proxy.js` (antes `Access-Control-Allow-Origin: *`).
4. URLs limpias de recursos (sin `.html`) en canonical/og/sitemap/links internos.
5. CTAs de cierre contextuales por artículo.
6. Landing: títulos +4px, paddings compactos, fondos violeta glow (radiales), gradiente del h1 violeta→rosa (sacado el verde disonante), números 01/02/03 en gradiente violeta.
7. Landing: íconos de las 6 features y los 4 rubros **unificados a violeta** (paneles de rubro a tinte violeta uniforme `#f5f2fc`).
8. Recursos: viudas (`text-wrap`), avatar AH violeta vibrante (`#7C3AED→#5B21B6`), medida de lectura 748px, barra lateral de h2 refinada, acento gradiente bajo el h1, **nav con "← Recursos"**, números de listas ordenadas en negro.

## 6. Pendientes

### 🔔 Recordar a Ana / retomar
- **CORS en ANMA Regalos** — replicar `api/_cors.js` (allowlist en vez de `*`) en las funciones de pago de `anma-regalos`. En Hub ya está hecho.

### Código (opcional)
- **Inconsistencia en recursos:** los 5 artículos VIEJOS tienen el bloque `.author` **antes** del `<h1>` (orden meta→author→h1→lead); los 4 nuevos lo tienen **después** (meta→h1→author→lead). Unificar a meta→h1→author→lead en: `control-de-stock-tienda-de-ropa`, `excel-vs-sistema-de-gestion`, `gestion-almacen-distribuidora`, `gestion-local-decoracion`, `stock-tecnologia-electronica`.
- **Sofisticación recursos (propuesto, no hecho):** pull-quotes destacadas dentro del texto, divisor gradiente sutil entre secciones, mejorar tarjetas del índice de recursos.
- **Landing (propuesto):** color por categoría en los 3 pasos de "Cómo funciona"; asimetría estructural más marcada.

### Acciones manuales de Ana (paneles web, no tocan código)
- Probar un **pago MercadoPago real end-to-end** (verificar flujo tras CORS + redeploy).
- **Re-indexar en Google Search Console** las URLs limpias de recursos (sin `.html`) + los 4 artículos nuevos.
- Activar **Vercel Firewall** (Attack Challenge Mode + rate-limit en `/api/`) — único gap de la auditoría de seguridad.

## 7. Estado de seguridad (Hub)

- ✅ Security headers completos en `vercel.json` (CSP, HSTS+preload, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy).
- ✅ CORS restringido al dominio (`api/_cors.js`).
- ✅ RLS ON en las 16 tablas (Supabase compartido, migraciones en `supabase/migrations/`).
- ⚠️ Pendiente: rate-limiting a nivel app (Vercel Firewall) + replicar CORS en Regalos.

## 8. Gotchas / notas técnicas

- El **preview local** (Claude_Preview MCP) no levanta acá: el harness corre desde una ruta de sistema (`C:\ProgramData\...`), no desde el proyecto. Trabajar leyendo el código + screenshots de Ana.
- Recursos viven en `public/recursos/`: `index.html` (índice) + 9 artículos + `article.css` (estilos compartidos de los artículos).
- Mobile: al cambiar tamaños de título o paddings, revisar las media queries (`@media(max-width:640px)` y `780px`) para no romper responsive.
- Memoria del asistente (persistente entre chats): `MEMORY.md` + `feedback_typography_system.md` + `project_pending_manual.md` en la carpeta de memoria del proyecto.

---
*Generado con Claude Code.*

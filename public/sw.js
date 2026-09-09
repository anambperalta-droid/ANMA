/* ANMA Hub — Service Worker v10
   Network-first para JS/CSS/HTML (anti cache-stale).
   Stale-while-revalidate para imágenes/fonts.
   Bypass total para Supabase y APIs.
   v5: fuerza limpieza de caché tras agregar el viewport meta a la landing.
   v6: limpia los íconos viejos cacheados tras actualizar el logo (favicon/PWA).
   v7: registro con updateViaCache:none + skipWaiting activo → updates se ven solos.
   v8: bump para forzar limpieza tras cambios masivos de UI mobile en Logistica.
   v9: bump adicional — Ana no veia updates desde el cel. Forzamos refresh
       de todos los usuarios con PWA instalada.
   v10: bump — Config mobile responsive + Importador en Sidebar desktop +
        header Presupuesto compacto + footer landing más chico.
   v11: bump — Clientes: kebab menu (3 puntos) en mobile card + botones tabla
        desktop reducidos 32→28.
   v12: bump — Proveedores: mismo patrón kebab menu (3 puntos) en mobile card.
   v13: bump — Config consolidado 8 tabs → 4 tabs (Mi negocio, Ventas y cobros,
        Herramientas, Cuenta) + Módulos y Listas colapsables.
   v14: bump — Ventas layout compacto: campos cortos en 2 col fijas (mobile
        incluido), dropdowns largos full width. Menos scroll vertical.
   v15: bump — Textos generales auto-grow (field-sizing) + WhatsApp card
        Herramientas compactada (4 feature-boxes → 1 sola línea + details).
   v16: bump — Revert Config a 8 tabs separados (feedback: 4 tabs mezclaban).
        Tab strip rediseñado: mobile icon-only, activo con label. Más liviano.
        + Mensajes: header con título + iOS zoom fix search.
   v17: bump — Mensajes mobile: tabs sin scroll horizontal (icon-only inactivos,
        active con label), header compacto (CTA icon-only, sub oculto).
   v18: bump — Config tabs fix: bug de labels pegoteados. Aplica patrón
        dashboard (icon+long+short), mobile píldoras verticales.
   v19: bump — Config polish: banner Módulos wrap text (evita chunks flex) +
        EmailJS fields en 2 filas 2x2 (Service+Template / PubKey+Email prueba).
   v20: bump — Config: coach messages por sección (voz ANMA rioplatense pro,
        directa, sin jerga) + Datos de contacto en 2 col mobile.
   v21: bump — Seguimiento cards rediseño mobile: layout grid + acciones full-width
        con labels (44px touch target). Menos saturación, más claridad.
   v22: bump — Seguimiento desktop alineado con estética Clientes/Proveedores:
        chip DÍAS más chico, tipografía calmada, botones 28x28 borde neutral,
        WhatsApp con tint verde suave (no fill dominante).
   v23: bump — Fase B: admin_alerts table + hook + NotificationBell extendido.
        Badge in-app persistente en TODA la app (no solo /admin). Realtime
        de nuevos signups + pagos + errores. Ana ve las 3 alertas juntas
        con las locales, sin duplicar UI.
   v24: bump — MilestoneToast: refuerzos positivos en momentos clave
        (primer cliente, primer producto, N presupuestos). Toast en esquina
        con confetti minimalista, no invasivo.
*/
const CACHE_VER = 'anma-pro-v24'
const RUNTIME = `${CACHE_VER}-runtime`
const OFFLINE_FALLBACK = `${CACHE_VER}-offline`

const PRECACHE = ['/', '/index.html', '/app/index.html', '/manifest.webmanifest', '/favicon.svg']

const BYPASS_PATTERNS = [
  'supabase.co', 'googleapis.com', 'gstatic.com',
  'cdnjs.cloudflare.com', 'wa.me', '/auth', '/api',
]

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(OFFLINE_FALLBACK)
      .then(c => c.addAll(PRECACHE))
      .catch(() => { /* silenciar offline */ })
  )
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys
      .filter(k => k !== RUNTIME && k !== OFFLINE_FALLBACK)
      .map(k => caches.delete(k))
    )
    await self.clients.claim()
    const clients = await self.clients.matchAll({ type: 'window' })
    clients.forEach(c => c.postMessage({ type: 'SW_ACTIVATED', version: CACHE_VER }))
  })())
})

self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', e => {
  const { request } = e
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  // Solo cacheamos http/https. chrome-extension://, data:, blob:, etc. tiran
  // "Request scheme 'chrome-extension' is unsupported" en Cache.put → bypass total.
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return

  const isBypass = BYPASS_PATTERNS.some(p =>
    url.hostname.includes(p) || url.pathname.startsWith(p)
  )
  if (isBypass) return

  const isMedia = /\.(svg|png|jpg|jpeg|webp|woff2?|ttf|ico)(\?|$)/.test(url.pathname)
  if (isMedia) {
    e.respondWith((async () => {
      const cache = await caches.open(RUNTIME)
      const cached = await cache.match(request)
      const fetchPromise = fetch(request).then(res => {
        if (res.ok) cache.put(request, res.clone())
        return res
      }).catch(() => cached)
      return cached || fetchPromise
    })())
    return
  }

  e.respondWith((async () => {
    try {
      const fresh = await fetch(request, { cache: 'no-store' })
      if (fresh.ok) {
        const cache = await caches.open(RUNTIME)
        cache.put(request, fresh.clone())
      }
      return fresh
    } catch {
      const cached = await caches.match(request)
      return cached || caches.match(url.pathname.startsWith('/app') ? '/app/index.html' : '/index.html')
    }
  })())
})

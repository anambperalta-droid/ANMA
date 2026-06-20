/* ANMA Hub — Service Worker v4
   Network-first para JS/CSS/HTML (anti cache-stale).
   Stale-while-revalidate para imágenes/fonts.
   Bypass total para Supabase y APIs.
*/
const CACHE_VER = 'anma-pro-v4'
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

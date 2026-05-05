/* ANMA Pro — Service Worker v3
   Estrategia: Network-first para API/auth, Cache-first para assets estáticos
*/
const CACHE_VER = 'anma-pro-v3'
const STATIC_CACHE = `${CACHE_VER}-static`
const DYNAMIC_CACHE = `${CACHE_VER}-dynamic`

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
]

const BYPASS_PATTERNS = [
  'supabase.co',
  'googleapis.com',
  'gstatic.com',
  'cdnjs.cloudflare.com',
  'wa.me',
]

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(STATIC_CACHE)
      .then(c => c.addAll(PRECACHE_URLS))
      .catch(() => {})
  )
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== STATIC_CACHE && k !== DYNAMIC_CACHE)
          .map(k => caches.delete(k))
      )
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', e => {
  const { request } = e
  const url = new URL(request.url)

  if (request.method !== 'GET') return

  const isBypass = BYPASS_PATTERNS.some(p => url.hostname.includes(p)) ||
    url.pathname.startsWith('/auth') ||
    url.pathname.startsWith('/api')
  if (isBypass) return

  const isStaticAsset = /\.(js|css|svg|png|jpg|webp|woff2?|ttf|ico)(\?|$)/.test(url.pathname)
  if (isStaticAsset) {
    e.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached
        return fetch(request).then(res => {
          if (res.ok) caches.open(STATIC_CACHE).then(c => c.put(request, res.clone()))
          return res
        })
      })
    )
    return
  }

  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then(res => {
          if (res.ok) caches.open(DYNAMIC_CACHE).then(c => c.put(request, res.clone()))
          return res
        })
        .catch(() =>
          caches.match(request).then(cached => cached || caches.match('/index.html'))
        )
    )
    return
  }

  e.respondWith(
    fetch(request)
      .then(res => {
        if (res.ok) caches.open(DYNAMIC_CACHE).then(c => c.put(request, res.clone()))
        return res
      })
      .catch(() => caches.match(request))
  )
})

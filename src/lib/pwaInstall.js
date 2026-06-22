/* ─────────────────────────────────────────────
 * PWA install — captura global del evento beforeinstallprompt
 * Permite tener un botón "Instalar app" siempre visible (no el banner
 * dismissible). Captura el evento apenas el navegador lo dispara.
 * ───────────────────────────────────────────── */

let deferredPrompt = null
const subs = new Set()
const notify = () => subs.forEach(fn => { try { fn() } catch { /* noop */ } })

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    notify()
  })
}

export const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true)

export const isIOS = () =>
  typeof navigator !== 'undefined' &&
  /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream

export const canPromptInstall = () => !!deferredPrompt

export const promptInstall = async () => {
  if (!deferredPrompt) return false
  deferredPrompt.prompt()
  const { outcome } = await deferredPrompt.userChoice
  if (outcome === 'accepted') deferredPrompt = null
  notify()
  return outcome === 'accepted'
}

/** Suscribe a cambios de disponibilidad (devuelve fn de unsubscribe). */
export const subscribeInstall = (fn) => { subs.add(fn); return () => subs.delete(fn) }

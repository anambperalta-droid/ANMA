/**
 * ANMA — Captura de canal de adquisición.
 *
 * Estrategia "first-touch attribution":
 *   - La PRIMERA vez que un visitor anónimo aterriza con UTM params o un
 *     referrer relevante, lo guardamos en sessionStorage.
 *   - Si después navega por la app (landing → demo → registro), preservamos
 *     ese first touch — no se sobreescribe con visitas internas posteriores.
 *   - Al hacer signUp, mandamos esos datos al user_metadata de Supabase.
 *   - Un trigger SQL los copia automáticamente al workspace nuevo.
 *
 * Por qué first-touch: si Belu nos manda un cliente por WhatsApp y el cliente
 * después busca "ANMA argentina" en Google y entra desde ahí, queremos saber
 * que el origen fue Belu (referido), no Google.
 */

const STORAGE_KEY = 'anma_acquisition'

/**
 * Clasificador de canal: convierte source/medium/referrer en una categoría
 * limpia para el breakdown del dashboard.
 */
function inferChannel({ source, medium, referrer }) {
  const s = (source || '').toLowerCase()
  const m = (medium || '').toLowerCase()
  const r = (referrer || '').toLowerCase()

  if (s.includes('instagram') || s === 'ig' || r.includes('instagram.com')) return 'instagram'
  if (s.includes('whatsapp') || s === 'wa' || r.includes('wa.me') || r.includes('whatsapp')) return 'whatsapp'
  if (s.includes('facebook') || s === 'fb' || r.includes('facebook.com')) return 'facebook'
  if (s.includes('tiktok') || r.includes('tiktok.com')) return 'tiktok'
  if (s.includes('linkedin') || r.includes('linkedin.com')) return 'linkedin'
  if (s.includes('google') || r.includes('google.com') || r.includes('google.com.ar')) return 'google'
  if (s.includes('email') || m.includes('email')) return 'email'
  if (s.includes('referido') || m.includes('referral') || s.includes('referral')) return 'referido'
  if (s.includes('youtube') || r.includes('youtube.com')) return 'youtube'

  // Si hay referrer pero no matchea ninguno conocido, es "otro sitio"
  if (referrer) {
    try {
      const host = new URL(referrer).hostname.replace('www.', '')
      // No contar la propia app como referrer
      if (host.includes('anmahub.com') || host.includes('anma-hub.vercel.app') || host.includes('anma-host.vercel.app')) return null
      return host    // ej. 'reddit.com'
    } catch { /* ignorar URL inválida */ }
  }

  // Sin UTM ni referrer → entró tipeando la URL o desde un bookmark
  return 'directo'
}

/**
 * Lee la URL actual + document.referrer y devuelve un objeto de acquisition.
 * Si hay datos relevantes, los persiste en sessionStorage (first-touch).
 *
 * Llamar al inicio de la sesión (idealmente desde el landing/registro).
 */
export function captureAcquisitionFromUrl() {
  if (typeof window === 'undefined') return null

  // Si ya capturamos en esta sesión, no sobreescribimos (first-touch wins)
  try {
    const existing = sessionStorage.getItem(STORAGE_KEY)
    if (existing) return JSON.parse(existing)
  } catch { /* ignorar */ }

  const url = new URL(window.location.href)
  const params = url.searchParams

  const data = {
    acquisition_source: params.get('utm_source') || null,
    utm_medium:         params.get('utm_medium') || null,
    utm_campaign:       params.get('utm_campaign') || null,
    utm_content:        params.get('utm_content') || null,
    referrer:           document.referrer || null,
    landing_page:       window.location.href.slice(0, 500),  // cap a 500 chars
  }

  data.acquisition_channel = inferChannel({
    source: data.acquisition_source,
    medium: data.utm_medium,
    referrer: data.referrer,
  })

  // Si no hay NADA útil (sin UTM, sin referrer externo) → 'directo'
  // Lo guardamos igual para que el primer touch quede registrado.
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch { /* ignorar */ }

  return data
}

/**
 * Devuelve los datos de acquisition capturados, o captura si todavía no lo hicimos.
 * Usar en Registro.jsx al hacer signUp y en Bienvenida.jsx después de OAuth.
 */
export function getAcquisitionData() {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignorar */ }
  return captureAcquisitionFromUrl()
}

/**
 * Persiste acquisition data en localStorage TAMBIÉN (no sólo session) para
 * sobrevivir al redirect de Google OAuth (Google abre /bienvenida en nueva
 * navegación y sessionStorage no siempre se preserva).
 *
 * Llamar JUSTO antes de redirigir a Google.
 */
export function persistAcquisitionAcrossOAuth() {
  const data = getAcquisitionData()
  if (!data) return
  try {
    localStorage.setItem(STORAGE_KEY + '_oauth', JSON.stringify({
      ...data,
      _savedAt: Date.now(),
    }))
  } catch { /* ignorar */ }
}

/**
 * Recupera acquisition data después de OAuth y la limpia.
 * Sólo válido si fue guardada en los últimos 10 minutos (anti-stale).
 */
export function consumeAcquisitionAfterOAuth() {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY + '_oauth')
    if (!raw) return null
    const data = JSON.parse(raw)
    localStorage.removeItem(STORAGE_KEY + '_oauth')
    if (data._savedAt && Date.now() - data._savedAt > 10 * 60 * 1000) return null
    delete data._savedAt
    return data
  } catch {
    return null
  }
}

/**
 * Limpia los datos guardados (después de un signUp exitoso para no contaminar
 * un signUp posterior con la misma data si el browser se reutiliza).
 */
export function clearAcquisitionData() {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(STORAGE_KEY + '_oauth')
  } catch { /* ignorar */ }
}

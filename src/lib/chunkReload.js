/* ─────────────────────────────────────────
   ANMA — Auto-recovery de chunks viejos
   ─────────────────────────────────────────
   Tras un deploy, el browser puede tener el index.html viejo en caché y pedir
   chunks con hash que ya no existen ("Failed to fetch dynamically imported
   module"). En vez de mostrar "Algo salió mal", recargamos UNA vez para traer
   la versión nueva. Anti-loop: máximo 1 reload cada 30s.
─────────────────────────────────────────── */
const CHUNK_RELOAD_KEY = 'anma_chunk_reloaded_at'

export function isChunkLoadError(err) {
  const msg = String(err?.message || err || '').toLowerCase()
  return msg.includes('failed to fetch dynamically imported module')
      || msg.includes('failed to load module script')
      || msg.includes('importing a module script failed')
      || msg.includes('error loading dynamically imported module')
      || msg.includes('failed to fetch') && msg.includes('.js')
}

/**
 * Si el error es de chunk viejo, recarga una vez (con anti-loop) y devuelve true.
 * Si no aplica o ya recargamos hace poco, devuelve false.
 */
export function maybeReloadOnChunkError(err) {
  if (!isChunkLoadError(err)) return false
  const last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || 0)
  if (Date.now() - last < 30_000) return false   // ya recargamos recién → no loop
  sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()))
  window.location.reload()
  return true
}

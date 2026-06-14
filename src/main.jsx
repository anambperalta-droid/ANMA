import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { DataProvider } from './context/DataContext'
import { ToastProvider } from './context/ToastContext'
import { ConfirmProvider } from './context/ConfirmContext'
import App from './App'
import './index.css'
import { bootstrapSafeBackup } from './lib/safeBackup'

// Auto-snapshot a IndexedDB (anti-pérdida de localStorage)
bootstrapSafeBackup()

// ── Auto-recovery cuando el browser tiene index.html viejo cacheado y
//    los chunks con hash nuevos no existen ("Failed to fetch dynamically
//    imported module"). En vez de mostrar "Algo salió mal", reload una vez.
const CHUNK_RELOAD_KEY = 'anma_chunk_reloaded_at'
function isChunkLoadError(err) {
  const msg = String(err?.message || err || '').toLowerCase()
  return msg.includes('failed to fetch dynamically imported module')
      || msg.includes('failed to load module script')
      || msg.includes('importing a module script failed')
      || msg.includes('error loading dynamically imported module')
}
function maybeReloadOnChunkError(err) {
  if (!isChunkLoadError(err)) return false
  // Anti-loop: solo recargar 1 vez cada 30s
  const last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || 0)
  if (Date.now() - last < 30_000) return false
  sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()))
  // Reload bypaseando cache para traer el index.html nuevo
  window.location.reload()
  return true
}
window.addEventListener('error', (e) => { if (e.error) maybeReloadOnChunkError(e.error) })
window.addEventListener('unhandledrejection', (e) => { if (e.reason) maybeReloadOnChunkError(e.reason) })

// Registrar Service Worker + auto-update sin que el user limpie cache.
// El SW v4 manda postMessage 'SW_ACTIVATED' al activarse → reload automático una vez.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data?.type === 'SW_ACTIVATED') {
      const flag = 'anma_sw_reloaded_' + (e.data.version || '')
      if (!sessionStorage.getItem(flag)) {
        sessionStorage.setItem(flag, '1')
        window.location.reload()
      }
    }
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <ConfirmProvider>
          <AuthProvider>
            <DataProvider>
              <App />
            </DataProvider>
          </AuthProvider>
        </ConfirmProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>
)

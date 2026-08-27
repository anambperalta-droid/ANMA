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
import { maybeReloadOnChunkError } from './lib/chunkReload'

// Auto-snapshot a IndexedDB (anti-pérdida de localStorage)
bootstrapSafeBackup()

// ── Auto-recovery de chunks viejos (deploy nuevo + index.html cacheado) ──
window.addEventListener('error', (e) => { if (e.error) maybeReloadOnChunkError(e.error) })
window.addEventListener('unhandledrejection', (e) => { if (e.reason) maybeReloadOnChunkError(e.reason) })
// Evento canónico de Vite cuando un import dinámico falla (cubre los lazy())
window.addEventListener('vite:preloadError', (e) => {
  if (maybeReloadOnChunkError(e.payload || e)) e.preventDefault()
})

// Registrar Service Worker + auto-update sin que el user limpie cache.
// El SW v4 manda postMessage 'SW_ACTIVATED' al activarse → reload automático una vez.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // updateViaCache:'none' → el sw.js NUNCA se sirve de caché HTTP, así reg.update()
    // siempre ve la versión nueva. + activamos el SW en espera al toque.
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then(reg => {
      reg.update()
      if (reg.waiting) reg.waiting.postMessage('SKIP_WAITING')
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing
        if (nw) nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) nw.postMessage('SKIP_WAITING')
        })
      })
    }).catch(() => {})
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
    <BrowserRouter basename="/app">
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

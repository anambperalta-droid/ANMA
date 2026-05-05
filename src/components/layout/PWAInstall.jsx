/**
 * PWAInstall — Banner de instalación inteligente
 * ‣ Android/Chrome: captura beforeinstallprompt → botón nativo
 * ‣ iOS/Safari: muestra instrucciones manuales (Share → Agregar)
 * ‣ Se descarta y no vuelve a aparecer en 30 días
 */
import { useState, useEffect } from 'react'

const DISMISS_KEY = 'anma_pwa_dismissed'
const DISMISS_DAYS = 30

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream
}
function isInStandaloneMode() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
}
function wasDismissed() {
  try {
    const ts = localStorage.getItem(DISMISS_KEY)
    if (!ts) return false
    return Date.now() - Number(ts) < DISMISS_DAYS * 86400000
  } catch { return false }
}
function dismiss() {
  try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch { /* ignore */ }
}

export default function PWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [show, setShow] = useState(false)
  const [mode, setMode] = useState(null) // 'android' | 'ios'
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    if (isInStandaloneMode()) return
    if (wasDismissed()) return

    if (isIOS()) {
      const t = setTimeout(() => { setMode('ios'); setShow(true) }, 3000)
      return () => clearTimeout(t)
    }

    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setMode('android')
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    setInstalling(true)
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    setInstalling(false)
    setDeferredPrompt(null)
    if (outcome === 'accepted') handleDismiss()
  }

  const handleDismiss = () => { dismiss(); setShow(false) }

  if (!show) return null

  const banner = {
    position: 'fixed',
    bottom: 0, left: 0, right: 0,
    zIndex: 9800,
    background: 'linear-gradient(135deg, #1C1045 0%, #2D1A6E 100%)',
    borderTop: '1px solid rgba(124,58,237,.4)',
    boxShadow: '0 -8px 32px rgba(0,0,0,.4)',
    padding: '14px 16px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    animation: 'slideUp .3s cubic-bezier(.4,0,.2,1) both',
  }

  const icon = {
    width: 44, height: 44, borderRadius: 12,
    background: 'linear-gradient(135deg,#7C3AED,#4F46E5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, fontSize: 22,
    boxShadow: '0 4px 12px rgba(124,58,237,.45)',
  }

  const btnInstall = {
    display: 'flex', alignItems: 'center', gap: 6,
    marginTop: 10, padding: '8px 16px',
    background: 'linear-gradient(135deg,#7C3AED,#4F46E5)',
    border: 'none', borderRadius: 8,
    color: '#fff', fontSize: 12, fontWeight: 700,
    cursor: 'pointer', fontFamily: 'inherit',
    boxShadow: '0 4px 14px rgba(124,58,237,.4)',
    transition: 'opacity .15s',
  }

  const btnClose = {
    width: 28, height: 28, borderRadius: 8,
    background: 'rgba(255,255,255,.1)',
    border: '1px solid rgba(255,255,255,.15)',
    color: 'rgba(255,255,255,.6)',
    cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 12, flexShrink: 0, fontFamily: 'inherit',
  }

  return (
    <>
      <style>{`@keyframes slideUp{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
      <div style={banner}>
        <div style={icon}>⚡</div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', marginBottom: 2, letterSpacing: '-.2px' }}>
            Instalá ANMA Pro en tu celular
          </div>

          {mode === 'android' && (
            <>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.65)', lineHeight: 1.45 }}>
                Para una mejor experiencia, instalá la app en tu pantalla de inicio — sin barra del navegador, acceso rápido.
              </div>
              <button
                style={{ ...btnInstall, opacity: installing ? .6 : 1 }}
                onClick={handleInstall}
                disabled={installing}
              >
                <i className="fa fa-download" style={{ fontSize: 11 }} />
                {installing ? 'Instalando...' : 'Instalar app'}
              </button>
            </>
          )}

          {mode === 'ios' && (
            <>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.65)', lineHeight: 1.45 }}>
                Tocá{' '}
                <span style={{ color: '#fff', fontWeight: 700 }}>
                  <i className="fa fa-arrow-up-from-bracket" style={{ margin: '0 2px', fontSize: 11 }} />
                  Compartir
                </span>
                {' '}y luego{' '}
                <span style={{ color: '#fff', fontWeight: 700 }}>
                  "Agregar a pantalla de inicio"
                </span>
                {' '}para acceder como app.
              </div>
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.15)', borderRadius: 8, padding: '5px 10px', alignItems: 'center' }}>
                  <i className="fa fa-arrow-up-from-bracket" style={{ fontSize: 13, color: '#60a5fa' }} />
                  <span style={{ fontSize: 11, color: '#60a5fa', fontWeight: 600 }}>Compartir</span>
                </div>
                <i className="fa fa-arrow-right" style={{ fontSize: 10, color: 'rgba(255,255,255,.4)' }} />
                <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.15)', borderRadius: 8, padding: '5px 10px', alignItems: 'center' }}>
                  <i className="fa fa-plus" style={{ fontSize: 12, color: '#4ade80' }} />
                  <span style={{ fontSize: 11, color: '#4ade80', fontWeight: 600 }}>Agregar</span>
                </div>
              </div>
            </>
          )}
        </div>

        <button style={btnClose} onClick={handleDismiss} title="Cerrar"
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.18)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,.1)' }}>
          <i className="fa fa-xmark" />
        </button>
      </div>
    </>
  )
}

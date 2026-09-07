import { useLocation } from 'react-router-dom'
import { useEffect, useState, useRef } from 'react'

const PAGE_NAMES = { '/': 'Dashboard', '/presupuesto': 'Presupuesto', '/clientes': 'Clientes', '/catalogo': 'Productos', '/proveedores': 'Proveedores', '/logistica': 'Logística', '/mensajes': 'Mensajes WhatsApp', '/insumos': 'Insumos', '/config': 'Configuración' }

const THEME_KEY = 'anma_theme'

// Aplica el theme guardado al cargar la app. La lógica de UI (toggle claro/oscuro)
// vive en el Sidebar → Ajustes rápidos, pero conservamos el effect acá para
// asegurar que el atributo data-theme quede seteado en cada render del shell.
function initialTheme() {
  if (typeof window === 'undefined') return 'light'
  const saved = localStorage.getItem(THEME_KEY)
  if (saved === 'dark' || saved === 'light') return saved
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

// Cloud sync status: 'ok' | null — se muestra como banda sutil transitoria bajo el título
function useSyncStatus() {
  const [status, setStatus] = useState(null)
  const timer = useRef(null)
  useEffect(() => {
    const onSaved = () => {
      setStatus('ok')
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setStatus(null), 3000)
    }
    window.addEventListener('anma:cloud-saved', onSaved)
    window.addEventListener('anma:synced', onSaved)
    return () => {
      window.removeEventListener('anma:cloud-saved', onSaved)
      window.removeEventListener('anma:synced', onSaved)
      clearTimeout(timer.current)
    }
  }, [])
  return status
}

export default function Topbar({ onMenuClick, onCollapseClick, collapsed }) {
  const loc = useLocation()
  const title = PAGE_NAMES[loc.pathname] || 'ANMA'
  const [theme] = useState(initialTheme)
  const syncStatus = useSyncStatus()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  return (
    <header className="topbar">
      <button className="tb-btn tb-btn-menu" onClick={onMenuClick} aria-label="Menú">
        <i className="fa fa-bars" />
      </button>
      {/* Desktop sidebar collapse toggle */}
      <button
        className="tb-btn tb-btn-collapse"
        onClick={onCollapseClick}
        title={collapsed ? 'Expandir menú lateral' : 'Colapsar menú lateral'}
        aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
      >
        <i className="fa fa-table-columns" />
      </button>
      <span className="tb-page-title">{title}</span>
      <div style={{ flex: 1 }} />

      {/* Cloud sync indicator — único elemento que aparece a la derecha (transitorio) */}
      {syncStatus && (
        <div title="Datos guardados en la nube" style={{
          display: 'flex', alignItems: 'center', gap: 4,
          fontSize: 11, fontWeight: 600, padding: '0 8px', height: 28,
          borderRadius: 8, transition: 'all .3s',
          background: '#D1FAE5', color: '#065F46',
          border: '1px solid #A7F3D0',
          flexShrink: 0,
        }}>
          <i className="fa fa-cloud-arrow-up" style={{ fontSize: 12 }} />
          <span className="hide-xs">Guardado</span>
        </div>
      )}
      {/* Ojo/Campana/Cerebro/Sol se eliminaron del header — evita duplicidad con
          los Ajustes rápidos del Sidebar (única fuente de verdad para estos
          controles). El header ahora respira solo con menú + título. */}
    </header>
  )
}

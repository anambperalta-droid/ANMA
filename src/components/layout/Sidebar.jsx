import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useData } from '../../context/DataContext'
import { useTaskFab } from '../../context/TaskFabContext'
import { usePrivacy } from '../../context/PrivacyContext'
import { prefetchRoute } from '../../lib/routes'
import InstallButton from './InstallButton'

// Theme helpers — comparten localStorage con Topbar (misma clave 'anma_theme').
// Los ajustes rápidos del sidebar aplican al mismo atributo document.
const THEME_KEY = 'anma_theme'
function readTheme() {
  if (typeof window === 'undefined') return 'light'
  const saved = localStorage.getItem(THEME_KEY)
  if (saved === 'dark' || saved === 'light') return saved
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

// `perm` define quién ve cada entrada (owner ve todo, operator solo los que coincidan).
// `ownerOnly: true` = oculto para operator siempre.
const NAV_GROUPS = [
  {
    id: 'ventas', label: 'Ventas', collapsible: false,
    items: [
      { path: '/', icon: 'fa-chart-line', label: 'Dashboard', chipKey: 'budgets', perm: 'dashboard.view' },
      { path: '/pedido', icon: 'fa-file-invoice-dollar', label: 'Nuevo pedido', perm: 'pedido.create' },
      { path: '/ventas', icon: 'fa-receipt', label: 'Registro ventas', perm: 'pedido.create' },
      { path: '/clientes', icon: 'fa-users', label: 'Clientes', chipKey: 'clients', perm: 'cliente.view' },
    ],
  },
  {
    id: 'inventario', label: 'Inventario', collapsible: true, defaultOpen: true,
    items: [
      { path: '/catalogo', icon: 'fa-cube', label: 'Productos', chipKey: 'products', perm: 'catalogo.view' },
      { path: '/insumos', icon: 'fa-boxes-stacked', label: 'Insumos', chipKey: 'insumos', perm: 'insumo.view' },
      { path: '/proveedores', icon: 'fa-industry', label: 'Proveedores', chipKey: 'suppliers', perm: 'proveedor.view' },
    ],
  },
  {
    id: 'operaciones', label: 'Operaciones', collapsible: true, defaultOpen: false,
    items: [
      { path: '/logistica', icon: 'fa-truck-fast', label: 'Logística', perm: 'logistica.view' },
      { path: '/mensajes', icon: 'fa-brands fa-whatsapp', label: 'Mensajes WA', perm: 'mensajes.view' },
      { path: '/guia', icon: 'fa-book-open', label: 'Guía' },
    ],
  },
  {
    id: 'herramientas', label: 'Herramientas', collapsible: true, defaultOpen: false, ownerOnly: true,
    items: [
      { path: '/config', icon: 'fa-gear', label: 'Configuración', ownerOnly: true },
      { path: '/importador', icon: 'fa-file-import', label: 'Importador', ownerOnly: true, perm: 'config.access' },
    ],
  },
]

const SECTIONS_KEY = 'anma_sidebar_sections'

export default function Sidebar({ open, onClose, collapsed }) {
  const loc = useLocation()
  const nav = useNavigate()
  const { logout, role, can, isGlobalAdmin } = useAuth()
  const { get, config } = useData()
  const { panelOpen, setPanelOpen, activeTasks, focusMode, setFocusMode } = useTaskFab()
  const { hidden, toggle: togglePrivacy } = usePrivacy()
  const [theme, setTheme] = useState(readTheme)
  const [sections, setSections] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(SECTIONS_KEY) || '{}')
      const init = {}
      NAV_GROUPS.forEach(g => {
        if (g.collapsible) init[g.id] = saved[g.id] !== undefined ? saved[g.id] : (g.defaultOpen ?? true)
      })
      return init
    } catch { return {} }
  })
  const toggleSection = (id) => {
    setSections(prev => {
      const next = { ...prev, [id]: !prev[id] }
      try { localStorage.setItem(SECTIONS_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }
  useEffect(() => {
    // Sincroniza si Topbar cambió el theme desde otro tab
    const h = () => setTheme(readTheme())
    window.addEventListener('storage', h)
    return () => window.removeEventListener('storage', h)
  }, [])
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem(THEME_KEY, next)
  }
  const openTasksPanel = () => {
    if (focusMode) setFocusMode(false)
    else setPanelOpen(o => !o)
    onClose()
  }
  const c = config()
  const name = c.businessName || 'ANMA'
  const sub = c.subtitle || 'Tu negocio en un solo lugar'
  const email = c.email || ''
  const userName = email.split('@')[0] || 'Administrador'

  // onClose primero → cierra el drawer visualmente antes de disparar la nav,
  // así el usuario ve el cambio inmediatamente (evita la sensación de "no anda").
  const goTo = (path) => { onClose(); nav(path) }

  const doBackup = () => {
    const data = { budgets: get('budgets'), clients: get('clients'), products: get('products'), suppliers: get('suppliers'), insumos: get('insumos'), stockMoves: get('stockMoves'), tariffs: get('tariffs'), shipments: get('shipments'), waTemplates: get('waTemplates'), cfg: config() }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `ANMA_backup_${new Date().toISOString().slice(0,10)}.json`; a.click()
  }

  // Body scroll lock cuando el sidebar está abierto (mobile) — evita que la
  // Bottom Nav "se filtre" con scroll de fondo detrás del overlay.
  // El cleanup fn siempre limpia — evita que 'overflow:hidden' quede pegado
  // en el body y bloquee scroll/clicks después de cerrar.
  useEffect(() => {
    if (typeof document === 'undefined') return
    const prev = document.body.style.overflow
    document.body.style.overflow = open ? 'hidden' : prev
    return () => { document.body.style.overflow = '' }
  }, [open])

  const sidebarEl = (
    <aside className={`sidebar ${open ? 'open' : ''}${collapsed ? ' slim' : ''}`}>
      <div className="sb-top">
        <div className="sb-logo-row">
          <div className="sb-logo">
            {c.logo ? <img src={c.logo} alt="" /> : name.slice(0, 2).toUpperCase()}
          </div>
          <div className="sb-logo-txt">
            <div className="n">{name}</div>
            <div className="s">{sub}</div>
          </div>
        </div>
      </div>
      <nav className="sb-nav">
        {NAV_GROUPS.map(group => {
          if (group.ownerOnly && role === 'operator') return null
          const isOpen = !group.collapsible || sections[group.id]
          const visibleItems = group.items.filter(item => {
            if (role === 'operator' && item.ownerOnly) return null
            if (role === 'operator' && item.perm && !can(item.perm)) return null
            return true
          })
          if (visibleItems.length === 0) return null

          return (
            <div key={group.id}>
              {group.collapsible ? (
                <button type="button" className={`sb-sec sb-sec-toggle${isOpen ? ' is-open' : ''}`} onClick={() => toggleSection(group.id)}>
                  {group.label}
                  <i className={`fa fa-chevron-${isOpen ? 'up' : 'down'}`} style={{ fontSize: 9, marginLeft: 'auto', opacity: .5 }} />
                </button>
              ) : (
                <div className="sb-sec">{group.label}</div>
              )}
              {isOpen && visibleItems.map(item => {
                const active = loc.pathname === item.path || (item.path === '/pedido' && loc.pathname.startsWith('/pedido'))
                return (
                  <button key={item.path} type="button" className={`sb-item ${active ? 'active' : ''}`}
                    data-tip={item.label} onClick={() => goTo(item.path)}
                    onMouseEnter={() => prefetchRoute(item.path)} onFocus={() => prefetchRoute(item.path)}>
                    <i className={`fa ${item.icon}`} /><span className="sb-lbl">{item.label}</span>
                  </button>
                )
              })}
              {isOpen && group.id === 'herramientas' && role === 'owner' && (
                <>
                  <button type="button" className={`sb-item ${loc.pathname === '/mi-cuenta' ? 'active' : ''}`} data-tip="Mi cuenta" onClick={() => goTo('/mi-cuenta')}>
                    <i className="fa fa-user-gear" /><span className="sb-lbl">Mi cuenta</span>
                  </button>
                  <button type="button" className="sb-item" data-tip="Backup" onClick={doBackup}>
                    <i className="fa fa-cloud-arrow-down" /><span className="sb-lbl">Backup de datos</span>
                  </button>
                </>
              )}
            </div>
          )
        })}
      </nav>
      {/* Ajustes rápidos — 3 íconos horizontales: Tareas · Ojo · Tema.
          La campana vive en el Topbar (acceso rápido siempre visible). */}
      <div className="sb-quick-bar">
        <button className="sb-quick-icon" onClick={openTasksPanel}
          title={focusMode ? 'Salir del Modo Enfoque' : 'Tareas y Modo Enfoque'}
          aria-label="Tareas y Modo Enfoque">
          <i className="fa fa-brain" />
          {!focusMode && activeTasks.length > 0 && (
            <span className="sb-quick-icon-badge" style={{
              background: activeTasks.some(t => t.priority === 'today') ? '#DC2626' : '#D97706'
            }}>
              {activeTasks.length > 9 ? '9+' : activeTasks.length}
            </span>
          )}
        </button>
        <button className={`sb-quick-icon${hidden ? ' is-on' : ''}`} onClick={togglePrivacy}
          title={hidden ? 'Mostrar datos financieros' : 'Ocultar datos financieros'}
          aria-label={hidden ? 'Mostrar datos financieros' : 'Ocultar datos financieros'}
          aria-pressed={hidden}>
          <i className={`fa ${hidden ? 'fa-eye-slash' : 'fa-eye'}`} />
        </button>
        <button className={`sb-quick-icon${theme === 'dark' ? ' is-on' : ''}`} onClick={toggleTheme}
          title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
          aria-label={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
          aria-pressed={theme === 'dark'}>
          <i className={`fa ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`} />
        </button>
      </div>
      <div className="sb-foot">
        {/* Instalar app — outline discreto (no compite con Cerrar sesión).
            Solo se muestra si el navegador expone el prompt. */}
        <InstallButton
          label="Instalar app"
          className="sb-install-btn"
        />
        {/* User row — perfil arriba, Cerrar sesión abajo separado.
            Super Admin (solo Ana) va como ícono discreto ANTES del logout. */}
        <div className="sb-user">
          <div className="sb-user-info">
            <div className="sb-ava">{(userName[0] || 'A').toUpperCase()}</div>
            <div className="sb-user-meta">
              <div className="sb-uname">{userName}</div>
              <div className="sb-urole">{role === 'operator' ? 'Operador' : 'Cuenta'}</div>
            </div>
          </div>
          {isGlobalAdmin && (
            <button className="sb-admin-btn"
              onClick={() => goTo('/admin')}
              title="Super Admin · Workspaces"
              aria-label="Super Admin">
              <i className="fa fa-shield-halved" />
            </button>
          )}
          <button className="sb-logout-btn" onClick={logout} title="Cerrar sesión" aria-label="Cerrar sesión">
            <i className="fa fa-right-from-bracket" />
          </button>
        </div>
        {/* Versión del build — útil para diagnosticar caché viejo del usuario */}
        <div className="sb-version" title="Versión del build — si reportás un bug, mencionalo">
          v{__BUILD_VERSION__}
        </div>
      </div>
    </aside>
  )

  // Portal al <body> — escapa de cualquier stacking context (transform, overflow,
  // opacity, filter, isolation) que tenga un ancestro. Garantiza que el sidebar
  // con su z-index quede por encima del Bottom Nav sin interferencias.
  if (typeof document !== 'undefined') return createPortal(sidebarEl, document.body)
  return sidebarEl
}

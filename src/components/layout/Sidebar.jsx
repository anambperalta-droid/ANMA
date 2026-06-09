import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useData } from '../../context/DataContext'
import { RUBROS, TIPOS_VENTA } from '../../lib/rubros'
import { prefetchRoute } from '../../lib/routes'

// `perm` define quién ve cada entrada (owner ve todo, operator solo los que coincidan).
// `ownerOnly: true` = oculto para operator siempre.
const NAV = [
  { section: 'Ventas' },
  { path: '/', icon: 'fa-chart-line', label: 'Dashboard', chipKey: 'budgets', perm: 'dashboard.view' },
  { path: '/presupuesto', icon: 'fa-file-invoice-dollar', label: 'Nuevo pedido', perm: 'pedido.create' },
  { path: '/clientes', icon: 'fa-users', label: 'Clientes', chipKey: 'clients', perm: 'cliente.view' },
  { section: 'Inventario' },
  { path: '/catalogo', icon: 'fa-cube', label: 'Productos', chipKey: 'products', perm: 'catalogo.view' },
  { path: '/insumos', icon: 'fa-boxes-stacked', label: 'Insumos', chipKey: 'insumos', perm: 'insumo.view' },
  { path: '/proveedores', icon: 'fa-industry', label: 'Proveedores', chipKey: 'suppliers', perm: 'proveedor.view' },
  { section: 'Operaciones' },
  { path: '/logistica', icon: 'fa-truck-fast', label: 'Logística', perm: 'logistica.view' },
  { path: '/mensajes', icon: 'fa-brands fa-whatsapp', label: 'Mensajes WA', perm: 'mensajes.view' },
  { section: 'Sistema', ownerOnly: true },
  { path: '/config', icon: 'fa-gear', label: 'Configuración', ownerOnly: true },
]

export default function Sidebar({ open, onClose, collapsed }) {
  const loc = useLocation()
  const nav = useNavigate()
  const { logout, role, can, isGlobalAdmin } = useAuth()
  const { get, config } = useData()
  const c = config()
  const name = c.businessName || 'ANMA'
  const sub = c.subtitle || 'Tu negocio en un solo lugar'
  const email = c.email || ''
  const userName = email.split('@')[0] || 'Administrador'

  const goTo = (path) => { nav(path); onClose() }

  const doBackup = () => {
    const data = { budgets: get('budgets'), clients: get('clients'), products: get('products'), suppliers: get('suppliers'), insumos: get('insumos'), stockMoves: get('stockMoves'), tariffs: get('tariffs'), shipments: get('shipments'), waTemplates: get('waTemplates'), cfg: config() }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `ANMA_backup_${new Date().toISOString().slice(0,10)}.json`; a.click()
  }

  return (
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
        {/* Chip de perfil comercial: rubro + tipoVenta. Solo si están definidos. */}
        {(c.rubro || c.tipoVenta) && (() => {
          const rubroMeta = RUBROS.find(r => r.val === c.rubro)
          const tipoMeta  = TIPOS_VENTA.find(t => t.val === c.tipoVenta)
          return (
            <div className="sb-profile-chip" title={`${rubroMeta?.label || ''}${tipoMeta ? ' · ' + tipoMeta.label : ''}`}>
              {rubroMeta && <span><span className="sb-chip-ico">{rubroMeta.icon}</span> {rubroMeta.label}</span>}
              {rubroMeta && tipoMeta && <span className="sb-chip-sep">·</span>}
              {tipoMeta && <span><span className="sb-chip-ico">{tipoMeta.icon}</span> {tipoMeta.label}</span>}
            </div>
          )
        })()}
      </div>
      <nav className="sb-nav">
        {NAV.map((item, i) => {
          // Operator: ocultar entradas ownerOnly o sin permiso
          if (role === 'operator') {
            if (item.ownerOnly) return null
            if (item.perm && !can(item.perm)) return null
          }
          if (item.section) return <div key={i} className="sb-sec">{item.section}</div>
          const active = loc.pathname === item.path || (item.path === '/presupuesto' && loc.pathname.startsWith('/presupuesto'))
          return (
            <div
              key={item.path}
              className={`sb-item ${active ? 'active' : ''}`}
              data-tip={item.label}
              onClick={() => goTo(item.path)}
              onMouseEnter={() => prefetchRoute(item.path)}
              onTouchStart={() => prefetchRoute(item.path)}
              onFocus={() => prefetchRoute(item.path)}
              role="link"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goTo(item.path) } }}
            >
              <i className={`fa ${item.icon}`} />
              <span className="sb-lbl">{item.label}</span>
            </div>
          )
        })}
        {role === 'owner' && (
          <>
            <div className="sb-sec">Tu cuenta</div>
            <div className={`sb-item ${loc.pathname === '/mi-cuenta' ? 'active' : ''}`} data-tip="Mi cuenta · Suscripción + datos" onClick={() => goTo('/mi-cuenta')}>
              <i className="fa fa-user-gear" /><span className="sb-lbl">Mi cuenta</span>
            </div>
            <div className="sb-item" data-tip="Backup" onClick={doBackup}><i className="fa fa-cloud-arrow-down" /><span className="sb-lbl">Backup</span></div>
          </>
        )}
        {isGlobalAdmin && (
          <>
            <div className="sb-sec">Super admin</div>
            <div className={`sb-item ${loc.pathname === '/admin' ? 'active' : ''}`} data-tip="Admin · Workspaces" onClick={() => goTo('/admin')}>
              <i className="fa fa-shield-halved" /><span className="sb-lbl">Admin · Workspaces</span>
            </div>
          </>
        )}
      </nav>
      <div className="sb-foot">
        <div className="sb-user" onClick={logout}>
          <div className="sb-ava">{(userName[0] || 'A').toUpperCase()}</div>
          <div><div className="sb-uname">{userName}</div><div className="sb-urole">{role === 'operator' ? 'Operador · Cerrar sesión' : 'Cerrar sesión'}</div></div>
          <i className="fa fa-right-from-bracket" style={{ marginLeft: 'auto', color: 'rgba(255,255,255,.25)', fontSize: 13 }} />
        </div>
        {/* Versión del build — útil para diagnosticar caché viejo del usuario */}
        <div className="sb-version" title="Versión del build — si reportás un bug, mencionalo">
          v{__BUILD_VERSION__}
        </div>
      </div>
    </aside>
  )
}

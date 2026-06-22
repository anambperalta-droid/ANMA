import { useEffect, useState, useMemo } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Portal público de proveedor (sin auth) — ANMA Hub.
 * Lee datos serializados desde el query param ?d=BASE64.
 */
export default function PortalProveedor() {
  const loc = useLocation()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    try {
      const params = new URLSearchParams(loc.search)
      const d = params.get('d')
      if (!d) { setError('Link inválido o vencido'); return }
      const json = decodeURIComponent(escape(atob(d.replace(/-/g, '+').replace(/_/g, '/'))))
      const raw = JSON.parse(json)
      const exp = raw.e || raw.exp || 0
      if (exp && Date.now() > exp) {
        setError('Este link ya venció. Pedí uno nuevo a tu cliente.')
        return
      }
      // Normaliza payload v2 (keys cortas) y v1 (keys largas — backward compat)
      const norm = {
        supplierName: raw.s || raw.supplierName || '',
        contact:      raw.c || raw.contact || '',
        paymentTerm:  raw.pt || raw.paymentTerm || '',
        leadTime:     raw.lt || raw.leadTime || '',
        ownerName:    raw.o || raw.ownerName || '',
        ownerWa:      raw.w || raw.ownerWa || '',
        brandColor:   raw.bc || raw.brandColor || '',
        exp:          exp,
        products: (raw.p || raw.products || []).map(pr => ({
          name:     pr.n  || pr.name || '',
          cost:     pr.c  ?? pr.cost ?? 0,
          stock:    pr.st ?? pr.stock ?? 0,
          minStock: pr.m  ?? pr.minStock ?? 0,
          reorder:  pr.r === 1 || pr.reorder === true,
        })),
        priceHistory: raw.ph || raw.priceHistory || [],
      }
      setData(norm)
    } catch (e) {
      setError('No se pudo abrir el link. Verificá que esté completo.')
    }
  }, [loc.search])

  const fmt = (n) => '$ ' + Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

  const products = data?.products || []
  const reorder = useMemo(() => products.filter(p => p.reorder), [products])
  const reorderTotal = useMemo(() =>
    reorder.reduce((s, p) => s + (Number(p.cost) || 0) * Math.max(1, (p.minStock || 0) - (p.stock || 0)), 0),
    [reorder])

  const expDate = data?.exp ? new Date(data.exp).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' }) : null
  const daysLeft = data?.exp ? Math.max(0, Math.ceil((data.exp - Date.now()) / 86400000)) : null

  const waText = (suffix = '') => {
    const base = `Hola ${data?.ownerName || ''}, vi el portal de proveedor${suffix ? ' y ' + suffix : '. '}`
    return encodeURIComponent(base)
  }
  const waLink = (suffix) => data?.ownerWa
    ? `https://wa.me/${data.ownerWa.replace(/\D/g, '')}?text=${waText(suffix)}`
    : null

  const copyAllProducts = () => {
    const lines = products.map(p => `• ${p.name} — ${fmt(p.cost)}${p.reorder ? ' (URGENTE)' : ''}`).join('\n')
    const txt = `Pedido para ${data?.ownerName || 'mi cliente'}:\n\n${lines}\n\nTotal estimado re-orden: ${fmt(reorderTotal)}`
    navigator.clipboard?.writeText(txt).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2200) })
  }

  if (error) return (
    <div style={S.errorWrap}>
      <div style={S.errorCard}>
        <div style={{ fontSize: 38, marginBottom: 14, color: '#DC2626' }}><i className="fa fa-triangle-exclamation" /></div>
        <h2 style={S.errorTitle}>Link no válido</h2>
        <p style={S.errorMsg}>{error}</p>
        <p style={S.errorHint}>Pedí a tu cliente un nuevo enlace.</p>
      </div>
    </div>
  )

  if (!data) return (
    <div style={S.loadingWrap}>
      <div style={S.spinner} />
      <span style={{ marginTop: 12, color: '#6366F1', fontSize: 13 }}>Cargando portal...</span>
    </div>
  )

  return (
    <div style={S.wrap}>
      <style>{`
        @keyframes pp-fade { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
        @keyframes pp-pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.04)} }
        @keyframes pp-spin { to{transform:rotate(360deg)} }
        .pp-card { animation: pp-fade .4s ease both }
        .pp-card:nth-child(2){animation-delay:.05s}
        .pp-card:nth-child(3){animation-delay:.1s}
        .pp-card:nth-child(4){animation-delay:.15s}
        .pp-card:nth-child(5){animation-delay:.2s}
        .pp-btn-wa { transition: transform .15s, box-shadow .25s }
        .pp-btn-wa:hover { transform:translateY(-1px); box-shadow:0 12px 28px rgba(22,163,74,.4) }
        .pp-btn-out { transition: background .2s, transform .15s }
        .pp-btn-out:hover { background: rgba(124,58,237,.06); transform:translateY(-1px) }
        .pp-row:hover { background:#F5F3FF !important }
      `}</style>

      <div style={S.container}>

        {/* HEADER */}
        <div className="pp-card" style={S.hero}>
          <div style={S.heroWordmark}>ANMA</div>
          <div style={S.heroPill}>Portal de Proveedor</div>
          <h1 style={S.heroTitle}>
            Hola {data.contact || data.supplierName}
          </h1>
          <p style={S.heroSub}>
            <b>{data.ownerName || 'Tu cliente'}</b> te comparte un resumen de la operación que tienen juntos. Este portal es de solo lectura — sin necesidad de cuenta.
          </p>
          {expDate && (
            <div style={S.heroValid}>
              <i className="fa fa-calendar-day" style={{ fontSize: 12 }} />
              <span>Válido hasta <b style={{ color: '#fff' }}>{expDate}</b>{daysLeft !== null && daysLeft <= 7 && (
                <span style={S.expiringSoon}>· {daysLeft === 0 ? 'vence hoy' : daysLeft === 1 ? 'vence mañana' : `${daysLeft} días`}</span>
              )}</span>
            </div>
          )}
        </div>

        {/* RE-ORDEN URGENTE */}
        {reorder.length > 0 && (
          <div className="pp-card" style={S.reorderCard}>
            <div style={S.reorderHead}>
              <div style={S.urgentBadge}>
                <i className="fa fa-triangle-exclamation" /> URGENTE
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={S.reorderTitle}>Necesito reponer {reorder.length} producto{reorder.length !== 1 ? 's' : ''}</h3>
                <p style={S.reorderSub}>Stock por debajo del mínimo. Esperamos confirmación de plazo y disponibilidad.</p>
              </div>
            </div>
            <div style={S.reorderList}>
              {reorder.map((p, i) => (
                <div key={i} style={S.reorderItem}>
                  <div style={{ flex: 1 }}>
                    <div style={S.reorderItemName}>{p.name}</div>
                    <div style={S.reorderItemMeta}>
                      Stock <b style={{ color: '#DC2626' }}>{p.stock || 0}</b> / mín. {p.minStock} · faltan {Math.max(1, (p.minStock || 0) - (p.stock || 0))}
                    </div>
                  </div>
                  <div style={S.reorderItemCost}>{fmt(p.cost)} <span style={{ fontSize: 9, color: '#6366F1', fontWeight: 500 }}>/u</span></div>
                </div>
              ))}
            </div>
            {reorderTotal > 0 && (
              <div style={S.reorderTotal}>
                <span style={{ fontSize: 12, color: '#6B7280' }}>Estimado mínimo a reponer:</span>
                <b style={{ fontSize: 18, color: '#DC2626' }}>{fmt(reorderTotal)}</b>
              </div>
            )}
            {waLink('quería confirmarte el pedido urgente') && (
              <a href={waLink('quería confirmarte el pedido urgente')} target="_blank" rel="noopener noreferrer" className="pp-btn-wa" style={S.btnUrgent}>
                <i className="fa-brands fa-whatsapp" style={{ fontSize: 18 }} /> Confirmar pedido urgente por WhatsApp
              </a>
            )}
          </div>
        )}

        {/* PRODUCTOS */}
        {products.length > 0 && (
          <div className="pp-card" style={S.section}>
            <div style={S.sectionHead}>
              <h3 style={S.sectionTitle}><i className="fa fa-box-open" style={{ marginRight: 8, color: '#7C3AED' }} />Detalle de productos</h3>
              <button onClick={copyAllProducts} style={S.copyBtn}>
                <i className={`fa fa-${copied ? 'check' : 'copy'}`} /> {copied ? 'Copiado' : 'Copiar lista'}
              </button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={S.table}>
                <thead>
                  <tr style={S.thead}>
                    <th style={S.th}>Producto</th>
                    <th style={{ ...S.th, textAlign: 'center', width: 100 }}>Cantidad (u.)</th>
                    <th style={{ ...S.th, textAlign: 'right', width: 130 }}>Precio u.</th>
                    <th style={{ ...S.th, textAlign: 'right', width: 130 }}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p, i) => {
                    const qty = Math.max(1, p.stock || 0)
                    return (
                    <tr key={i} className="pp-row" style={S.tr}>
                      <td style={S.td}>
                        <div style={{ fontWeight: 600, color: '#1E1B4B' }}>{p.name}</div>
                      </td>
                      <td style={{ ...S.td, textAlign: 'center', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{qty}</td>
                      <td style={{ ...S.td, textAlign: 'right', color: '#374151', fontVariantNumeric: 'tabular-nums' }}>{fmt(p.cost)}</td>
                      <td style={{ ...S.td, textAlign: 'right', fontWeight: 700, color: '#7C3AED', fontVariantNumeric: 'tabular-nums' }}>{fmt(p.cost * qty)}</td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div style={S.sectionFoot}>
              {products.length} producto{products.length !== 1 ? 's' : ''} · Estos son los precios actuales acordados
            </div>
          </div>
        )}

        {/* HISTORIAL DE PRECIOS */}
        {(data.priceHistory || []).length > 0 && (
          <div className="pp-card" style={S.section}>
            <h3 style={S.sectionTitle}><i className="fa fa-chart-line" style={{ marginRight: 8, color: '#7C3AED' }} />Cambios de precio recientes</h3>
            <p style={S.sectionSub}>Para mantener todo claro y transparente entre ambas partes.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.priceHistory.slice(0, 8).map((h, i) => {
                const pct = h.prevCost > 0 ? ((h.newCost - h.prevCost) / h.prevCost) * 100 : 0
                const up = pct > 0
                return (
                  <div key={i} style={S.histRow}>
                    <span style={S.histDate}>{h.date}</span>
                    <span style={S.histName}>{h.productName}</span>
                    <div style={S.histPrice}>
                      <span style={{ color: '#6B7280' }}>{fmt(h.prevCost)}</span>
                      <i className="fa fa-arrow-right" style={{ fontSize: 9, color: '#C4B5FD' }} />
                      <b style={{ color: '#1E1B4B' }}>{fmt(h.newCost)}</b>
                    </div>
                    <span style={{ ...S.histPct, color: up ? '#DC2626' : '#16A34A', background: up ? '#FEF2F2' : '#F0FDF4' }}>
                      <i className={`fa fa-arrow-${up ? 'up' : 'down'}`} style={{ fontSize: 9, marginRight: 3 }} />
                      {pct > 0 ? '+' : ''}{pct.toFixed(1)}%
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* CONDICIONES */}
        {(data.paymentTerm || data.leadTime) && (
          <div className="pp-card" style={S.section}>
            <h3 style={S.sectionTitle}><i className="fa fa-sliders" style={{ marginRight: 8, color: '#7C3AED' }} />Condiciones acordadas</h3>
            <div style={S.condsGrid}>
              {data.paymentTerm && (
                <div style={S.condCard}>
                  <div style={S.condIcon}><i className="fa fa-credit-card" /></div>
                  <div style={S.condLabel}>Plazo de pago</div>
                  <div style={S.condValue}>{data.paymentTerm} <span style={S.condUnit}>días</span></div>
                </div>
              )}
              {data.leadTime && (
                <div style={S.condCard}>
                  <div style={S.condIcon}><i className="fa fa-truck-fast" /></div>
                  <div style={S.condLabel}>Lead time entrega</div>
                  <div style={S.condValue}>{data.leadTime} <span style={S.condUnit}>días</span></div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* CONFIRMACIÓN / CTA */}
        <div className="pp-card" style={S.ctaCard}>
          <div style={{ fontSize: 30, marginBottom: 8, color: confirmed ? '#16A34A' : '#7C3AED' }}><i className={`fa ${confirmed ? 'fa-circle-check' : 'fa-handshake'}`} /></div>
          <h3 style={S.ctaTitle}>
            {confirmed ? '¡Gracias por confirmar!' : '¿Podés cumplir con esto?'}
          </h3>
          <p style={S.ctaSub}>
            {confirmed
              ? `Avisale a ${data.ownerName || 'tu cliente'} cualquier detalle por WhatsApp. Va a saber que viste el portal.`
              : 'Tomate un momento, revisá los precios y plazos, y avisanos por el canal que prefieras.'}
          </p>

          <div style={S.ctaButtons}>
            {waLink('te confirmo que llego con todo según los plazos acordados') && (
              <a href={waLink('te confirmo que llego con todo según los plazos acordados')}
                target="_blank" rel="noopener noreferrer"
                onClick={() => setConfirmed(true)}
                className="pp-btn-wa" style={S.btnConfirm}>
                <i className="fa-brands fa-whatsapp" style={{ fontSize: 18 }} /> Confirmar todo
              </a>
            )}
            {waLink('quería ver algunos detalles antes de confirmar') && (
              <a href={waLink('quería ver algunos detalles antes de confirmar')}
                target="_blank" rel="noopener noreferrer"
                className="pp-btn-out" style={S.btnAsk}>
                <i className="fa-brands fa-whatsapp" /> Tengo dudas / Negociar
              </a>
            )}
          </div>

          <div style={S.ctaTip}>
            <i className="fa fa-circle-info" style={{ marginRight: 6, color: '#7C3AED' }} />
            Tu mensaje llega directo a {data.ownerName || 'tu cliente'} por WhatsApp. No usamos tu número para nada más.
          </div>
        </div>

        {/* FOOTER */}
        <div style={S.foot}>
          <span>Generado con</span>
          <b style={{ color: '#7C3AED', letterSpacing: '-.2px' }}>ANMA</b>
          <span style={S.footDot} />
          <span>Información de solo lectura</span>
          <span style={S.footDot} />
          <a href="https://anmahub.com" style={S.footLink}>¿Querés algo así para tu negocio?</a>
        </div>
      </div>
    </div>
  )
}

const S = {
  wrap: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 50%, #F0FDF4 100%)',
    fontFamily: "'Inter',system-ui,sans-serif",
    padding: '20px 14px 40px',
  },
  container: { maxWidth: 720, margin: '0 auto' },

  // Hero
  hero: {
    background: 'linear-gradient(135deg, #1e1b4b 0%, #4C1D95 55%, #7C3AED 100%)',
    borderRadius: 18,
    padding: '26px 26px 30px',
    color: '#fff',
    marginBottom: 14,
    boxShadow: '0 12px 40px rgba(76,29,149,.32)',
    position: 'relative',
    overflow: 'hidden',
  },
  heroWordmark: {
    fontSize: 12, fontWeight: 700, letterSpacing: '6px', textTransform: 'uppercase',
    color: 'rgba(255,255,255,.7)', marginBottom: 14,
  },
  heroPill: {
    fontSize: 10.5, opacity: .85, textTransform: 'uppercase',
    letterSpacing: '1.5px', fontWeight: 700, marginBottom: 8,
    display: 'inline-block', background: 'rgba(255,255,255,.14)',
    padding: '4px 10px', borderRadius: 12, backdropFilter: 'blur(8px)',
  },
  heroTitle: { margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: '-.6px', lineHeight: 1.15 },
  heroSub: { margin: '10px 0 0', fontSize: 14, opacity: .94, lineHeight: 1.55 },
  heroValid: {
    fontSize: 12, opacity: .9, marginTop: 16,
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: 'rgba(255,255,255,.12)', padding: '6px 12px', borderRadius: 20,
    backdropFilter: 'blur(8px)',
  },
  expiringSoon: { marginLeft: 6, color: '#FBBF24', fontWeight: 700 },

  // Reorder
  reorderCard: {
    background: '#fff', borderRadius: 16, padding: 18, marginBottom: 14,
    border: '2px solid #DC2626',
    boxShadow: '0 6px 24px rgba(220,38,38,.12)',
  },
  reorderHead: { display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  urgentBadge: {
    background: '#DC2626', color: '#fff', borderRadius: 8,
    padding: '5px 10px', fontSize: 11, fontWeight: 800,
    display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0,
  },
  reorderTitle: { margin: 0, fontSize: 16, color: '#1E1B4B', fontWeight: 800 },
  reorderSub: { margin: '4px 0 0', fontSize: 12, color: '#6B7280', lineHeight: 1.5 },
  reorderList: { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 },
  reorderItem: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 12px', background: '#FEF2F2', borderRadius: 10,
    border: '1px solid #FECACA',
  },
  reorderItemName: { fontWeight: 700, color: '#1E1B4B', fontSize: 13.5 },
  reorderItemMeta: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  reorderItemCost: { fontSize: 14, fontWeight: 800, color: '#DC2626', fontVariantNumeric: 'tabular-nums' },
  reorderTotal: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 14px', background: '#FFF7ED', border: '1px solid #FED7AA',
    borderRadius: 10, marginBottom: 12,
  },
  btnUrgent: {
    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: 8, background: 'linear-gradient(135deg,#DC2626,#B91C1C)',
    color: '#fff', padding: '13px 20px', borderRadius: 12, textDecoration: 'none',
    fontWeight: 700, fontSize: 14, boxShadow: '0 6px 18px rgba(220,38,38,.32)',
    boxSizing: 'border-box',
  },

  // Sections
  section: {
    background: '#fff', borderRadius: 16, padding: 18, marginBottom: 14,
    boxShadow: '0 2px 12px rgba(0,0,0,.04)',
  },
  sectionHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8, flexWrap: 'wrap' },
  sectionTitle: { margin: '0 0 10px', fontSize: 15, color: '#1E1B4B', fontWeight: 800, letterSpacing: '-.2px' },
  sectionSub: { margin: '-4px 0 12px', fontSize: 12, color: '#6B7280', lineHeight: 1.5 },
  sectionFoot: { fontSize: 11, color: '#6B7280', marginTop: 10, textAlign: 'right', fontStyle: 'italic' },
  copyBtn: {
    background: 'transparent', border: '1.5px solid #EDE9FE', color: '#7C3AED',
    padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700,
    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5,
    fontFamily: 'inherit', transition: 'all .15s',
  },

  // Table
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 15, minWidth: 400 },
  thead: { borderBottom: '2px solid #EDE9FE' },
  th: { textAlign: 'left', padding: '11px 10px', fontSize: 11, color: '#6B7280', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.6px' },
  tr: { borderBottom: '1px solid #F5F3FF', transition: 'background .15s' },
  td: { padding: '15px 10px', color: '#1E1B4B' },
  statusReorder: {
    background: '#FEE2E2', color: '#DC2626', padding: '3px 8px',
    borderRadius: 12, fontSize: 9.5, fontWeight: 800, letterSpacing: '.3px',
  },
  statusOk: {
    background: '#F0FDF4', color: '#16A34A', padding: '3px 8px',
    borderRadius: 12, fontSize: 9.5, fontWeight: 800, letterSpacing: '.3px',
  },

  // History
  histRow: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '9px 12px', background: '#F5F3FF', borderRadius: 10, fontSize: 12,
    flexWrap: 'wrap',
  },
  histDate: { color: '#7C3AED', fontSize: 11, fontWeight: 600, minWidth: 70 },
  histName: { flex: 1, color: '#1E1B4B', fontWeight: 600, minWidth: 100 },
  histPrice: { display: 'inline-flex', alignItems: 'center', gap: 6, fontVariantNumeric: 'tabular-nums' },
  histPct: { padding: '3px 8px', borderRadius: 8, fontSize: 11, fontWeight: 800 },

  // Conditions
  condsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 },
  condCard: { background: 'linear-gradient(135deg,#F5F3FF,#F0FDF4)', borderRadius: 12, padding: '14px 16px', border: '1px solid #EDE9FE' },
  condIcon: { fontSize: 22, marginBottom: 4 },
  condLabel: { fontSize: 10, color: '#6B7280', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '.6px' },
  condValue: { fontSize: 22, fontWeight: 800, color: '#1E1B4B', marginTop: 3, letterSpacing: '-.5px' },
  condUnit: { fontSize: 12, color: '#6B7280', fontWeight: 500 },

  // CTA
  ctaCard: {
    background: 'linear-gradient(135deg,#fff 0%,#F5F3FF 100%)',
    borderRadius: 16, padding: '26px 22px 22px', marginBottom: 14,
    boxShadow: '0 4px 18px rgba(124,58,237,.10)',
    textAlign: 'center', border: '1.5px solid #EDE9FE',
  },
  ctaTitle: { margin: '0 0 8px', fontSize: 18, color: '#1E1B4B', fontWeight: 800 },
  ctaSub: { margin: '0 0 18px', fontSize: 13, color: '#6B7280', lineHeight: 1.55 },
  ctaButtons: { display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  btnConfirm: {
    flex: '1 1 200px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    background: 'linear-gradient(135deg,#16A34A,#15803D)', color: '#fff',
    padding: '13px 22px', borderRadius: 12, textDecoration: 'none',
    fontWeight: 700, fontSize: 14, boxShadow: '0 6px 18px rgba(22,163,74,.3)',
  },
  btnAsk: {
    flex: '1 1 200px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    background: '#fff', color: '#7C3AED', padding: '13px 22px',
    borderRadius: 12, textDecoration: 'none', fontWeight: 700, fontSize: 13,
    border: '1.5px solid #DDD6FE',
  },
  ctaTip: {
    marginTop: 16, fontSize: 11, color: '#6B7280', lineHeight: 1.5,
    background: '#F5F3FF', padding: '8px 12px', borderRadius: 10, display: 'inline-block',
  },

  // Footer
  foot: {
    textAlign: 'center', fontSize: 11, color: '#7C3AED', padding: '18px 12px',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap',
  },
  footDot: { width: 3, height: 3, borderRadius: '50%', background: '#C4B5FD', display: 'inline-block' },
  footLink: { color: '#7C3AED', textDecoration: 'none', fontWeight: 600 },

  // Error
  errorWrap: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 20, fontFamily: "'Inter',sans-serif",
    background: 'linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%)',
  },
  errorCard: {
    maxWidth: 420, textAlign: 'center', background: '#fff',
    padding: '36px 32px', borderRadius: 18, boxShadow: '0 8px 32px rgba(0,0,0,.08)',
  },
  errorTitle: { margin: '0 0 8px', color: '#1E1B4B', fontSize: 19, fontWeight: 800 },
  errorMsg: { color: '#6B7280', fontSize: 14, margin: '0 0 12px', lineHeight: 1.5 },
  errorHint: { color: '#7C3AED', fontSize: 12, margin: 0 },

  // Loading
  loadingWrap: {
    minHeight: '100vh', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    fontFamily: "'Inter',sans-serif", background: 'linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%)',
  },
  spinner: {
    width: 32, height: 32, borderRadius: '50%',
    border: '3px solid #EDE9FE', borderTopColor: '#7C3AED',
    animation: 'pp-spin 1s linear infinite',
  },
}

import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../../context/DataContext'
import { useToast } from '../../context/ToastContext'
import { fmt, MONTHS, STATUS_MAP, STATUS_CLS } from '../../lib/storage'

function Badge({ status }) {
  return <span className={`badge ${STATUS_CLS[status] || 'b-draft'}`}>{STATUS_MAP[status] || 'Borrador'}</span>
}

function KpiCard({ label, value, foot, color, icon }) {
  const colors = { brand: 'var(--brand)', blue: 'var(--blue)', green: 'var(--green)', amber: 'var(--amber)' }
  const c = colors[color] || colors.brand
  return (
    <div className="bento-kpi">
      <div className="kpi-glow" style={{ background: c }} />
      <div className="kpi-icon-wrap" style={{ background: c + '1a' }}>
        <i className={`fa ${icon}`} style={{ color: c, fontSize: 18 }} />
      </div>
      <div className="kpi-label">{label}</div>
      <div className="kpi-val" style={{ color: c }}>{value}</div>
      <div className="kpi-foot">{foot}</div>
    </div>
  )
}

function BarChart({ data, type = 'income' }) {
  const maxV = Math.max(...data.map(m => m.val), 1)
  const grad = type === 'gain'
    ? 'linear-gradient(180deg,var(--green),rgba(5,150,105,.3))'
    : 'linear-gradient(180deg,var(--brand),rgba(124,58,237,.3))'
  return (
    <div>
      <div className="bar-chart" style={{ height: 130 }}>
        {data.map((m, i) => (
          <div key={i} className="bc">
            <div className="bb" style={{ height: Math.max(4, (m.val / maxV) * 120), background: grad }} title={fmt(m.val)} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        {data.map((m, i) => <div key={i} className="bl" style={{ flex: 1, textAlign: 'center' }}>{m.lbl}</div>)}
      </div>
    </div>
  )
}

/* ── Urgency helpers ── */
function urgency(days) {
  if (days <= 3) return { cls: 'green', icon: 'fa-clock', label: 'Reciente', color: 'var(--green)' }
  if (days <= 7) return { cls: 'amber', icon: 'fa-hourglass-half', label: 'Necesita atención', color: 'var(--amber)' }
  if (days <= 14) return { cls: 'orange', icon: 'fa-triangle-exclamation', label: 'Urgente', color: '#EA580C' }
  return { cls: 'red', icon: 'fa-fire', label: 'Crítico — sin respuesta', color: 'var(--red)' }
}

const TIERS = [
  { key: 'red', min: 15, max: Infinity, label: 'Crítico — +15 días sin respuesta', color: 'var(--red)', icon: 'fa-fire' },
  { key: 'orange', min: 8, max: 14, label: 'Urgente — 8 a 14 días', color: '#EA580C', icon: 'fa-triangle-exclamation' },
  { key: 'amber', min: 4, max: 7, label: 'Necesita atención — 4 a 7 días', color: 'var(--amber)', icon: 'fa-hourglass-half' },
  { key: 'green', min: 0, max: 3, label: 'Reciente — 0 a 3 días', color: 'var(--green)', icon: 'fa-clock' },
]

/* ── Seguimiento card with Re-enviar button ── */
function SeguimientoCard({ b, onEdit, onWA, onResend }) {
  const now = new Date()
  const days = b.date ? Math.floor((now - new Date(b.date)) / 86400000) : 0
  const urg = urgency(days)

  return (
    <div className={`seg-card urg-${urg.cls}`}>
      <div className={`seg-light ${urg.cls}`}><i className={`fa ${urg.icon}`} /></div>
      <div className="seg-info">
        <div className="seg-top">
          <span className="seg-num">{b.num}</span>
          <Badge status={b.status} />
          <span style={{ fontSize: 11, fontWeight: 600, color: urg.color, background: urg.color + '15', padding: '2px 8px', borderRadius: 12 }}>{urg.label}</span>
        </div>
        <div className="seg-cli"><b>{b.contact || 'Sin contacto'}</b> — {b.company || 'Sin empresa'}</div>
        <div className="seg-co">
          {b.ocasion && <><i className="fa fa-calendar-day" style={{ marginRight: 4 }} />{b.ocasion}  ·  </>}
          <i className="fa fa-calendar" style={{ marginRight: 4 }} />Enviado: {b.date || '—'}
          {b.deliveryDate && ` · Entrega: ${b.deliveryDate}`}
        </div>
      </div>
      <div className="seg-meta">
        <div className="seg-days">
          <div className="num" style={{ color: urg.color }}>{days}</div>
          <div className="lbl" style={{ color: urg.color }}>días</div>
        </div>
        <div className="seg-total">{fmt(b.total)}</div>
        <div className="seg-actions">
          <button className="act edit" onClick={() => onEdit(b.id)} title="Editar"><i className="fa fa-pen" /></button>
          <button className="act wa" onClick={() => onWA(b)} title="WhatsApp"><i className="fa-brands fa-whatsapp" /></button>
          <button className="act resend" onClick={() => onResend(b)} title="Re-enviar presupuesto"><i className="fa fa-paper-plane" /></button>
        </div>
      </div>
    </div>
  )
}

/* ── Resend Modal ── */
function ResendModal({ budget, onClose, onSend }) {
  const defaultMsg = `Hola ${budget.contact || ''}! 👋\n\nTe escribo para darle seguimiento al presupuesto ${budget.num || ''} que te enviamos el ${budget.date || '—'} por un total de ${fmt(budget.total)}.\n\n¿Pudiste revisarlo? Estamos a disposición para cualquier consulta o ajuste que necesites.\n\n¡Saludos!\nEquipo ANMA`
  const [msg, setMsg] = useState(defaultMsg)

  const copyAndClose = () => {
    navigator.clipboard.writeText(msg).then(() => onSend())
  }

  const openWA = () => {
    if (budget.wa) {
      const num = budget.wa.replace(/\D/g, '')
      window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, '_blank')
    }
    onSend()
  }

  return (
    <div className="modal-bg open" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="mh">
          <h3><i className="fa fa-paper-plane" style={{ color: 'var(--brand)', marginRight: 8 }} />Re-enviar presupuesto</h3>
          <button className="mclose" onClick={onClose}><i className="fa fa-xmark" /></button>
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ background: 'var(--brand-xlt)', color: 'var(--brand)', padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
            <i className="fa fa-file-invoice" style={{ marginRight: 6 }} />{budget.num || '—'}
          </div>
          <div style={{ background: 'var(--surface2)', color: 'var(--txt2)', padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
            <i className="fa fa-building" style={{ marginRight: 6 }} />{budget.company || budget.contact || '—'}
          </div>
          <div style={{ background: 'var(--green-lt)', color: 'var(--green)', padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
            {fmt(budget.total)}
          </div>
        </div>

        <div className="fg">
          <label>Mensaje de seguimiento</label>
          <textarea value={msg} onChange={e => setMsg(e.target.value)} rows={8}
            style={{ fontFamily: 'inherit', lineHeight: 1.6, fontSize: 13 }} />
        </div>

        <div className="mfooter">
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-secondary" onClick={copyAndClose}>
            <i className="fa fa-copy" /> Copiar texto
          </button>
          {budget.wa && (
            <button className="btn btn-primary" style={{ background: '#25D366' }} onClick={openWA}>
              <i className="fa-brands fa-whatsapp" /> Enviar por WhatsApp
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Historial() {
  const { get, config, updateBudgetStatus, deleteBudget } = useData()
  const toast = useToast()
  const nav = useNavigate()
  const [tab, setTab] = useState('resumen')
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [resendBudget, setResendBudget] = useState(null)

  const budgets = get('budgets')
  const c = config()
  const now = new Date()
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  useEffect(() => { const t = setTimeout(() => setLoading(false), 80); return () => clearTimeout(t) }, [])

  // KPI calculations
  const monthBudgets = budgets.filter(b => b.date?.startsWith(ym))
  const confirmed = budgets.filter(b => b.status === 'confirmed')
  const totConf = confirmed.reduce((s, b) => s + (b.total || 0), 0)
  const mInc = monthBudgets.reduce((s, b) => s + (b.total || 0), 0)
  const mGain = monthBudgets.reduce((s, b) => s + (b.totalGain || 0), 0)
  const convRate = budgets.length ? Math.round(confirmed.length / budgets.length * 100) + '%' : '—'

  // Income bars (last 6 months)
  const incomeData = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const val = budgets.filter(b => b.date?.startsWith(key) && b.status === 'confirmed').reduce((s, b) => s + (b.total || 0), 0)
    incomeData.push({ lbl: MONTHS[d.getMonth()], val })
  }

  const gainData = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const val = budgets.filter(b => b.date?.startsWith(key) && b.status === 'confirmed').reduce((s, b) => s + (b.totalGain || 0), 0)
    gainData.push({ lbl: MONTHS[d.getMonth()], val })
  }

  // Status progress
  const statuses = [
    { k: 'draft', l: 'Borrador', c: '#94A3B8' },
    { k: 'sent', l: 'Enviado', c: 'var(--blue)' },
    { k: 'negotiating', l: 'Negociando', c: 'var(--amber)' },
    { k: 'confirmed', l: 'Confirmado', c: 'var(--green)' },
    { k: 'lost', l: 'Perdido', c: 'var(--red)' },
  ]

  // Filtered budgets for list tab
  let filteredBudgets = [...budgets]
  if (filter !== 'all') filteredBudgets = filteredBudgets.filter(b => b.status === filter)
  if (search) {
    const sq = search.toLowerCase()
    filteredBudgets = filteredBudgets.filter(b =>
      (b.company || '').toLowerCase().includes(sq) ||
      (b.contact || '').toLowerCase().includes(sq) ||
      (b.num || '').toLowerCase().includes(sq)
    )
  }
  filteredBudgets.sort((a, b) => b.id - a.id)

  // Seguimiento: ALL pending budgets (sent/negotiating), grouped by tier
  const seguimiento = useMemo(() => {
    return budgets
      .filter(b => ['sent', 'negotiating'].includes(b.status))
      .map(b => ({ ...b, days: b.date ? Math.floor((now - new Date(b.date)) / 86400000) : 0 }))
      .sort((a, b) => b.days - a.days)
  }, [budgets])

  const tierGroups = useMemo(() => {
    return TIERS.map(tier => ({
      ...tier,
      items: seguimiento.filter(b => b.days >= tier.min && b.days <= tier.max)
    }))
  }, [seguimiento])

  // Dashboard mini-timeline: top 3 most urgent (red tier first, then orange, etc.)
  const urgentTop3 = useMemo(() => {
    return seguimiento.slice(0, 3)
  }, [seguimiento])

  // Top clients
  const byClient = {}
  confirmed.forEach(b => { const k = b.company || b.contact || '—'; byClient[k] = (byClient[k] || 0) + (b.total || 0) })
  const topClients = Object.entries(byClient).sort((a, b) => b[1] - a[1]).slice(0, 5)

  // Analysis metrics
  const totBudgeted = budgets.reduce((s, b) => s + (b.total || 0), 0)
  const totGain = confirmed.reduce((s, b) => s + (b.totalGain || 0), 0)
  const avgTicket = confirmed.length ? Math.round(totConf / confirmed.length) : 0

  const editB = (id) => nav(`/presupuesto/${id}`)
  const copyWA = (b) => {
    const text = `Hola ${b.contact || ''}! Te envío el presupuesto ${b.num} por ${fmt(b.total)}. Quedamos a disposición!`
    navigator.clipboard.writeText(text).then(() => toast('Mensaje WA copiado', 'ok'))
  }
  const handleDelete = (id) => { if (window.confirm('¿Eliminar este presupuesto?')) { deleteBudget(id); toast('Presupuesto eliminado', 'in') } }
  const handleStatusChange = (id, status) => { updateBudgetStatus(id, status); toast('Estado actualizado', 'ok') }

  /* ── ESC cierra modales ── */
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        if (resendBudget) { setResendBudget(null); return }
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [resendBudget])

  const handleResend = (b) => setResendBudget(b)
  const handleResendSent = () => { toast('Mensaje copiado / enviado', 'ok'); setResendBudget(null) }

  const exportCSV = () => {
    const rows = [['N°', 'Fecha', 'Cliente', 'Empresa', 'Total', 'Ganancia', 'Estado'].join(',')]
    budgets.forEach(b => rows.push([b.num, b.date, b.contact, b.company, b.total, b.totalGain, STATUS_MAP[b.status]].join(',')))
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `presupuestos_${new Date().toISOString().slice(0, 10)}.csv`; a.click()
  }

  const openWADirect = (b) => {
    if (!b.wa) { copyWA(b); return }
    const num = b.wa.replace(/\D/g, '')
    const text = `Hola ${b.contact || ''}! Te escribo por el presupuesto ${b.num} por ${fmt(b.total)}. ¿Pudiste revisarlo? Quedamos a disposición!`
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(text)}`, '_blank')
  }

  return (
    <div className="page active" style={{ animation: 'pgIn .25s ease both' }}>
      <div className="ph">
        <div className="ph-left"><h2>Historial</h2><p>Registro de presupuestos y análisis del negocio</p></div>
        <div className="ph-right">
          <button className="btn btn-secondary btn-sm" onClick={exportCSV}><i className="fa fa-download" /> Exportar</button>
          <button className="btn btn-primary btn-sm" onClick={() => nav('/presupuesto')}><i className="fa fa-plus" /> Nuevo presupuesto</button>
        </div>
      </div>

      <div className="tab-bar">
        {['resumen', 'lista', 'analisis', 'seguimiento'].map(t => (
          <div key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'resumen' ? 'Resumen' : t === 'lista' ? 'Presupuestos' : t === 'analisis' ? 'Análisis' : `Seguimiento (${seguimiento.length})`}
          </div>
        ))}
      </div>

      {/* ═══ RESUMEN / DASHBOARD ═══ */}
      {tab === 'resumen' && (
        <>
          {loading ? (
            <div className="bento">
              <div className="sk sk-kpi" /><div className="sk sk-kpi" /><div className="sk sk-kpi" /><div className="sk sk-kpi" />
              <div className="sk sk-kpi bento-wide" style={{ height: 180 }} />
              <div className="sk sk-kpi bento-wide" style={{ height: 180 }} />
            </div>
          ) : (
            <div className="bento sk-fade-in">
              <KpiCard label="Total facturado" value={fmt(totConf)} foot="presupuestos confirmados" color="brand" icon="fa-dollar-sign" />
              <KpiCard label="Ingresos del mes" value={fmt(mInc)} foot={`${monthBudgets.length} presupuestos`} color="blue" icon="fa-chart-line" />
              <KpiCard label="Ganancia del mes" value={fmt(mGain)} foot="del período actual" color="green" icon="fa-coins" />
              <KpiCard label="Tasa de conversión" value={convRate} foot={`${confirmed.length} de ${budgets.length} confirmados`} color="amber" icon="fa-funnel" />

              <div className="bento-chart bento-wide">
                <div className="card-header"><span className="card-title"><i className="fa fa-chart-bar" style={{ color: 'var(--brand)', marginRight: 7 }} />Ingresos confirmados — 6 meses</span></div>
                <BarChart data={incomeData} />
              </div>

              {/* ── Mini-Timeline: top 3 urgentes ── */}
              <div className="bento-seg">
                <div className="bento-seg-title"><i className="fa fa-fire" />Seguimiento activo</div>
                {urgentTop3.length ? (
                  <>
                    {urgentTop3.map(b => {
                      const urg = urgency(b.days)
                      return (
                        <div key={b.id} className="mini-seg-item" style={{ borderLeft: `3px solid ${urg.color}` }}>
                          <div className="mini-seg-header">
                            <div className={`seg-light ${urg.cls}`} style={{ width: 30, height: 30, fontSize: 12 }}>
                              <i className={`fa ${urg.icon}`} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 700, fontSize: 12, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {b.company || b.contact || '—'}
                              </div>
                              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.45)' }}>
                                {b.num} · {b.days} días · {fmt(b.total)}
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button className="mini-seg-btn wa" onClick={() => openWADirect(b)} title="WhatsApp directo">
                                <i className="fa-brands fa-whatsapp" />
                              </button>
                              <button className="mini-seg-btn resend" onClick={() => handleResend(b)} title="Re-enviar">
                                <i className="fa fa-paper-plane" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                    {seguimiento.length > 3 && (
                      <div className="mini-seg-more" onClick={() => setTab('seguimiento')}>
                        Ver {seguimiento.length - 3} más <i className="fa fa-arrow-right" style={{ marginLeft: 4 }} />
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: 28, color: 'rgba(255,255,255,.35)', fontSize: 12 }}>
                    <i className="fa fa-check-circle" style={{ fontSize: 20, marginBottom: 8, display: 'block' }} />
                    Sin presupuestos pendientes
                  </div>
                )}
              </div>

              <div className="bento-chart bento-wide">
                <div className="card-header"><span className="card-title">Estado de presupuestos</span></div>
                {statuses.map(s => {
                  const n = budgets.filter(b => b.status === s.k).length
                  const pct = budgets.length ? Math.round(n / budgets.length * 100) : 0
                  return (
                    <div key={s.k} className="prog-item">
                      <div className="prog-head"><span style={{ fontSize: 12, color: 'var(--txt2)' }}>{s.l}</span><span style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt)' }}>{n}</span></div>
                      <div className="prog-track"><div className="prog-fill" style={{ width: `${pct}%`, background: s.c }} /></div>
                    </div>
                  )
                })}
              </div>

              <div className="bento-chart bento-wide">
                <div className="card-header">
                  <span className="card-title">Últimos presupuestos</span>
                  <span className="card-link" onClick={() => setTab('lista')}>Ver todos <i className="fa fa-arrow-right" /></span>
                </div>
                {budgets.length ? (
                  <table>
                    <thead><tr><th>N°</th><th>Cliente</th><th>Total</th><th>Estado</th><th></th></tr></thead>
                    <tbody>
                      {[...budgets].sort((a, b) => b.id - a.id).slice(0, 6).map(b => (
                        <tr key={b.id}>
                          <td><b>{b.num || '—'}</b></td>
                          <td>{b.company || b.contact || '—'}</td>
                          <td style={{ fontWeight: 700, color: 'var(--brand)' }}>{fmt(b.total)}</td>
                          <td><Badge status={b.status} /></td>
                          <td>
                            <div className="acts">
                              <button className="act edit" onClick={() => editB(b.id)} title="Editar"><i className="fa fa-pen" /></button>
                              <button className="act wa" onClick={() => copyWA(b)} title="WA"><i className="fa-brands fa-whatsapp" /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="empty"><div className="ico"><i className="fa fa-file-invoice" /></div><h4>Sin presupuestos</h4><p>Creá el primero con el botón de arriba</p></div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══ LISTA ═══ */}
      {tab === 'lista' && (
        <>
          <div className="pill-row">
            <div className="search-row" style={{ maxWidth: 300 }}>
              <i className="fa fa-magnifying-glass" />
              <input type="text" placeholder="Buscar cliente, empresa..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            {['all', 'draft', 'sent', 'negotiating', 'confirmed', 'lost'].map(f => (
              <div key={f} className={`pill ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
                {f === 'all' ? 'Todos' : STATUS_MAP[f]}
              </div>
            ))}
          </div>
          <div className="tbl-card">
            <table>
              <thead><tr><th>N°</th><th>Fecha</th><th>Cliente</th><th>Empresa</th><th>Entrega</th><th>Total</th><th>Ganancia</th><th>Estado</th><th>Acciones</th></tr></thead>
              <tbody>
                {filteredBudgets.length ? filteredBudgets.map(b => (
                  <tr key={b.id}>
                    <td><b>{b.num || '—'}</b></td>
                    <td>{b.date || '—'}</td>
                    <td>{b.contact || '—'}</td>
                    <td style={{ color: 'var(--blue)', cursor: 'pointer' }} onClick={() => { setSearch(b.company || ''); setFilter('all') }}>{b.company || '—'}</td>
                    <td>{b.deliveryDate || '—'}</td>
                    <td style={{ fontWeight: 700, color: 'var(--brand)' }}>{fmt(b.total)}</td>
                    <td style={{ color: 'var(--green)', fontWeight: 600 }}>{fmt(b.totalGain)}</td>
                    <td>
                      <select style={{ fontSize: 11, padding: '4px 8px', border: '2px solid var(--border)', borderRadius: 8, fontFamily: 'inherit', background: 'var(--surface)', cursor: 'pointer', outline: 'none' }}
                        value={b.status} onChange={e => handleStatusChange(b.id, e.target.value)}>
                        {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </td>
                    <td>
                      <div className="acts">
                        <button className="act edit" onClick={() => editB(b.id)} title="Editar"><i className="fa fa-pen" /></button>
                        <button className="act wa" onClick={() => copyWA(b)} title="WA"><i className="fa-brands fa-whatsapp" /></button>
                        <button className="act del" onClick={() => handleDelete(b.id)} title="Eliminar"><i className="fa fa-trash" /></button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={9}><div className="empty"><div className="ico"><i className="fa fa-file-invoice" /></div><p>No hay presupuestos con este filtro</p></div></td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--txt3)' }}>{filteredBudgets.length} presupuesto{filteredBudgets.length !== 1 ? 's' : ''}</div>
        </>
      )}

      {/* ═══ ANÁLISIS ═══ */}
      {tab === 'analisis' && (
        <div className="analysis-grid">
          <div className="card">
            <div className="card-header"><span className="card-title"><i className="fa fa-chart-pie" style={{ color: 'var(--brand)', marginRight: 6 }} />Métricas globales</span></div>
            {[['Total presupuestado', fmt(totBudgeted)], ['Total confirmado', fmt(totConf)], ['Ganancia acumulada', fmt(totGain)], ['Ticket promedio', fmt(avgTicket)], ['Tasa de conversión', convRate], ['Nº de presupuestos', budgets.length]].map(([l, v], i) => (
              <div key={i} className="metric-row"><span className="mr-label">{l}</span><span className="mr-val">{v}</span></div>
            ))}
          </div>
          <div className="card">
            <div className="card-header"><span className="card-title"><i className="fa fa-trophy" style={{ color: 'var(--amber)', marginRight: 6 }} />Clientes top</span></div>
            {topClients.length ? topClients.map(([n, v], i) => (
              <div key={i} className="metric-row"><span className="mr-label">{n}</span><span className="mr-val" style={{ color: 'var(--brand)' }}>{fmt(v)}</span></div>
            )) : <div className="empty" style={{ padding: 20 }}><p>Sin datos</p></div>}
          </div>
          <div className="card">
            <div className="card-header"><span className="card-title"><i className="fa fa-funnel" style={{ color: 'var(--green)', marginRight: 6 }} />Conversión por estado</span></div>
            {statuses.map(s => {
              const n = budgets.filter(b => b.status === s.k).length
              const p = budgets.length ? Math.round(n / budgets.length * 100) : 0
              return (
                <div key={s.k} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.c, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: 'var(--txt2)', flex: 1 }}>{s.l}</span>
                  <div style={{ flex: 2, height: 6, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${p}%`, background: s.c }} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, width: 20, textAlign: 'right' }}>{n}</span>
                </div>
              )
            })}
          </div>
          <div className="card">
            <div className="card-header"><span className="card-title"><i className="fa fa-coins" style={{ color: 'var(--amber)', marginRight: 6 }} />Ganancia por mes</span></div>
            <BarChart data={gainData} type="gain" />
          </div>
        </div>
      )}

      {/* ═══ SEGUIMIENTO ACTIVO — Grouped by urgency tier ═══ */}
      {tab === 'seguimiento' && (
        <>
          <div className="seg-legend">
            <div className="seg-legend-item"><div className="seg-legend-dot" style={{ background: 'var(--red)' }} />15+ días — Crítico</div>
            <div className="seg-legend-item"><div className="seg-legend-dot" style={{ background: '#EA580C' }} />8–14 días — Urgente</div>
            <div className="seg-legend-item"><div className="seg-legend-dot" style={{ background: 'var(--amber)' }} />4–7 días — Atención</div>
            <div className="seg-legend-item"><div className="seg-legend-dot" style={{ background: 'var(--green)' }} />0–3 días — Reciente</div>
          </div>

          {seguimiento.length ? (
            tierGroups.map(tier => {
              if (!tier.items.length) return null
              return (
                <div key={tier.key} className="seg-tier-group">
                  <div className="seg-tier-header" style={{ borderLeftColor: tier.color }}>
                    <i className={`fa ${tier.icon}`} style={{ color: tier.color, marginRight: 8 }} />
                    <span style={{ color: tier.color, fontWeight: 700 }}>{tier.label}</span>
                    <span className="seg-tier-count" style={{ background: tier.color + '18', color: tier.color }}>{tier.items.length}</span>
                  </div>
                  {tier.items.map(b => (
                    <SeguimientoCard key={b.id} b={b} onEdit={editB} onWA={copyWA} onResend={handleResend} />
                  ))}
                </div>
              )
            })
          ) : (
            <div className="empty">
              <div className="ico"><i className="fa fa-check-circle" /></div>
              <h4>Sin presupuestos pendientes de respuesta</h4>
              <p>Los presupuestos enviados y en negociación aparecen acá agrupados por urgencia</p>
            </div>
          )}
        </>
      )}

      {/* ═══ Resend Modal ═══ */}
      {resendBudget && (
        <ResendModal budget={resendBudget} onClose={() => setResendBudget(null)} onSend={handleResendSent} />
      )}
    </div>
  )
}

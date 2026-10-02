/* ═══════════════════════════════════════════════════════════════════
   PedidoDrawer (ANMA Hub) — vista lateral de lectura rápida.
   ─────────────────────────────────────────────────────────────────
   Side sheet a la derecha estilo Notion/Linear/Stripe:
   un click = ves todo; otro click = editás. Reemplaza el modal
   con iframe PDF que vivía dentro de Historial.jsx (ruidoso y lento).

   Patrón UNIFICADO con ANMA Regalos (components/common/PedidoDrawer):
     · Header sticky con número + estado + cliente
     · KPIs cuadrícula (Facturado · Costo · Ganancia · Margen)
     · Info clave 2x2 (fecha / entrega / dirección / WhatsApp)
     · Productos (desde b.items — modelo Hub)
     · Precio (subtotal + IVA + total)
     · Cobro — contextual al estado: solo alarma cuando corresponde
     · Entrega · Nota · Historial · Link al cliente
     · Footer sticky: Editar + WA
═══════════════════════════════════════════════════════════════════ */
import { useEffect } from 'react'
import { fmt, fmtDate, STATUS_MAP, PAY_STATUS_MAP } from '../../lib/storage'

const STATUS_COLOR = {
  draft:       '#94A3B8',
  sent:        '#3B82F6',
  negotiating: '#D97706',
  confirmed:   '#16A34A',
  lost:        '#DC2626',
}

const PAY_COLOR = { pending: '#DC2626', partial: '#D97706', paid: '#16A34A' }

// Estados donde el pedido TODAVÍA no genera compromiso de cobro.
// En estos, el bloque "Cobro" no debe mostrar saldo pendiente en rojo
// porque confunde: aún no hay deuda, es apenas un presupuesto.
const SIN_COMPROMISO = new Set(['draft', 'sent', 'negotiating', 'lost'])

const fmtEvento = (ts) => {
  if (!ts) return '—'
  const d = new Date(Number(ts))
  const fecha = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
  const diff = Date.now() - Number(ts)
  const dias = Math.floor(diff / 86400000)
  const rel = dias <= 0 ? 'hoy' : dias === 1 ? 'ayer' : `hace ${dias}d`
  return `${fecha} · ${rel}`
}

const numV = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }

// Deriva totales desde el budget del Hub (sin romper si faltan campos)
function derive(b) {
  const items = Array.isArray(b.items) ? b.items.filter(i => i && (i.name || i.qty || i.priceUnit)) : []
  const subtotal = items.reduce((s, i) => s + numV(i.qty) * numV(i.priceUnit), 0)
  const total    = numV(b.totalFinal) || numV(b.total) || subtotal + numV(b.ivaAmt)
  const iva      = numV(b.ivaAmt) || Math.max(0, total - subtotal)
  const costo    = numV(b.totalCost) || items.reduce((s, i) => s + numV(i.cost) * numV(i.qty), 0)
  const ganancia = b.totalGain != null ? numV(b.totalGain) : total - costo
  const margen   = total > 0 ? Math.round((ganancia / total) * 100) : 0
  const pagos    = Array.isArray(b.payments) ? b.payments : []
  const cobrado  = pagos.reduce((s, p) => s + numV(p.amount), 0)
  const seña     = numV(b.depositAmt)
  const saldo    = Math.max(0, total - cobrado)
  return { items, subtotal, total, iva, costo, ganancia, margen, pagos, cobrado, seña, saldo }
}

export default function PedidoDrawer({
  budget, onClose, onEdit, onWA, onVerCliente,
  onRegistrarPago, onCobrarWA, onSharePC,
}) {
  useEffect(() => {
    if (!budget) return
    const onEsc = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onEsc)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onEsc)
      document.body.style.overflow = prev
    }
  }, [budget, onClose])

  if (!budget) return null

  const b = budget
  const estado  = b.status || 'draft'
  const eColor  = STATUS_COLOR[estado] || '#94A3B8'
  const payStatus = b.payStatus || 'pending'
  const t = derive(b)
  const sinCompromiso = SIN_COMPROMISO.has(estado)

  // Línea del tiempo liviana: creación + payments + status (si se guardó timestamp)
  const timeline = []
  if (b.createdAt || b.date) {
    timeline.push({ type: 'creado', label: 'Pedido creado', at: b.createdAt || new Date(b.date).getTime() })
  }
  if (b.sentAt)      timeline.push({ type: 'estado', estado: 'sent',        label: 'Presupuesto enviado',  at: b.sentAt })
  if (b.confirmedAt) timeline.push({ type: 'estado', estado: 'confirmed',   label: 'Pedido confirmado',    at: b.confirmedAt })
  if (b.lostAt)      timeline.push({ type: 'estado', estado: 'lost',        label: 'Pedido perdido',       at: b.lostAt })
  t.pagos.forEach((p, i) => {
    const at = p.date ? new Date(p.date).getTime() : p.at
    timeline.push({ type: 'pago', label: `Pago registrado · ${fmt(numV(p.amount))}`, at })
  })
  if (b.lastContactAt) {
    timeline.push({ type: 'contacto', label: `Contacto por ${b.lastContactChannel === 'wa' ? 'WhatsApp' : 'canal'}`, at: b.lastContactAt })
  }
  timeline.sort((a, b) => (a.at || 0) - (b.at || 0))

  const infoCards = [
    { icon: 'fa-calendar-day', label: 'Fecha', value: fmtDate(b.date) },
    { icon: 'fa-truck-fast',   label: 'Entrega', value: b.deliveryDate ? fmtDate(b.deliveryDate) : null },
    { icon: 'fa-location-dot', label: 'Dirección', value: b.deliveryAddress || null },
    { icon: 'fa-comment-dots', label: 'WhatsApp', value: b.wa || null },
  ].filter(c => c.value)

  const nota = b.noteInt

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)',
        zIndex: 500, animation: 'drawerFade .2s ease both',
      }} />

      <aside className="pd-aside" style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 'min(520px, 100vw)', background: 'var(--surface)',
        zIndex: 501, display: 'flex', flexDirection: 'column',
        boxShadow: '-12px 0 40px rgba(15,23,42,.15)',
        animation: 'drawerIn .28s cubic-bezier(.16,1,.3,1) both',
      }}>

        {/* HEADER */}
        <header style={{
          padding: '18px 22px 14px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexShrink: 0,
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-.5px', color: 'var(--txt)' }}>
                {b.num || '—'}
              </span>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                background: eColor + '18', color: eColor, border: `1px solid ${eColor}30`,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: eColor }} />
                {STATUS_MAP[estado] || estado}
              </span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--txt2)', fontWeight: 500 }}>
              {b.company || b.contact || 'Sin cliente'}
              {b.company && b.contact && (
                <span style={{ color: 'var(--txt3)' }}> · {b.contact}</span>
              )}
            </div>
          </div>
          <button onClick={onClose} title="Cerrar (Esc)" style={{
            width: 32, height: 32, borderRadius: 8, border: 'none',
            background: 'var(--surface2)', color: 'var(--txt2)',
            cursor: 'pointer', fontSize: 14, flexShrink: 0,
          }}>
            <i className="fa fa-xmark" />
          </button>
        </header>

        {/* BODY */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '18px 22px', WebkitOverflowScrolling: 'touch' }}>

          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
            {[
              { label: 'Facturado', value: fmt(t.total),    icon: 'fa-file-invoice-dollar', color: '#7C3AED' },
              { label: 'Costo',     value: fmt(t.costo),    icon: 'fa-lock',                color: '#b45309' },
              { label: 'Ganancia',  value: fmt(t.ganancia), icon: 'fa-arrow-trend-up',      color: t.ganancia >= 0 ? '#15803d' : '#DC2626' },
              { label: 'Margen',    value: `${t.margen}%`,  icon: 'fa-bullseye',            color: '#6366f1' },
            ].map(c => (
              <div key={c.label} style={{
                background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10,
                padding: '8px 10px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--txt4)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 2 }}>
                  <i className={`fa ${c.icon}`} style={{ color: c.color, marginRight: 3, fontSize: 9 }} />
                  {c.label}
                </div>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--txt)', fontVariantNumeric: 'tabular-nums' }}>{c.value}</div>
              </div>
            ))}
          </div>

          {/* Info clave — SOLO campos con valor (sin ruido de "—") */}
          {infoCards.length > 0 && (
            <div className="pd-info-grid" style={{
              display: 'grid',
              gridTemplateColumns: infoCards.length === 1 ? '1fr' : 'repeat(2, 1fr)',
              gap: 10, marginBottom: 18,
            }}>
              {infoCards.map(c => <MiniKpi key={c.label} icon={c.icon} label={c.label} value={c.value} />)}
            </div>
          )}

          {/* PRODUCTOS */}
          <SectionHead icon="fa-list-check" title="Productos" count={t.items.length} />
          {t.items.length === 0
            ? <EmptyRow text="Sin productos cargados" />
            : (
              <div style={{
                background: 'var(--surface2)', border: '1px solid var(--border)',
                borderRadius: 10, overflow: 'hidden', marginBottom: 18,
              }}>
                {t.items.map((it, i) => {
                  const qty = numV(it.qty)
                  const pu  = numV(it.priceUnit)
                  const cu  = numV(it.cost)
                  const sub = qty * pu
                  return (
                    <div key={it.id || i} style={{
                      display: 'grid', gridTemplateColumns: '1fr auto', gap: 6,
                      padding: '10px 14px', fontSize: 12,
                      borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                    }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: 'var(--txt)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {it.name || '(sin descripción)'}
                          {it.variant && <span style={{ color: 'var(--txt4)', fontWeight: 500 }}> · {it.variant}</span>}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 2 }}>
                          {qty} × {fmt(pu)}
                          {cu > 0 && <> · <span style={{ color: 'var(--txt4)' }}>costo</span> {fmt(cu)}</>}
                        </div>
                      </div>
                      <div style={{ fontWeight: 700, color: 'var(--txt)', textAlign: 'right', alignSelf: 'center', whiteSpace: 'nowrap' }}>
                        {fmt(sub)}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          }

          {/* PRECIO */}
          <SectionHead icon="fa-coins" title="Precio" />
          <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', marginBottom: 18 }}>
            <MoneyRow label="Subtotal" value={fmt(t.subtotal)} />
            {t.iva > 0 && <MoneyRow label="IVA" value={fmt(t.iva)} />}
            <div style={{ height: 1, background: 'var(--border)', margin: '8px 0' }} />
            <MoneyRow label="TOTAL" value={fmt(t.total)} strong big />
            <div style={{ display: 'flex', gap: 14, marginTop: 8, fontSize: 11, color: 'var(--txt3)', flexWrap: 'wrap' }}>
              <span>Costo <b style={{ color: 'var(--txt2)' }}>{fmt(t.costo)}</b></span>
              <span>Ganancia <b style={{ color: t.ganancia >= 0 ? 'var(--green, #15803d)' : '#dc2626' }}>{fmt(t.ganancia)}</b></span>
              <span>Margen <b style={{ color: 'var(--txt2)' }}>{t.margen}%</b></span>
            </div>
          </div>

          {/* COBRO — contextual */}
          <SectionHead icon="fa-hand-holding-dollar" title="Cobro" />
          <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--txt3)' }}>Estado</span>
              {sinCompromiso ? (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '2px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                  background: '#F1F5F9', color: '#64748B', border: '1px solid #E2E8F0',
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#94A3B8' }} />
                  Sin cobros aún
                </span>
              ) : (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '2px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                  background: PAY_COLOR[payStatus] + '15', color: PAY_COLOR[payStatus],
                  border: `1px solid ${PAY_COLOR[payStatus]}30`,
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: PAY_COLOR[payStatus] }} />
                  {PAY_STATUS_MAP[payStatus] || 'Pendiente'}
                </span>
              )}
            </div>

            {t.seña > 0 && <MoneyRow label="Seña" value={fmt(t.seña)} />}
            {t.cobrado > 0 && <MoneyRow label={`Cobrado (${t.pagos.length} pago${t.pagos.length > 1 ? 's' : ''})`} value={fmt(t.cobrado)} />}

            {/* Saldo: solo cuando hay compromiso real */}
            {!sinCompromiso && (
              <MoneyRow
                label="Saldo pendiente"
                value={fmt(t.saldo)}
                strong={t.saldo > 0 && payStatus !== 'paid'}
              />
            )}

            {/* En estados sin compromiso, mostramos el potencial sin alarma */}
            {sinCompromiso && t.cobrado === 0 && (
              <div style={{ fontSize: 11, color: 'var(--txt4)', fontStyle: 'italic', textAlign: 'center', padding: '6px 0' }}>
                Confirmá el pedido para activar el cobro
              </div>
            )}

            {/* Acciones de cobro */}
            {!sinCompromiso && payStatus !== 'paid' && (onRegistrarPago || onCobrarWA) && (
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                {onCobrarWA && (
                  <button onClick={() => onCobrarWA(b)} title="Enviar pedido de pago al cliente por WhatsApp"
                    style={{
                      flex: 1, padding: '9px 12px',
                      background: '#25D366', color: '#fff', border: 'none',
                      borderRadius: 9, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                      fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                    }}>
                    <i className="fa-brands fa-whatsapp" /> Pedir pago
                  </button>
                )}
                {onRegistrarPago && (
                  <button onClick={() => onRegistrarPago(b)} title="Registrar un pago recibido"
                    style={{
                      flex: 1, padding: '9px 12px',
                      background: '#F0FDF4', color: '#15803D', border: '1px solid #86EFAC',
                      borderRadius: 9, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                      fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                    }}>
                    <i className="fa fa-hand-holding-dollar" /> Registrar
                  </button>
                )}
              </div>
            )}

            {onSharePC && (
              <button onClick={() => onSharePC(b)}
                title="Genera un link con el estado del pedido para compartir con el cliente"
                style={{
                  marginTop: 8, width: '100%', padding: '9px 12px',
                  background: 'var(--brand-xlt)', color: 'var(--brand)',
                  border: '1px solid rgba(124,58,237,.25)', borderRadius: 9,
                  cursor: 'pointer', fontSize: 12, fontWeight: 700,
                  fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                }}>
                <i className="fa fa-share-nodes" /> Compartir pedido con el cliente
              </button>
            )}
          </div>

          {/* ENTREGA — solo si hay algo que mostrar */}
          {(b.deliveryDate || b.deliveryAddress) && (
            <>
              <SectionHead icon="fa-truck-fast" title="Entrega" />
              <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', marginBottom: 18, fontSize: 12, color: 'var(--txt2)', lineHeight: 1.7 }}>
                {b.deliveryDate && <div><b style={{ color: 'var(--txt3)', fontWeight: 600, marginRight: 6 }}>Fecha:</b> {fmtDate(b.deliveryDate)}</div>}
                {b.deliveryAddress && <div><b style={{ color: 'var(--txt3)', fontWeight: 600, marginRight: 6 }}>Dirección:</b> {b.deliveryAddress}</div>}
              </div>
            </>
          )}

          {/* NOTA INTERNA */}
          {nota && (
            <>
              <SectionHead icon="fa-pen-to-square" title="Nota interna" />
              <div style={{
                background: '#FEF3C7', border: '1px solid #FDE68A',
                borderRadius: 10, padding: '10px 14px', marginBottom: 18,
                fontSize: 12, color: '#78350F', whiteSpace: 'pre-wrap', lineHeight: 1.5,
              }}>
                {nota}
              </div>
            </>
          )}

          {/* HISTORIAL */}
          {timeline.length > 0 && (
            <>
              <SectionHead icon="fa-clock-rotate-left" title="Historial" />
              <div style={{ padding: '4px 4px 14px 6px', marginBottom: 14 }}>
                {timeline.map((ev, i) => {
                  const color = ev.type === 'estado' ? (STATUS_COLOR[ev.estado] || 'var(--brand)')
                              : ev.type === 'pago' ? '#16A34A'
                              : ev.type === 'contacto' ? '#25D366'
                              : 'var(--txt3)'
                  const icon = ev.type === 'creado' ? 'fa-plus'
                             : ev.type === 'pago' ? 'fa-hand-holding-dollar'
                             : ev.type === 'contacto' ? 'fa-comment-dots'
                             : 'fa-circle'
                  const isLast = i === timeline.length - 1
                  return (
                    <div key={i} style={{ display: 'flex', gap: 12, position: 'relative' }}>
                      {!isLast && (
                        <div style={{ position: 'absolute', left: 9, top: 20, bottom: -6, width: 2, background: 'var(--border)' }} />
                      )}
                      <div style={{
                        width: 20, height: 20, borderRadius: '50%', flexShrink: 0, zIndex: 1,
                        background: color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 9,
                      }}>
                        <i className={`fa ${icon}`} />
                      </div>
                      <div style={{ paddingBottom: isLast ? 0 : 14, flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--txt)' }}>{ev.label}</div>
                        <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 1 }}>{fmtEvento(ev.at)}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {/* Link al cliente */}
          {onVerCliente && (b.company || b.contact) && (
            <button onClick={onVerCliente}
              style={{
                width: '100%', padding: '10px 12px', marginTop: 4,
                background: 'transparent', border: '1px dashed var(--border2)',
                borderRadius: 10, cursor: 'pointer', fontSize: 12,
                color: 'var(--txt3)', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.color = 'var(--brand)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--txt3)' }}>
              <i className="fa fa-user" />
              Ver todos los pedidos de este cliente
            </button>
          )}
        </div>

        {/* FOOTER */}
        <footer style={{
          padding: '14px 22px', borderTop: '1px solid var(--border)',
          display: 'flex', gap: 8, background: 'var(--surface)', flexShrink: 0,
        }}>
          <button onClick={onEdit} className="btn btn-primary" style={{ flex: 1 }}>
            <i className="fa fa-pen" /> Editar pedido
          </button>
          {b.wa && onWA && (
            <button onClick={onWA} title="Enviar por WhatsApp" style={{
              padding: '8px 14px', borderRadius: 10, border: 'none',
              background: '#25D366', color: '#fff', cursor: 'pointer',
              fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <i className="fa-brands fa-whatsapp" /> WA
            </button>
          )}
        </footer>
      </aside>

      <style>{`
        @keyframes drawerFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes drawerIn   { from { transform: translateX(24px); opacity: 0 } to { transform: none; opacity: 1 } }
        @keyframes drawerUp   { from { transform: translateY(100%); opacity: 0 } to { transform: none; opacity: 1 } }
        @media(max-width:600px){
          .pd-aside{top:auto!important;left:0!important;right:0!important;bottom:0!important;
            width:100%!important;max-height:95vh;border-radius:18px 18px 0 0;
            animation:drawerUp .28s cubic-bezier(.16,1,.3,1) both!important}
          .pd-aside .pd-info-grid{grid-template-columns:1fr 1fr!important}
        }
      `}</style>
    </>
  )
}

/* ── Sub-componentes ─────────────────────────────────────────── */

function SectionHead({ icon, title, count }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, marginTop: 4,
      fontSize: 10, fontWeight: 800, color: 'var(--txt3)',
      textTransform: 'uppercase', letterSpacing: '.08em',
    }}>
      <i className={`fa ${icon}`} style={{ color: 'var(--brand)', fontSize: 11 }} />
      {title}
      {typeof count === 'number' && (
        <span style={{
          padding: '1px 7px', fontSize: 10, fontWeight: 700,
          background: 'var(--surface2)', color: 'var(--txt2)',
          borderRadius: 999,
        }}>{count}</span>
      )}
    </div>
  )
}

function MiniKpi({ icon, label, value }) {
  return (
    <div style={{
      background: 'var(--surface2)', border: '1px solid var(--border)',
      borderRadius: 10, padding: '8px 12px', minWidth: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700, marginBottom: 3 }}>
        <i className={`fa ${icon}`} style={{ fontSize: 10 }} />
        {label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
    </div>
  )
}

function EmptyRow({ text }) {
  return (
    <div style={{
      padding: '12px 14px', marginBottom: 18,
      background: 'var(--surface2)', border: '1px dashed var(--border2)',
      borderRadius: 10, fontSize: 12, color: 'var(--txt3)', textAlign: 'center', fontStyle: 'italic',
    }}>
      {text}
    </div>
  )
}

function MoneyRow({ label, value, strong, big }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      fontSize: big ? 15 : 12, marginBottom: 4,
    }}>
      <span style={{ color: strong ? 'var(--txt)' : 'var(--txt3)', fontWeight: strong ? 800 : 500, letterSpacing: strong ? '.05em' : 'normal', textTransform: strong ? 'uppercase' : 'none' }}>{label}</span>
      <span style={{ color: 'var(--txt)', fontWeight: strong ? 800 : 600, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  )
}

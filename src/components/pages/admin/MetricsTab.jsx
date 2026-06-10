/**
 * MetricsTab — Dashboard SaaS para Anma (admin global).
 *
 * Muestra MRR, conversion, churn, LTV, funnel, próximos cobros y breakdown
 * por canal (si hay tracking habilitado).
 *
 * Recibe `workspaces` (array crudo de Supabase) — el padre Admin.jsx ya los
 * carga. Sin fetch propio.
 *
 * Diseño visual: coherente con admin-mcard del Admin.jsx existente.
 */
import { useMemo } from 'react'
import {
  calcMRR, calcARR, calcTotalRevenue, calcConversion, calcChurn, calcLTV,
  calcFunnel, calcMRRSeries, calcUpcomingPayments, calcChannelBreakdown,
} from '../../../lib/metrics'
import { fmtMoney, fmtShortDate } from '../../../lib/subscription'

const fmtPct = (v) => v == null ? '—' : `${(v * 100).toFixed(1)}%`
const fmtInt = (n) => (n ?? 0).toLocaleString('es-AR')

/** Sparkline SVG simple — sin dependencias */
function Sparkline({ series, color = '#7C3AED', height = 64 }) {
  if (!series?.length) return null
  const max = Math.max(...series.map(p => p.mrr), 1)
  const min = Math.min(...series.map(p => p.mrr), 0)
  const range = max - min || 1
  const w = 100   // viewBox base 100×N
  const stepX = w / (series.length - 1 || 1)
  const points = series.map((p, i) => {
    const x = i * stepX
    const y = height - ((p.mrr - min) / range) * (height - 8) - 4
    return `${x},${y}`
  }).join(' ')
  const lastX = (series.length - 1) * stepX
  const lastY = height - ((series[series.length - 1].mrr - min) / range) * (height - 8) - 4
  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" style={{ width: '100%', height, display: 'block' }}>
        <defs>
          <linearGradient id="spk-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={`0,${height} ${points} ${lastX},${height}`} fill="url(#spk-grad)" />
        <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        <circle cx={lastX} cy={lastY} r="2.5" fill={color} />
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10, color: 'var(--txt3)' }}>
        {series.map((p, i) => <span key={i} style={{ fontVariantNumeric: 'tabular-nums' }}>{p.label}</span>)}
      </div>
    </div>
  )
}

/** KPI card con valor + cambio + sparkline opcional */
function KPI({ label, value, sub, trend, color = '#7C3AED', tooltip }) {
  return (
    <div className="admin-mcard" style={{ position: 'relative' }} title={tooltip}>
      <div style={{ fontSize: 11, color: 'var(--txt3)', fontWeight: 600, letterSpacing: '.4px', textTransform: 'uppercase', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--txt)', letterSpacing: '-.5px', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ marginTop: 4, fontSize: 11.5, color: 'var(--txt3)', lineHeight: 1.4 }}>
          {trend != null && (
            <span style={{
              display: 'inline-block', marginRight: 6, fontWeight: 700,
              color: trend > 0 ? '#16A34A' : trend < 0 ? '#DC2626' : 'var(--txt3)',
            }}>
              {trend > 0 ? '↑' : trend < 0 ? '↓' : '→'} {Math.abs(trend).toFixed(0)}%
            </span>
          )}
          {sub}
        </div>
      )}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: color, borderTopLeftRadius: 12, borderBottomLeftRadius: 12 }} />
    </div>
  )
}

export default function MetricsTab({ workspaces = [] }) {
  const m = useMemo(() => {
    const mrr = calcMRR(workspaces)
    const arr = calcARR(workspaces)
    const totalRev = calcTotalRevenue(workspaces)
    const conv = calcConversion(workspaces)
    const churn = calcChurn(workspaces)
    const ltv = calcLTV(workspaces)
    const funnel = calcFunnel(workspaces)
    const series = calcMRRSeries(workspaces, 6)
    const upcoming = calcUpcomingPayments(workspaces, 7)
    const channels = calcChannelBreakdown(workspaces)

    // Trend MRR: comparación último mes vs anterior
    const lastTwo = series.slice(-2)
    let mrrTrend = null
    if (lastTwo.length === 2 && lastTwo[0].mrr > 0) {
      mrrTrend = ((lastTwo[1].mrr - lastTwo[0].mrr) / lastTwo[0].mrr) * 100
    }

    return { mrr, arr, totalRev, conv, churn, ltv, funnel, series, upcoming, channels, mrrTrend }
  }, [workspaces])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <style>{`
        @media(max-width:520px){
          .mt-funnel-label{width:88px!important;font-size:11.5px!important}
          .mt-funnel-bar-txt{font-size:10.5px!important;padding-left:8px!important}
          .mt-channel-row{grid-template-columns:1fr 1fr!important;gap:4px 10px!important}
          .mt-channel-row > .mt-channel-name{grid-column:1/-1;font-size:13px!important}
        }
      `}</style>

      {/* ── Hero: MRR + sparkline ─────────────────────────────────────── */}
      <div className="admin-mcard" style={{ padding: '20px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--txt3)', fontWeight: 600, letterSpacing: '.5px', textTransform: 'uppercase' }}>
              MRR — Ingresos recurrentes mensuales
            </div>
            <div style={{ fontSize: 32, fontWeight: 900, color: 'var(--txt)', letterSpacing: '-1px', fontVariantNumeric: 'tabular-nums', marginTop: 4 }}>
              {fmtMoney(m.mrr)}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--txt3)', marginTop: 4 }}>
              {m.mrrTrend != null && (
                <span style={{
                  fontWeight: 700, marginRight: 6,
                  color: m.mrrTrend > 0 ? '#16A34A' : m.mrrTrend < 0 ? '#DC2626' : 'var(--txt3)',
                }}>
                  {m.mrrTrend > 0 ? '↑' : m.mrrTrend < 0 ? '↓' : '→'} {Math.abs(m.mrrTrend).toFixed(1)}% vs mes anterior
                </span>
              )}
              <span>· ARR proyectado <strong style={{ color: 'var(--txt)' }}>{fmtMoney(m.arr)}</strong></span>
            </div>
          </div>
          <div style={{ flex: '1 1 280px', minWidth: 240, maxWidth: 420 }}>
            <Sparkline series={m.series} color="#7C3AED" height={70} />
          </div>
        </div>
      </div>

      {/* ── KPI cards ──────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <KPI
          label="Conversión Trial→Paid"
          value={m.conv.rate != null ? fmtPct(m.conv.rate) : '—'}
          sub={m.conv.rate != null
            ? `${m.conv.paid} pagaron de ${m.conv.exited} que salieron del trial`
            : `Muestra chica (${m.conv.exited}/5 mín)`}
          color="#059669"
          tooltip="De cada trial que terminó, qué % activó la suscripción"
        />
        <KPI
          label="Churn 30d"
          value={m.churn.rate != null ? fmtPct(m.churn.rate) : '—'}
          sub={m.churn.rate != null
            ? `${m.churn.lostThisMonth} perdidos de ${m.churn.activeAtStart} activos`
            : `Pocos datos (${m.churn.activeAtStart}/3 mín)`}
          color="#DC2626"
          tooltip="% de clientes activos perdidos en los últimos 30 días"
        />
        <KPI
          label="LTV estimado"
          value={m.ltv != null ? fmtMoney(m.ltv) : '—'}
          sub={m.churn.rate ? '= $30k / churn + onboarding' : 'Necesita churn calculable'}
          color="#7C3AED"
          tooltip="Valor de vida estimado por cliente"
        />
        <KPI
          label="Facturado total"
          value={fmtMoney(m.totalRev)}
          sub={`${m.funnel.steps[2].count} clientes activaron alguna vez`}
          color="#D97706"
          tooltip="Suma histórica de lifetime_revenue de todos los workspaces"
        />
      </div>

      {/* ── Funnel actual ─────────────────────────────────────────────── */}
      <div className="admin-mcard" style={{ padding: '16px 22px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)', marginBottom: 12 }}>
          <i className="fa fa-filter" style={{ marginRight: 8, color: '#7C3AED' }} />
          Funnel de activación
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {m.funnel.steps.map((s, i) => {
            const color = s.label === 'Perdidos' ? '#DC2626' :
              s.label === 'Pagando hoy' ? '#16A34A' :
              s.label === 'Activaron' ? '#059669' : '#7C3AED'
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="mt-funnel-label" style={{ width: 120, fontSize: 12.5, color: 'var(--txt2)', fontWeight: 600, flexShrink: 0 }}>
                  {s.label}
                </div>
                <div style={{ flex: 1, height: 24, background: 'var(--surface2)', borderRadius: 6, overflow: 'hidden', position: 'relative', minWidth: 0 }}>
                  <div style={{
                    width: `${s.pct}%`, height: '100%',
                    background: `linear-gradient(90deg, ${color}cc, ${color})`,
                    transition: 'width .4s', borderRadius: 6,
                  }} />
                  <div className="mt-funnel-bar-txt" style={{
                    position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
                    paddingLeft: 10, fontSize: 11.5, fontWeight: 700, color: s.pct > 40 ? '#fff' : 'var(--txt)',
                    fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
                  }}>
                    {fmtInt(s.count)} · {s.pct}%
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Próximos cobros ────────────────────────────────────────────── */}
      {m.upcoming.count > 0 && (
        <div className="admin-mcard" style={{ padding: '16px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)' }}>
              <i className="fa fa-calendar-day" style={{ marginRight: 8, color: '#D97706' }} />
              Próximos 7 días — {m.upcoming.count} cobro{m.upcoming.count !== 1 ? 's' : ''}
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#16A34A', fontVariantNumeric: 'tabular-nums' }}>
              {fmtMoney(m.upcoming.total)}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {m.upcoming.items.map((p, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: i < m.upcoming.items.length - 1 ? '1px solid var(--border)' : 'none', fontSize: 12.5 }}>
                <span style={{ color: 'var(--txt)' }}>{p.name || '—'}</span>
                <span style={{ color: 'var(--txt2)', fontVariantNumeric: 'tabular-nums' }}>
                  {fmtShortDate(p.due)} <span style={{ color: 'var(--txt3)', marginLeft: 6 }}>(en {p.daysUntil}d)</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Canales (Fase 2) ────────────────────────────────────────────── */}
      <div className="admin-mcard" style={{ padding: '16px 22px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)', marginBottom: 10 }}>
          <i className="fa fa-share-nodes" style={{ marginRight: 8, color: '#0EA5E9' }} />
          Canales de adquisición
        </div>
        {m.channels.available ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {m.channels.channels.map((c, i) => (
              <div key={i} className="mt-channel-row" style={{ display: 'grid', gridTemplateColumns: '120px 1fr auto auto', gap: 10, alignItems: 'center', padding: '8px 0', borderBottom: i < m.channels.channels.length - 1 ? '1px solid var(--border)' : 'none', fontSize: 12.5 }}>
                <span className="mt-channel-name" style={{ color: 'var(--txt)', fontWeight: 600, textTransform: 'capitalize' }}>{c.name}</span>
                <span style={{ color: 'var(--txt3)' }}>{c.signups} signups · {c.activated} activaron</span>
                <span style={{ fontWeight: 700, color: '#059669', fontVariantNumeric: 'tabular-nums' }}>{fmtPct(c.conversion)}</span>
                <span style={{ fontWeight: 700, color: 'var(--txt)', fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(c.revenue)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: 14, background: 'rgba(14,165,233,.06)', border: '1px dashed rgba(14,165,233,.3)', borderRadius: 8, fontSize: 12.5, color: 'var(--txt2)', lineHeight: 1.55 }}>
            <strong style={{ color: 'var(--txt)' }}>Habilitá tracking de canales (Fase 2)</strong> para saber de dónde vienen tus mejores clientes.<br />
            Requiere: migración SQL para agregar <code style={{ fontSize: 11.5 }}>acquisition_channel</code> a workspaces + capturar UTM params en /registro.
            Una vez activado, vas a ver: signups por canal · % conversion · revenue total. Pídeme arrancar Fase 2 cuando estés lista.
          </div>
        )}
      </div>

    </div>
  )
}

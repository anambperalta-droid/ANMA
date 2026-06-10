/**
 * ANMA — Helpers puros de métricas SaaS.
 *
 * Calcula MRR, churn, conversion, trial-to-paid y serie histórica
 * a partir del array de workspaces (con las columnas de SUPABASE_MP_MIGRATION.sql).
 *
 * Diseño:
 *  - Funciones puras: input workspaces[], output número/objeto.
 *  - No fetch — el caller pasa los datos ya cargados (Admin.jsx ya los tiene).
 *  - No formato — devuelve números, el componente decide cómo mostrarlos.
 *
 * Reglas de negocio implícitas:
 *  - MRR sólo cuenta workspaces 'active' (los pending_payment están en gracia,
 *    no aportan caja predecible).
 *  - Churn = los que pasaron a 'churned' o 'paused' en el período.
 *  - Conversion trial→paid = de los que arrancaron trial, qué % activaron.
 */
import { STATUS, MONTHLY_AMOUNT, ONBOARDING_AMOUNT } from './subscription'

const DAY = 86_400_000

/** Días enteros entre 2 fechas (positivo si dateB > dateA) */
function daysBetween(a, b) {
  if (!a || !b) return null
  return Math.floor((new Date(b).getTime() - new Date(a).getTime()) / DAY)
}

/** ¿Está dentro de los últimos N días desde hoy? */
function withinLastDays(iso, days) {
  if (!iso) return false
  const diff = Date.now() - new Date(iso).getTime()
  return diff >= 0 && diff <= days * DAY
}

/** ¿Está activo (paga) o en gracia? */
function isPaying(w) {
  return w?.subscription_status === STATUS.ACTIVE
}

function isLost(w) {
  return w?.subscription_status === STATUS.CHURNED || w?.subscription_status === STATUS.PAUSED
}

function isTrial(w) {
  return w?.subscription_status === STATUS.TRIAL || !w?.subscription_status
}

/**
 * MRR — Monthly Recurring Revenue.
 * Sólo cuenta los 'active' por su mensualidad fija.
 * No incluye los pending_payment (puede no cobrarse) ni los churned.
 */
export function calcMRR(workspaces) {
  return workspaces.filter(isPaying).length * MONTHLY_AMOUNT
}

/**
 * ARR — Annual Recurring Revenue. Proyección anual.
 */
export function calcARR(workspaces) {
  return calcMRR(workspaces) * 12
}

/**
 * Total facturado real (acumulado histórico).
 * Suma de lifetime_revenue de todos los workspaces.
 */
export function calcTotalRevenue(workspaces) {
  return workspaces.reduce((s, w) => s + (Number(w.lifetime_revenue) || 0), 0)
}

/**
 * Conversion trial → paid.
 * De los workspaces que NO están en trial (ya hicieron el camino), qué % activaron.
 * Si pocos datos (< 5 workspaces ex-trial) devuelve null (no significativo).
 */
export function calcConversion(workspaces) {
  // Universo: workspaces que ya salieron del trial (activated o churned).
  const exited = workspaces.filter(w => w.activated_at || isLost(w))
  if (exited.length < 5) return { rate: null, exited: exited.length, paid: 0, lost: 0 }
  const paid = exited.filter(w => w.activated_at).length
  return {
    rate: paid / exited.length,
    exited: exited.length,
    paid,
    lost: exited.length - paid,
  }
}

/**
 * Churn rate del mes corriente.
 * % de workspaces que se perdieron en los últimos 30d sobre los que estaban activos al inicio.
 */
export function calcChurn(workspaces) {
  const activeAtStart = workspaces.filter(w => {
    const activated = w.activated_at
    return activated && daysBetween(activated, Date.now()) > 30
  }).length
  const lostThisMonth = workspaces.filter(w =>
    isLost(w) && withinLastDays(w.last_payment_at || w.activated_at, 30)
  ).length
  if (activeAtStart < 3) return { rate: null, lostThisMonth, activeAtStart }
  return {
    rate: lostThisMonth / activeAtStart,
    lostThisMonth,
    activeAtStart,
  }
}

/**
 * LTV — Lifetime Value estimado.
 * Si hay churn calculado: LTV = $30k / churn + $120k onboarding.
 * Si no hay datos: usa el promedio de lifetime_revenue de los pagados.
 */
export function calcLTV(workspaces) {
  const churn = calcChurn(workspaces)
  if (churn.rate && churn.rate > 0) {
    return Math.round(MONTHLY_AMOUNT / churn.rate + ONBOARDING_AMOUNT)
  }
  const paying = workspaces.filter(w => w.activated_at && (Number(w.lifetime_revenue) || 0) > 0)
  if (!paying.length) return null
  const avg = paying.reduce((s, w) => s + Number(w.lifetime_revenue || 0), 0) / paying.length
  return Math.round(avg)
}

/**
 * Funnel de activación (basado en lo que Supabase ya nos da).
 *
 * Pasos:
 *  1. Registrados — todos los workspaces que existen
 *  2. En trial activo — subscription_status = 'trial' o nada
 *  3. Convertidos — tienen activated_at
 *
 * Si quisieras "crearon presupuesto" / "mandaron WA" necesitarías tracking
 * extra en la app (eventos). Por ahora arrancamos con lo que hay.
 */
export function calcFunnel(workspaces) {
  const registered = workspaces.length
  const trial = workspaces.filter(isTrial).length
  const activated = workspaces.filter(w => w.activated_at).length
  const paying = workspaces.filter(isPaying).length
  const lost = workspaces.filter(isLost).length
  return {
    steps: [
      { label: 'Registrados',  count: registered, pct: 100 },
      { label: 'En trial',     count: trial,      pct: registered ? Math.round(trial / registered * 100) : 0 },
      { label: 'Activaron',    count: activated,  pct: registered ? Math.round(activated / registered * 100) : 0 },
      { label: 'Pagando hoy',  count: paying,     pct: registered ? Math.round(paying / registered * 100) : 0 },
      { label: 'Perdidos',     count: lost,       pct: registered ? Math.round(lost / registered * 100) : 0 },
    ],
  }
}

/**
 * Serie de MRR mensual: cuántos activos había a fin de cada mes.
 * Usa `activated_at` para contar entradas y `last_payment_at`/estado actual para egresos.
 *
 * Devuelve los últimos `monthsBack` meses (incluído el actual).
 * Cada punto: { label: 'jun', mrr: 240000, activos: 8 }
 */
export function calcMRRSeries(workspaces, monthsBack = 6) {
  const today = new Date()
  const series = []
  for (let i = monthsBack - 1; i >= 0; i--) {
    const monthEnd = new Date(today.getFullYear(), today.getMonth() - i + 1, 0)  // último día del mes
    monthEnd.setHours(23, 59, 59, 999)
    // Activos al cierre de ese mes = activated_at <= monthEnd Y NO perdidos antes
    const activos = workspaces.filter(w => {
      if (!w.activated_at) return false
      if (new Date(w.activated_at) > monthEnd) return false
      // Si está churned/paused y se perdió ANTES del fin de ese mes, no cuenta
      if (isLost(w)) {
        const lostAt = w.last_payment_at || w.activated_at
        if (lostAt && new Date(lostAt) <= monthEnd) return false
      }
      return true
    }).length
    const label = monthEnd.toLocaleDateString('es-AR', { month: 'short' })
    series.push({ label, mrr: activos * MONTHLY_AMOUNT, activos, date: monthEnd.toISOString() })
  }
  return series
}

/**
 * Próximos cobros: workspaces con next_payment_due_at en los próximos N días.
 * Útil para forecast de cash de la semana/quincena.
 */
export function calcUpcomingPayments(workspaces, daysAhead = 7) {
  const upcoming = workspaces
    .filter(w => isPaying(w) && w.next_payment_due_at)
    .map(w => ({
      name: w.name,
      due: w.next_payment_due_at,
      amount: MONTHLY_AMOUNT,
      daysUntil: daysBetween(Date.now(), w.next_payment_due_at),
    }))
    .filter(p => p.daysUntil !== null && p.daysUntil >= 0 && p.daysUntil <= daysAhead)
    .sort((a, b) => a.daysUntil - b.daysUntil)
  return {
    items: upcoming,
    total: upcoming.reduce((s, p) => s + p.amount, 0),
    count: upcoming.length,
  }
}

/**
 * Breakdown por canal de adquisición (Fase 2, requires migration).
 * Si los workspaces no tienen `acquisition_channel`, devuelve { available: false }.
 */
export function calcChannelBreakdown(workspaces) {
  const hasData = workspaces.some(w => w.acquisition_channel)
  if (!hasData) return { available: false, channels: [] }

  const groups = {}
  workspaces.forEach(w => {
    const ch = w.acquisition_channel || 'desconocido'
    if (!groups[ch]) groups[ch] = { signups: 0, activated: 0, revenue: 0 }
    groups[ch].signups++
    if (w.activated_at) groups[ch].activated++
    groups[ch].revenue += Number(w.lifetime_revenue || 0)
  })
  const channels = Object.entries(groups)
    .map(([name, g]) => ({
      name,
      signups: g.signups,
      activated: g.activated,
      revenue: g.revenue,
      conversion: g.signups ? g.activated / g.signups : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)
  return { available: true, channels }
}

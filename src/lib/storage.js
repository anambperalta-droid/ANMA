/* ═══════════════════════════════════════
   ANMA — Storage Layer v4
   Modelo: Stock + Insumos + B2B/B2C
   Datos aislados por usuario (userId)
═══════════════════════════════════════ */
const BASE = 'anma4_'

// userId se setea al loguearse (ver DataContext)
let _userId = null

export function setStorageUser(userId) {
  _userId = userId || null
}

function K() {
  return _userId ? `${BASE}u_${_userId}_` : `${BASE}`
}

export function db(key, fallback = []) {
  try {
    return JSON.parse(localStorage.getItem(K() + key)) ?? fallback
  } catch {
    return fallback
  }
}

let _writeHook = null
export function setWriteHook(fn) { _writeHook = fn }

export function dbW(key, value) {
  localStorage.setItem(K() + key, JSON.stringify(value))
  _writeHook?.()
}

export function cfg() {
  return db('cfg', {})
}

export function wCfg(patch) {
  dbW('cfg', { ...cfg(), ...patch })
}

/* ── Defaults ── */
export const DEFAULTS = {
  businessName: 'ANMA',
  subtitle: 'Tu negocio en un solo lugar',
  currency: '$',
  numberFormat: 'es-AR',
  defaultMargin: 40,
  defaultDeposit: 50,
  validity: 15,
  budgetPrefix: 'AN',
  nextNum: 1,
  paymentConditions: '50% seña al confirmar, saldo contra entrega.',
  legalNote: 'Validez 15 días hábiles. Precios sujetos a variaciones de insumos.',
  deliveryModes: [
    'Retiro en local',
    'Envío estándar — 3-5 días hábiles',
    'Envío express — 24/48hs (+15%)',
    'Entrega a coordinar',
  ],
  productCats: [
    'Producto terminado',
    'Semi-elaborado',
    'Reventa',
    'Servicio',
  ],
  insumoCats: [
    { id: 'prod_core',    label: 'Materia Prima / Producción' },
    { id: 'packaging',    label: 'Packaging y Experiencia' },
    { id: 'insumos_op',   label: 'Insumos Operativos' },
    { id: 'herramientas', label: 'Herramientas y Repuestos' },
    { id: 'promo',        label: 'Marketing y Regalos' },
  ],
  units: ['un', 'kg', 'lt', 'm', 'pack', 'caja', 'rollo'],
  clientTypes: ['B2C — Cliente final', 'B2B — Empresa'],
  pricingRules: {
    b2c: { margin: 40, minQty: 1, label: 'Precio público' },
    b2b: { margin: 25, minQty: 10, label: 'Precio mayorista' },
  },
}

export function ensureDefaults() {
  const c = cfg()
  if (!c.businessName) wCfg(DEFAULTS)
  if (!c.insumoCats || typeof c.insumoCats[0] === 'string') wCfg({ insumoCats: DEFAULTS.insumoCats })
  if (!c.units || c.units[0] === 'unidad') wCfg({ units: DEFAULTS.units })
  if (!c.clientTypes) wCfg({ clientTypes: DEFAULTS.clientTypes })
  if (!c.pricingRules) wCfg({ pricingRules: DEFAULTS.pricingRules })
}

export const fmt = (v) => {
  const c = cfg()
  const cur = c.currency || '$'
  const locale = c.numberFormat || 'es-AR'
  return cur + (Number(v) || 0).toLocaleString(locale, { maximumFractionDigits: 0 })
}

export const fmtDec = (v) => {
  const c = cfg()
  const cur = c.currency || '$'
  const locale = c.numberFormat || 'es-AR'
  return cur + (Number(v) || 0).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export const fmtDate = (iso) => {
  if (!iso) return '—'
  const p = String(iso).slice(0, 10).split('-')
  if (p.length < 3) return iso
  return `${p[2]}/${p[1]}/${p[0].slice(2)}`
}

export const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

export const STATUS_MAP = {
  draft: 'Borrador',
  sent: 'Enviado',
  confirmed: 'Confirmado',
  inprogress: 'En producción',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
  // legacy keys kept for backward compat
  negotiating: 'Negociando',
  pending: 'Pendiente',
  shipped: 'Despachado',
  lost: 'Perdido',
}

export const STATUS_CLS = {
  draft: 'b-draft',
  sent: 'b-sent',
  confirmed: 'b-confirmed',
  inprogress: 'b-negotiating',
  delivered: 'b-confirmed',
  cancelled: 'b-lost',
  // legacy
  negotiating: 'b-negotiating',
  pending: 'b-sent',
  shipped: 'b-sent',
  lost: 'b-lost',
}

export const PAY_STATUS_MAP = {
  pending: 'Pago pendiente',
  partial: 'Seña abonada',
  paid: 'Pagado',
}

export const PAY_STATUS_CLS = {
  pending: 'b-draft',
  partial: 'b-negotiating',
  paid: 'b-confirmed',
}

export const MOVE_TYPES = {
  in: 'Ingreso',
  out: 'Egreso',
  adjust: 'Ajuste',
  sale: 'Venta',
  return: 'Devolución',
}

export const MOVE_CLS = {
  in: 'b-confirmed',
  out: 'b-lost',
  adjust: 'b-negotiating',
  sale: 'b-sent',
  return: 'b-draft',
}

/* ═══════════════════════════════════════
   ANMA — Storage Layer v4
   Modelo: Stock + Insumos + B2B/B2C
═══════════════════════════════════════ */
const K = 'anma3_'

export function db(key, fallback = []) {
  try {
    return JSON.parse(localStorage.getItem(K + key)) ?? fallback
  } catch {
    return fallback
  }
}

export function dbW(key, value) {
  localStorage.setItem(K + key, JSON.stringify(value))
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
  /* ── Categorías dinámicas (admin configura) ── */
  productCats: [
    'Producto terminado',
    'Semi-elaborado',
    'Reventa',
    'Servicio',
  ],
  insumoCats: [
    'Materia prima',
    'Empaque / Packaging',
    'Etiquetas / Stickers',
    'Insumos de producción',
    'Otros',
  ],
  units: ['unidad', 'kg', 'litro', 'metro', 'caja', 'pack', 'rollo'],
  clientTypes: ['B2C — Cliente final', 'B2B — Empresa'],
  /* ── Reglas de precio por tipo de cliente ── */
  pricingRules: {
    b2c: { margin: 40, minQty: 1, label: 'Precio público' },
    b2b: { margin: 25, minQty: 10, label: 'Precio mayorista' },
  },
}

export function ensureDefaults() {
  const c = cfg()
  if (!c.businessName) wCfg(DEFAULTS)
  if (!c.email || !c.ph) {
    wCfg({
      email: 'admin@anma.com',
      ph: '944ce261c4dc5b37feb359c238187e5ea6ceb915f0e28a648448d7c4a5c7f7d3',
    })
  }
  // Migrate: add new defaults if missing
  if (!c.insumoCats) wCfg({ insumoCats: DEFAULTS.insumoCats })
  if (!c.units) wCfg({ units: DEFAULTS.units })
  if (!c.clientTypes) wCfg({ clientTypes: DEFAULTS.clientTypes })
  if (!c.pricingRules) wCfg({ pricingRules: DEFAULTS.pricingRules })
}

export const fmt = (v) => {
  const c = cfg()
  const cur = c.currency || '$'
  return cur + (Number(v) || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 })
}

export const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

/* ── Pedido / Venta statuses ── */
export const STATUS_MAP = {
  draft: 'Borrador',
  pending: 'Pendiente',
  confirmed: 'Confirmado',
  inprogress: 'En proceso',
  shipped: 'Enviado',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
}

export const STATUS_CLS = {
  draft: 'b-draft',
  pending: 'b-sent',
  confirmed: 'b-confirmed',
  inprogress: 'b-negotiating',
  shipped: 'b-sent',
  delivered: 'b-confirmed',
  cancelled: 'b-lost',
}

/* ── Pago ── */
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

/* ── Stock movement types ── */
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

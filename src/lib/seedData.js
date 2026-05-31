/* ─────────────────────────────────────────
   ANMA Pro — Init de usuario nuevo (sin datos de demo)
───────────────────────────────────────── */
import { setStorageUser, wCfg, dbW, db, cfg, DEFAULTS, STORAGE_BASE } from './storage'

const SEED_FLAG = 'seed_done_v2'

function seedFlag(userId) {
  return `${STORAGE_BASE}u_${userId}_${SEED_FLAG}`
}

export function injectSeedData(userId, businessName) {
  if (!userId) return
  if (localStorage.getItem(seedFlag(userId))) return

  setStorageUser(userId)

  const biz = (businessName || 'Mi Empresa').trim()
  const c = cfg()
  if (!c.businessName) {
    wCfg({ ...DEFAULTS, businessName: biz, subtitle: 'Tu negocio en un solo lugar', budgetPrefix: 'PRE', nextNum: 1 })
  }

  // Limpia datos de demo v1 para usuarios que los recibieron antes
  const DEMO_CLIENTS = ['seed-cl-1','seed-cl-2','seed-cl-3','seed-cl-4']
  const DEMO_ORDERS  = ['seed-ord-1','seed-ord-2','seed-ord-3']
  const clients = db('clients', [])
  const orders  = db('orders', [])
  if (clients.length > 0 && clients.every(c => DEMO_CLIENTS.includes(c.id))) dbW('clients', [])
  if (orders.length > 0  && orders.every(o => DEMO_ORDERS.includes(o.id)))   dbW('orders', [])

  localStorage.setItem(seedFlag(userId), '1')
}

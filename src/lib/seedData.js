/* ─────────────────────────────────────────
   ANMA Pro — Seed Data para trial
   Se inyecta una sola vez por usuario nuevo.
   Marca: anma4_u_{userId}_seed_done_v1
───────────────────────────────────────── */
import { setStorageUser, dbW, db, DEFAULTS, STORAGE_BASE } from './storage'

const SEED_FLAG = 'seed_done_v1'

function seedFlag(userId) {
  return `${STORAGE_BASE}u_${userId}_${SEED_FLAG}`
}

/**
 * Inyecta datos de ejemplo una sola vez para un nuevo usuario trial.
 * @param {string} userId        — Supabase user ID
 * @param {string} businessName  — nombre de empresa del formulario de registro
 */
export function injectSeedData(userId, businessName) {
  if (!userId) return
  if (localStorage.getItem(seedFlag(userId))) return  // ya fue inyectado

  setStorageUser(userId)

  // Si ya tiene clientes (usuario legacy), no pisar
  if (db('clients').length > 0) {
    localStorage.setItem(seedFlag(userId), '1')
    return
  }

  const biz = (businessName || 'Mi Empresa').trim()
  const now  = new Date()
  const daysAgo = (d) => new Date(now - d * 86_400_000).toISOString()

  /* ── Configuración base ── */
  dbW('cfg', {
    ...DEFAULTS,
    businessName: biz,
    subtitle:     'Tu negocio en un solo lugar',
    budgetPrefix: 'PRE',
    nextNum:      4,
    // Transportista preconfigurado
    carriers: [
      { id: 'vc', name: 'Vía Cargo', phone: '0810-333-8422', account: '', notes: 'Sucursal más cercana: consultar web oficial.' },
      { id: 'and', name: 'Andreani', phone: '0810-122-6363', account: '', notes: '' },
    ],
  })

  /* ── Clientes de ejemplo ── */
  dbW('clients', [
    {
      id: 'seed-cl-1',
      company:  'Distribuidora Fernández Hnos.',
      contact:  'Martín Fernández',
      email:    'mfernandez@distrib.com.ar',
      phone:    '11 4523-7890',
      type:     'B2B — Empresa',
      address:  'Av. Corrientes 1234, CABA',
      notes:    'Cliente frecuente. Paga a 30 días hábiles. Requiere remito.',
      createdAt: daysAgo(12),
    },
    {
      id: 'seed-cl-2',
      company:  'Estudio Suárez & Asociados',
      contact:  'Paula Suárez',
      email:    'paula@estudiosuarez.com',
      phone:    '11 3456-2389',
      type:     'B2B — Empresa',
      address:  'Thames 1547, Palermo, CABA',
      notes:    'Requiere factura A. Confirma pedidos por WhatsApp.',
      createdAt: daysAgo(8),
    },
    {
      id: 'seed-cl-3',
      company:  'Laura Gómez',
      contact:  'Laura Gómez',
      email:    'lauragomez@gmail.com',
      phone:    '11 6789-0123',
      type:     'B2C — Cliente final',
      address:  'Belgrano, CABA',
      notes:    'Le gusta la entrega rápida. Cliente recurrente.',
      createdAt: daysAgo(3),
    },
    {
      id: 'seed-cl-4',
      company:  `${biz} — Demo`,
      contact:  'Tu primer cliente',
      email:    'cliente@tuempresa.com',
      phone:    '11 0000-0000',
      type:     'B2B — Empresa',
      address:  '',
      notes:    '👋 Este es un cliente de ejemplo. Podés editarlo o eliminarlo cuando quieras.',
      createdAt: daysAgo(1),
    },
  ])

  /* ── Presupuestos / órdenes de ejemplo ── */
  dbW('orders', [
    {
      id: 'seed-ord-1',
      number:     'PRE-001',
      company:    'Distribuidora Fernández Hnos.',
      contact:    'Martín Fernández',
      status:     'confirmed',
      payStatus:  'partial',
      total:      185_000,
      deposit:    92_500,
      items:      [{ desc: 'Producto A x 50 unidades', qty: 50, price: 3_700 }],
      notes:      'Entrega acordada para el viernes.',
      delivery:   'Vía Cargo',
      createdAt:  daysAgo(5),
      validUntil: new Date(now.getTime() + 10 * 86_400_000).toISOString(),
    },
    {
      id: 'seed-ord-2',
      number:     'PRE-002',
      company:    'Estudio Suárez & Asociados',
      contact:    'Paula Suárez',
      status:     'sent',
      payStatus:  'pending',
      total:      64_000,
      deposit:    0,
      items:      [{ desc: 'Servicio mensual — pack básico', qty: 1, price: 64_000 }],
      notes:      'Esperando confirmación.',
      delivery:   'Retiro en local',
      createdAt:  daysAgo(2),
      validUntil: new Date(now.getTime() + 13 * 86_400_000).toISOString(),
    },
    {
      id: 'seed-ord-3',
      number:     'PRE-003',
      company:    'Laura Gómez',
      contact:    'Laura Gómez',
      status:     'delivered',
      payStatus:  'paid',
      total:      22_500,
      deposit:    22_500,
      items:      [{ desc: 'Producto B x 15 unidades', qty: 15, price: 1_500 }],
      notes:      'Entregado sin novedades.',
      delivery:   'Envío express — 24/48hs (+15%)',
      createdAt:  daysAgo(9),
      validUntil: daysAgo(0),
    },
  ])

  /* ── Marca de seed completado ── */
  localStorage.setItem(seedFlag(userId), '1')
}

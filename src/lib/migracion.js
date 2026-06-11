/**
 * ANMA Hub — Utilidad de Migración Bulk Load v1
 * ─────────────────────────────────────────────
 * Lee datos de localStorage (clientes, proveedores, productos, insumos)
 * y los carga en las tablas normalizadas de Supabase usando upsert
 * idempotente por (workspace_id, external_id).
 *
 * USO TÍPICO (desde consola del navegador o botón en Config):
 *   import { migrarTodo } from './lib/migracion'
 *   const resumen = await migrarTodo()
 *   console.table(resumen)
 *
 * GARANTÍAS:
 *   · Idempotente: ejecutar N veces da el mismo resultado (upsert).
 *   · No destruye datos existentes: ON CONFLICT actualiza el registro.
 *   · Imágenes base64 se descartan (no se almacenan en columnas texto).
 *   · Proveedores se migran primero; sus UUIDs se usan en productos/insumos.
 *   · Errores parciales no abortan la migración; se reportan en el resumen.
 *
 * SEGURIDAD:
 *   · Nunca almacena ni expone tokens de Supabase.
 *   · Usa el cliente ya autenticado de supabase.js.
 *   · Respeta RLS — solo inserta en el workspace del usuario activo.
 */

import { supabase } from './supabase'
import { db }        from './storage'
import { getSyncContext } from './sync'

// ── Constantes ──────────────────────────────────────────────────────
const BATCH = 50   // filas por request de upsert

// ── Helpers ─────────────────────────────────────────────────────────

/** Divide un array en chunks de tamaño n */
function chunks(arr, n) {
  const out = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

/** Convierte un valor a número; devuelve 0 si NaN */
const num = (v) => { const n = Number(v); return isNaN(n) ? 0 : n }

/** Devuelve null si la imagen es base64; preserva URLs reales */
const sanitizeImage = (v) =>
  typeof v === 'string' && v.startsWith('data:') ? null : (v || null)

/**
 * Upserta filas en lotes de BATCH.
 * Devuelve { insertadas, errores[] }.
 */
async function batchUpsert(table, rows, conflictCols) {
  let insertadas = 0
  const errores = []

  for (const batch of chunks(rows, BATCH)) {
    const { error, count } = await supabase
      .from(table)
      .upsert(batch, { onConflict: conflictCols, count: 'exact' })

    if (error) {
      errores.push({ batch: batch.map(r => r.external_id), mensaje: error.message })
    } else {
      insertadas += count ?? batch.length
    }
  }

  return { insertadas, errores }
}

// ── Lectura de localStorage ──────────────────────────────────────────

/**
 * Lee todos los datos locales relevantes para la migración.
 * Devuelve { clients, suppliers, products, insumos }.
 */
export function leerDatosLocales() {
  return {
    clients:   db('clients',   []),
    suppliers: db('suppliers', []),
    products:  db('products',  []),
    insumos:   db('insumos',   []),
  }
}

// ── Migradores individuales ──────────────────────────────────────────

/**
 * Migra proveedores → pro_suppliers.
 * Devuelve { resultado, mapaProveedores: Map<externalId, uuid> }.
 *
 * mapaProveedores se usa para resolver supplierId en productos/insumos.
 */
export async function migrarProveedores(wsId, suppliers) {
  const mapaProveedores = new Map()

  if (!suppliers?.length) {
    return { resultado: { tabla: 'pro_suppliers', total: 0, insertadas: 0, errores: [] }, mapaProveedores }
  }

  const rows = suppliers.map(s => ({
    workspace_id: wsId,
    external_id:  s.id,               // integer original de localStorage
    name:         (s.name || '').trim() || '(sin nombre)',
    contact_name: s.contact || null,
    phone:        s.wa || s.telefono || null,
    email:        s.email || null,
    notes:        s.notes || null,
    is_active:    true,
    // Campos extra en jsonb para preservar datos sin columna directa
    extra: {
      rubro:        s.rubro        || null,
      cuit:         s.cuit         || null,
      ivaCondition: s.ivaCondition || null,
      paymentTerm:  s.paymentTerm  || null,
      cbu:          s.cbu          || null,
      leadTime:     s.leadTime     || null,
    },
  }))

  const resultado = await batchUpsert('pro_suppliers', rows, 'workspace_id,external_id')

  // Construir mapa externalId → uuid para uso posterior
  if (!resultado.errores.length || resultado.insertadas > 0) {
    const { data } = await supabase
      .from('pro_suppliers')
      .select('id, external_id')
      .eq('workspace_id', wsId)
      .not('external_id', 'is', null)

    ;(data || []).forEach(r => mapaProveedores.set(r.external_id, r.id))
  }

  return {
    resultado: { tabla: 'pro_suppliers', total: rows.length, ...resultado },
    mapaProveedores,
  }
}

/**
 * Migra clientes → pro_clients.
 */
export async function migrarClientes(wsId, clients) {
  if (!clients?.length) {
    return { tabla: 'pro_clients', total: 0, insertadas: 0, errores: [] }
  }

  const rows = clients.map(c => ({
    workspace_id: wsId,
    external_id:  c.id,
    // name es NOT NULL: empresa > contacto > fallback
    name:         (c.company || c.contact || '(sin nombre)').trim(),
    client_type:  c.rubro ? 'B2B' : 'B2C',
    company:      c.company  || null,
    contact_name: c.contact  || null,
    email:        c.email    || null,
    phone:        c.wa       || null,
    notes:        c.notes    || null,
    is_active:    true,
    extra: {
      rubro:        c.rubro        || null,
      discount:     c.discount     || null,
      cuit:         c.cuit         || null,
      razonSocial:  c.razonSocial  || null,
      ivaCondition: c.ivaCondition || null,
    },
  }))

  const resultado = await batchUpsert('pro_clients', rows, 'workspace_id,external_id')
  return { tabla: 'pro_clients', total: rows.length, ...resultado }
}

/**
 * Migra productos del catálogo → pro_products.
 * Requiere mapaProveedores para resolver supplierId → uuid.
 */
export async function migrarProductos(wsId, products, mapaProveedores) {
  if (!products?.length) {
    return { tabla: 'pro_products', total: 0, insertadas: 0, errores: [] }
  }

  const rows = products.map(p => ({
    workspace_id:  wsId,
    external_id:   p.id,
    name:          (p.name || '').trim() || '(sin nombre)',
    category:      p.cat    || null,
    unit:          p.unit   || 'un',
    cost:          num(p.cost),
    price_b2c:     num(p.priceB2C) || null,
    price_b2b:     num(p.priceB2B) || null,
    stock_current: num(p.stock),
    stock_min:     num(p.minStock),
    notes:         p.notes  || null,
    sku:           p.sku    || null,
    image_url:     sanitizeImage(p.image),   // base64 → null
    supplier_id:   mapaProveedores.get(Number(p.supplierId)) || null,
    is_active:     true,
    extra: {},
  }))

  const resultado = await batchUpsert('pro_products', rows, 'workspace_id,external_id')
  return { tabla: 'pro_products', total: rows.length, ...resultado }
}

/**
 * Migra insumos → pro_insumos.
 * Requiere mapaProveedores para resolver supplierId → uuid.
 */
export async function migrarInsumos(wsId, insumos, mapaProveedores) {
  if (!insumos?.length) {
    return { tabla: 'pro_insumos', total: 0, insertadas: 0, errores: [] }
  }

  const rows = insumos.map(i => ({
    workspace_id:  wsId,
    external_id:   i.id,
    name:          (i.name || '').trim() || '(sin nombre)',
    category:      i.cat    || null,
    unit:          i.unit   || 'un',
    cost:          num(i.cost),
    stock_current: num(i.stock),
    stock_min:     num(i.minStock),
    notes:         i.notes  || null,
    supplier_id:   mapaProveedores.get(Number(i.supplierId)) || null,
    is_active:     true,
    extra: {
      subcat: i.subcat || null,
    },
  }))

  const resultado = await batchUpsert('pro_insumos', rows, 'workspace_id,external_id')
  return { tabla: 'pro_insumos', total: rows.length, ...resultado }
}

// ── Migración completa ───────────────────────────────────────────────

/**
 * Ejecuta la migración completa en orden correcto:
 *   1. Proveedores (para obtener mapaProveedores)
 *   2. Clientes
 *   3. Productos (usa mapaProveedores)
 *   4. Insumos (usa mapaProveedores)
 *
 * @param {function} [onProgress] - Callback opcional: onProgress(paso, total)
 * @returns {Promise<Array>} Resumen de cada tabla migrada
 *
 * EJEMPLO:
 *   const resumen = await migrarTodo((paso, total) => console.log(`${paso}/${total}`))
 *   console.table(resumen)
 */
export async function migrarTodo(onProgress) {
  const { workspaceId: wsId } = getSyncContext()
  if (!wsId) throw new Error('[migracion] Usuario no autenticado — iniciá sesión primero.')

  const datos = leerDatosLocales()
  const resumen = []
  const pasos = 4

  // ── Paso 1: Proveedores ──────────────────────────────────────────
  onProgress?.(1, pasos)
  const { resultado: resProveedores, mapaProveedores } = await migrarProveedores(wsId, datos.suppliers)
  resumen.push(resProveedores)

  // ── Paso 2: Clientes ─────────────────────────────────────────────
  onProgress?.(2, pasos)
  resumen.push(await migrarClientes(wsId, datos.clients))

  // ── Paso 3: Productos ─────────────────────────────────────────────
  onProgress?.(3, pasos)
  resumen.push(await migrarProductos(wsId, datos.products, mapaProveedores))

  // ── Paso 4: Insumos ──────────────────────────────────────────────
  onProgress?.(4, pasos)
  resumen.push(await migrarInsumos(wsId, datos.insumos, mapaProveedores))

  onProgress?.(pasos, pasos)

  // Calcular totales globales
  const totalRegistros  = resumen.reduce((s, r) => s + r.total,     0)
  const totalInsertados = resumen.reduce((s, r) => s + r.insertadas, 0)
  const totalErrores    = resumen.reduce((s, r) => s + r.errores.length, 0)

  console.log(
    `[migracion] Migración completada — ${totalInsertados}/${totalRegistros} registros`,
    totalErrores ? `⚠️ ${totalErrores} errores` : '✓ sin errores'
  )

  return resumen
}

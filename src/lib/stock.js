/* ─────────────────────────────────────────────
 * Helpers de stock — detección de stock bajo
 * Centraliza la lógica para que Catálogo, Historial (dashboard) y
 * cualquier alerta usen el mismo criterio. Soporta productos con
 * variantes (talle/color): cada variante tiene su propio minStock y
 * se evalúa independiente.
 * ───────────────────────────────────────────── */

const n = (v) => { const x = Number(v); return isNaN(x) ? 0 : x }

/** ¿El producto/insumo está en stock bajo?
 *  Con variantes: bajo si ALGUNA variante tiene minStock>0 y stock<=minStock.
 *  Sin variantes: el clásico stock<=minStock (minStock>0). */
export function isLowStock(p) {
  if (!p) return false
  if (p.variants?.length) {
    return p.variants.some(v => n(v.minStock) > 0 && n(v.stock) <= n(v.minStock))
  }
  return n(p.minStock) > 0 && n(p.stock) <= n(p.minStock)
}

/** Variantes puntuales en stock bajo (para mostrar el detalle en alertas). */
export function lowVariants(p) {
  if (!p?.variants?.length) return []
  return p.variants.filter(v => n(v.minStock) > 0 && n(v.stock) <= n(v.minStock))
}

/** Ratio stock/min para ordenar alertas (menor = más urgente). */
export function stockRatio(stock, minStock) {
  return n(stock) / (n(minStock) || 1)
}

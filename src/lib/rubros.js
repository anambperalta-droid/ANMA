/**
 * rubros.js — Catálogo maestro de rubros comerciales y sus presets
 *
 * Define el universo de rubros válidos para ANMA Pro y, por cada uno, el set
 * de categorías de productos recomendadas (productCats) que se aplican al
 * completar el onboarding o al resetear desde Configuración.
 *
 * Fuente de verdad usada por:
 *   - Onboarding.jsx (selector + seed inicial)
 *   - Config.jsx (botón "Aplicar categorías sugeridas")
 *   - storage.js (fallback genérico cuando aún no hay rubro)
 */

export const RUBROS = [
  {
    val: 'indumentaria',
    icon: '👔',
    label: 'Indumentaria',
    sub: 'Ropa, calzado, accesorios',
  },
  {
    val: 'tecnologia',
    icon: '🔌',
    label: 'Tecnología',
    sub: 'Electrónica, gadgets, insumos',
  },
  {
    val: 'decoracion',
    icon: '🏺',
    label: 'Decoración',
    sub: 'Hogar, deco, regalos',
  },
  {
    val: 'almacen',
    icon: '🧀',
    label: 'Almacén',
    sub: 'Comestibles, bebidas, dietética',
  },
]

export const TIPOS_VENTA = [
  { val: 'minorista', icon: '🛍️', label: 'Minorista',     sub: 'Vendo al consumidor final' },
  { val: 'mayorista', icon: '📦', label: 'Mayorista',     sub: 'Vendo a otros comercios' },
  { val: 'ambos',     icon: '🔄', label: 'Ambos Canales', sub: 'Combino retail y B2B' },
]

/**
 * Categorías de productos sugeridas por rubro.
 * Pensadas para cubrir ~80% de los productos típicos. El usuario siempre
 * puede agregar/quitar después desde Configuración → Listas.
 */
export const CATEGORIES_BY_RUBRO = {
  indumentaria: [
    'Remeras y tops',
    'Pantalones y jeans',
    'Vestidos y polleras',
    'Abrigos y camperas',
    'Calzado',
    'Accesorios',
    'Ropa interior y básicos',
  ],
  tecnologia: [
    'Computación',
    'Periféricos',
    'Audio y sonido',
    'Smartphones y tablets',
    'Gaming',
    'Smart Home',
    'Accesorios y cables',
  ],
  decoracion: [
    'Iluminación',
    'Textiles del hogar',
    'Muebles auxiliares',
    'Cuadros y arte',
    'Plantas y macetas',
    'Aromas y velas',
    'Vajilla y mesa',
  ],
  almacen: [
    'Bebidas',
    'Lácteos y huevos',
    'Panificados',
    'Snacks y golosinas',
    'Conservas y secos',
    'Limpieza',
    'Dietética y sin TACC',
  ],
}

/**
 * Lista genérica histórica — la usaba storage.js antes de tener rubros.
 * La mantenemos exportada para detectar cuándo el usuario "no ha customizado"
 * y entonces poder reemplazarlas con las sugeridas del rubro sin pisar nada.
 */
export const GENERIC_PRODUCT_CATS = [
  'Producto terminado',
  'Semi-elaborado',
  'Reventa',
  'Servicio',
]

/**
 * Devuelve true si la lista actual de categorías coincide con la genérica
 * histórica (o está vacía) — útil para decidir si podemos seedear sin
 * destruir customizaciones del usuario.
 */
export function isGenericOrEmptyCats(cats) {
  if (!Array.isArray(cats) || cats.length === 0) return true
  if (cats.length !== GENERIC_PRODUCT_CATS.length) return false
  return cats.every(c => GENERIC_PRODUCT_CATS.includes(c))
}

/**
 * Devuelve las categorías sugeridas para un rubro. Fallback: lista genérica.
 */
export function getCategoriesForRubro(rubro) {
  return CATEGORIES_BY_RUBRO[rubro] || GENERIC_PRODUCT_CATS
}

/**
 * Metadata de un rubro por su valor — para mostrar el ícono/label en UI.
 */
export function getRubroMeta(rubro) {
  return RUBROS.find(r => r.val === rubro) || null
}

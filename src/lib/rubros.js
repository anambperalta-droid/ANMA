/**
 * rubros.js — Catálogo maestro de rubros comerciales y sus presets
 *
 * Define el universo de rubros válidos para ANMA Hub y, por cada uno, el set
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
    'Remeras',
    'Camisas y blusas',
    'Pantalones y jeans',
    'Calzas y leggings',
    'Vestidos y polleras',
    'Sweaters y buzos',
    'Abrigos y camperas',
    'Calzado',
    'Carteras y mochilas',
    'Accesorios',
    'Ropa interior',
    'Trajes de baño',
  ],
  tecnologia: [
    'Notebooks',
    'Monitores',
    'Periféricos',
    'Audio',
    'Almacenamiento',
    'Componentes PC',
    'Smartphones',
    'Tablets',
    'Gaming',
    'Smart Home',
    'Conectividad',
    'Accesorios y cables',
  ],
  decoracion: [
    'Muebles',
    'Iluminación',
    'Bazar y vajilla',
    'Blanquería y textiles',
    'Decoración de pared',
    'Aromas y velas',
    'Plantas y macetas',
    'Almohadones y mantas',
    'Espejos y marcos',
  ],
  almacen: [
    'Bebidas',
    'Frescos',
    'Lácteos y fiambres',
    'Panificados',
    'Almacén general',
    'Snacks y golosinas',
    'Congelados',
    'Limpieza',
    'Perfumería',
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
 * Presets HISTÓRICOS — todos los sets que alguna vez sembramos por rubro.
 * Lo usamos para reconocer cats que vienen de seeds previos aunque hayamos
 * cambiado el preset actual. Crítico para detectar "no customizadas" después
 * de actualizaciones de la app.
 */
const HISTORICAL_PRESETS = [
  // ─── Indumentaria v1 (original) ───
  ['Remeras y tops', 'Pantalones y jeans', 'Vestidos y polleras', 'Abrigos y camperas', 'Calzado', 'Accesorios', 'Ropa interior y básicos'],
  // ─── Tecnología v1 (original) ───
  ['Computación', 'Periféricos', 'Audio y sonido', 'Smartphones y tablets', 'Gaming', 'Smart Home', 'Accesorios y cables'],
  // ─── Decoración v1 (original) ───
  ['Iluminación', 'Textiles del hogar', 'Muebles auxiliares', 'Cuadros y arte', 'Plantas y macetas', 'Aromas y velas', 'Vajilla y mesa'],
  // ─── Decoración v2 ───
  ['Muebles', 'Iluminación', 'Bazar y vajilla', 'Blanquería y textiles', 'Decoración de pared', 'Aromas y velas', 'Plantas y macetas', 'Almohadones y mantas', 'Espejos y marcos'],
  // ─── Almacén v1 (original) ───
  ['Bebidas', 'Lácteos y huevos', 'Panificados', 'Snacks y golosinas', 'Conservas y secos', 'Limpieza', 'Dietética y sin TACC'],
]

/**
 * Detecta si las categorías del usuario están DESACTUALIZADAS — es decir,
 * coinciden con un preset HISTÓRICO de cualquier rubro pero NO con el preset
 * ACTUAL del rubro que tiene configurado. Útil para mostrar un banner que
 * ofrezca actualizar sin obligar al usuario a redescubrir la opción.
 */
export function catsAreOutdated(cats, rubro) {
  if (!rubro) return false
  if (!Array.isArray(cats) || cats.length === 0) return false
  const sortedCurrent = [...cats].sort().join('|')
  const currentPreset = getCategoriesForRubro(rubro)
  const sortedPreset = [...currentPreset].sort().join('|')
  if (sortedCurrent === sortedPreset) return false  // ya están al día
  // ¿Coinciden con algún preset histórico? Entonces están desactualizadas.
  for (const preset of HISTORICAL_PRESETS) {
    if (sortedCurrent === [...preset].sort().join('|')) return true
  }
  // Overlap alto con preset histórico = también desactualizadas
  const catSet = new Set(cats)
  for (const preset of HISTORICAL_PRESETS) {
    const overlap = preset.filter(p => catSet.has(p)).length
    if (preset.length > 0 && overlap / preset.length >= 0.8) return true
  }
  return false
}

/**
 * Determina si las categorías actuales del usuario coinciden con algún preset
 * (actual o histórico) de cualquier rubro = el usuario nunca las customizó.
 * Si match → es seguro reemplazarlas al cambiar de rubro.
 *
 * También aplica heurística de overlap >= 70% con cualquier preset histórico
 * para cubrir casos donde el usuario tiene pequeñas adiciones pero el núcleo
 * sigue siendo el del rubro.
 */
export function catsMatchAnyRubroPreset(cats) {
  if (!Array.isArray(cats) || cats.length === 0) return true
  const sorted = [...cats].sort().join('|')
  // 1. Match exacto contra cualquier preset actual
  for (const r of Object.keys(CATEGORIES_BY_RUBRO)) {
    const preset = [...CATEGORIES_BY_RUBRO[r]].sort().join('|')
    if (sorted === preset) return true
  }
  // 2. Match exacto contra cualquier preset histórico
  for (const preset of HISTORICAL_PRESETS) {
    if (sorted === [...preset].sort().join('|')) return true
  }
  // 3. Overlap >= 70% con cualquier preset (actual o histórico)
  const catSet = new Set(cats)
  const allPresets = [
    ...Object.values(CATEGORIES_BY_RUBRO),
    ...HISTORICAL_PRESETS,
  ]
  for (const preset of allPresets) {
    const overlap = preset.filter(p => catSet.has(p)).length
    if (preset.length > 0 && overlap / preset.length >= 0.7) return true
  }
  return false
}

/**
 * Metadata de un rubro por su valor — para mostrar el ícono/label en UI.
 */
export function getRubroMeta(rubro) {
  return RUBROS.find(r => r.val === rubro) || null
}

/**
 * ANMA Hub — Validadores centrales para production-ready
 *
 * Reglas:
 * 1. Toda función retorna { ok: boolean, msg?: string }
 * 2. Mensajes en español, listos para mostrar al usuario
 * 3. Tolerantes a null/undefined/whitespace
 * 4. NUNCA lanzan — la responsabilidad es del consumidor
 */

/* ─── Email ─── */
// RFC 5322 simplificada — cubre 99.9% de emails reales sin falsos positivos
const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

export function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false
  const trimmed = email.trim()
  if (trimmed.length > 254) return false  // RFC limit
  return EMAIL_RE.test(trimmed)
}

export function validateEmail(email) {
  if (!email || !email.trim()) return { ok: false, msg: 'El email es requerido.' }
  if (!isValidEmail(email)) return { ok: false, msg: 'Formato de email inválido (ej: nombre@dominio.com).' }
  return { ok: true }
}

/* ─── Contraseña ─── */
// Mínimo 8 chars, al menos 1 letra y 1 número.
// No exigimos símbolos (UX trade-off para pymes; sigue siendo razonable contra brute-force).
export function validatePassword(pwd) {
  if (!pwd) return { ok: false, msg: 'La contraseña es requerida.' }
  if (pwd.length < 8) return { ok: false, msg: 'La contraseña debe tener al menos 8 caracteres.' }
  if (pwd.length > 72) return { ok: false, msg: 'La contraseña no puede superar 72 caracteres (límite bcrypt).' }
  if (!/[a-zA-Z]/.test(pwd)) return { ok: false, msg: 'La contraseña debe incluir al menos una letra.' }
  if (!/\d/.test(pwd)) return { ok: false, msg: 'La contraseña debe incluir al menos un número.' }
  // Detectar passwords muy comunes
  const common = new Set(['12345678', 'password', 'qwerty123', 'abc12345', '11111111'])
  if (common.has(pwd.toLowerCase())) return { ok: false, msg: 'Esa contraseña es muy común. Elegí algo más único.' }
  return { ok: true }
}

// Score 0-4 para UI de fuerza visual
export function passwordStrength(pwd) {
  if (!pwd) return 0
  let s = 0
  if (pwd.length >= 8) s++
  if (pwd.length >= 12) s++
  if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) s++
  if (/\d/.test(pwd) && /[^a-zA-Z\d]/.test(pwd)) s++
  return Math.min(s, 4)
}

/* ─── WhatsApp / Teléfono (formato Argentina-friendly) ─── */
// Acepta: +54 9 11 1234-5678, 1112345678, 011 1234-5678, etc.
// Filosofía: extraer dígitos, validar rango razonable, no ser draconiano.
export function normalizeWhatsApp(raw) {
  if (!raw) return ''
  return String(raw).replace(/[^\d+]/g, '')
}

export function isValidWhatsApp(raw) {
  if (!raw) return false
  const digits = String(raw).replace(/\D/g, '')
  // Mínimo razonable: 8 dígitos (sin código país). Máximo: 15 (E.164).
  if (digits.length < 8 || digits.length > 15) return false
  return true
}

export function validateWhatsApp(raw, { required = false } = {}) {
  if (!raw || !raw.trim()) {
    return required
      ? { ok: false, msg: 'El WhatsApp es requerido.' }
      : { ok: true }  // vacío permitido si no es required
  }
  if (!isValidWhatsApp(raw)) {
    return { ok: false, msg: 'WhatsApp inválido. Ingresá entre 8 y 15 dígitos (ej: +54 9 11 1234-5678).' }
  }
  return { ok: true }
}

/* ─── CUIT (Argentina) ─── */
// XX-XXXXXXXX-X · validación con dígito verificador.
export function isValidCUIT(raw) {
  if (!raw) return false
  const digits = String(raw).replace(/\D/g, '')
  if (digits.length !== 11) return false

  const mult = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
  let sum = 0
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i], 10) * mult[i]
  let check = 11 - (sum % 11)
  if (check === 11) check = 0
  if (check === 10) return false  // CUIT inválido por regla AFIP
  return check === parseInt(digits[10], 10)
}

export function validateCUIT(raw, { required = false } = {}) {
  if (!raw || !raw.trim()) {
    return required
      ? { ok: false, msg: 'El CUIT es requerido.' }
      : { ok: true }
  }
  if (!isValidCUIT(raw)) {
    return { ok: false, msg: 'CUIT inválido. Verificá los dígitos (ej: 30-71234567-8).' }
  }
  return { ok: true }
}

/* ─── Números (precios, porcentajes, stock) ─── */
export function validateNumber(value, { min, max, allowFloat = true, name = 'El valor' } = {}) {
  if (value === '' || value === null || value === undefined) return { ok: true }  // vacío = sin valor
  const n = Number(value)
  if (!Number.isFinite(n)) return { ok: false, msg: `${name} debe ser un número válido.` }
  if (!allowFloat && !Number.isInteger(n)) return { ok: false, msg: `${name} debe ser un número entero.` }
  if (min !== undefined && n < min) return { ok: false, msg: `${name} no puede ser menor a ${min}.` }
  if (max !== undefined && n > max) return { ok: false, msg: `${name} no puede ser mayor a ${max}.` }
  return { ok: true }
}

export function validatePercent(value, name = 'El porcentaje') {
  return validateNumber(value, { min: 0, max: 100, name })
}

export function validatePrice(value, name = 'El precio') {
  return validateNumber(value, { min: 0, name })
}

export function validateStock(value, name = 'El stock') {
  return validateNumber(value, { min: 0, allowFloat: false, name })
}

/* ─── Fechas ─── */
export function validateDateNotPast(iso, { name = 'La fecha', allowToday = true } = {}) {
  if (!iso) return { ok: true }
  const d = new Date(iso + 'T00:00')
  if (Number.isNaN(d.getTime())) return { ok: false, msg: `${name} es inválida.` }
  const today = new Date(); today.setHours(0, 0, 0, 0)
  if (allowToday ? d < today : d <= today) {
    return { ok: false, msg: `${name} no puede ser en el pasado.` }
  }
  return { ok: true }
}

/* ─── Texto requerido ─── */
export function validateRequired(value, name = 'El campo') {
  if (!value || (typeof value === 'string' && !value.trim())) {
    return { ok: false, msg: `${name} es requerido.` }
  }
  return { ok: true }
}

/* ─── Sanitización (para evitar caracteres problemáticos al exportar a CSV/PDF) ─── */
export function sanitizeForCSV(value) {
  if (value === null || value === undefined) return ''
  const s = String(value)
  // Prevenir CSV injection (Excel/Sheets ejecutan fórmulas si la celda empieza con = + - @)
  if (/^[=+\-@\t\r]/.test(s)) return "'" + s
  return s
}

export function sanitizeForFilename(value) {
  if (!value) return 'archivo'
  return String(value).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100)
}

/* ─── Agrupador: validar un objeto entero ─── */
// validateForm({ email, password }, { email: validateEmail, password: validatePassword })
// → { ok: bool, errors: { email?: string, password?: string } }
export function validateForm(values, schema) {
  const errors = {}
  let ok = true
  for (const key in schema) {
    const fn = schema[key]
    if (typeof fn !== 'function') continue
    const res = fn(values[key])
    if (!res?.ok) {
      errors[key] = res?.msg || 'Inválido'
      ok = false
    }
  }
  return { ok, errors }
}

/**
 * ANMA Hub — CORS allowlist para las funciones serverless.
 *
 * Solo se permite responder con Access-Control-Allow-Origin a:
 *   - el dominio de producción (anmahub.com / www)
 *   - el propio origen del deployment (cubre los *.vercel.app de previews,
 *     porque ahí origin === https://<host> de la request)
 *
 * Cualquier otro origen NO recibe el header CORS, así un sitio ajeno no puede
 * llamar estas APIs desde el navegador de un tercero.
 *
 * Nota: las llamadas desde la propia app son same-origin (no dispara CORS),
 * así que esto es defensa contra orígenes cruzados, no rompe el flujo normal.
 */
const STATIC_ALLOWED = [
  'https://anmahub.com',
  'https://www.anmahub.com',
]

export function applyCors(req, res, methods = 'POST, OPTIONS') {
  const origin = req.headers.origin || ''
  const host = req.headers.host || ''
  const allowed =
    STATIC_ALLOWED.includes(origin) ||
    (!!origin && origin === `https://${host}`)

  if (allowed) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Methods', methods)
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  return allowed
}

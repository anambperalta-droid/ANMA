/* ─────────────────────────────────────────
   ANMA Hub — Emails del SISTEMA (vía EmailJS)
   ─────────────────────────────────────────
   Distinto del EmailJS del usuario (que manda presupuestos a SUS clientes,
   con credenciales por-workspace en Config). Acá usamos UNA cuenta EmailJS
   del sistema (de Ana) para:
     1. Avisar a Ana cuando alguien se registra (notifyAdminSignup)
     2. Avisar al usuario cuando su prueba está por vencer / venció (notifyUserTrial)

   Las DOS funciones usan EL MISMO TEMPLATE (plan free de EmailJS = 1 template).
   El template debe usar variables genéricas: {{to_email}} {{subject}}
   {{headline}} {{body}} {{cta_url}}.

   Credenciales por env vars (Vercel → Settings → Environment Variables):
     VITE_EMAILJS_SYS_SERVICE      → Service ID de EmailJS
     VITE_EMAILJS_SYS_PUBLIC_KEY   → Public Key
     VITE_EMAILJS_SYS_TPL          → Template ID (uno solo, sirve para ambos)
     VITE_ADMIN_EMAIL              → (opcional) email de Ana, default abajo

   Si faltan las env vars, las funciones hacen no-op silencioso.
─────────────────────────────────────────── */

const SVC = import.meta.env.VITE_EMAILJS_SYS_SERVICE || ''
const PUB = import.meta.env.VITE_EMAILJS_SYS_PUBLIC_KEY || ''
const TPL = import.meta.env.VITE_EMAILJS_SYS_TPL
        || import.meta.env.VITE_EMAILJS_SYS_TPL_SIGNUP
        || import.meta.env.VITE_EMAILJS_SYS_TPL_TRIAL
        || ''
const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || 'ana.mbperalta@gmail.com'

async function emailjsSend(params) {
  if (!SVC || !PUB || !TPL) return false
  try {
    const emailjs = (await import('@emailjs/browser')).default
    await emailjs.send(SVC, TPL, params, PUB)
    return true
  } catch (e) {
    if (import.meta.env.DEV) console.warn('systemEmail send failed:', e?.text || e?.message || e)
    return false
  }
}

export async function notifyAdminSignup({ businessName, email, source = 'email' }) {
  const src = source === 'google' ? 'Google' : 'Email'
  const fecha = new Date().toLocaleString('es-AR', { dateStyle: 'long', timeStyle: 'short' })
  return emailjsSend({
    to_email:  ADMIN_EMAIL,
    subject:   `Nuevo registro en ANMA Hub: ${businessName || email || 'sin nombre'}`,
    headline:  'Nuevo registro en ANMA Hub',
    body:      `Negocio: ${businessName || '—'}\nEmail: ${email || '—'}\nRegistrado vía: ${src}\nFecha: ${fecha}\n\nEntrá al Admin para contactarlo.`,
    cta_url:   'https://anmahub.com/app/admin',
  })
}

export async function notifyUserTrial({ email, businessName, phase, daysLeft }) {
  if (!email) return false
  const copy = {
    day_5: {
      subject: 'Te quedan 2 días de prueba en ANMA',
      headline: 'Tu prueba está por terminar',
      body: 'Faltan 2 días para que termine tu período de prueba. Activá tu plan para que tus presupuestos, clientes y productos sigan disponibles sin interrupciones.',
    },
    day_7: {
      subject: 'Hoy se vence tu prueba de ANMA',
      headline: 'Último día de prueba',
      body: 'Hoy es el último día de tu prueba. Activá tu plan ahora para no perder el acceso a tu negocio en ANMA.',
    },
    expired: {
      subject: 'Tu prueba de ANMA terminó — reactivá cuando quieras',
      headline: 'Tu período de prueba terminó',
      body: 'Tu prueba llegó a su fin, pero tus datos siguen guardados y seguros. Reactivá tu plan para retomar exactamente donde quedaste.',
    },
  }[phase] || {
    subject: 'Tu prueba de ANMA terminó — reactivá cuando quieras',
    headline: 'Tu período de prueba terminó',
    body: 'Tu prueba llegó a su fin, pero tus datos siguen guardados y seguros. Reactivá tu plan para retomar exactamente donde quedaste.',
  }

  return emailjsSend({
    to_email:  email,
    subject:   copy.subject,
    headline:  copy.headline,
    body:      copy.body,
    cta_url:   'https://anmahub.com/app/activar',
  })
}

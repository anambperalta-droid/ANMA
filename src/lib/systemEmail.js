/* ─────────────────────────────────────────
   ANMA Hub — Emails del SISTEMA (vía EmailJS)
   ─────────────────────────────────────────
   Distinto del EmailJS del usuario (que manda presupuestos a SUS clientes,
   con credenciales por-workspace en Config). Acá usamos UNA cuenta EmailJS
   del sistema (de Ana) para:
     1. Avisar a Ana cuando alguien se registra (notifyAdminSignup)
     2. Avisar al usuario cuando su prueba está por vencer / venció (notifyUserTrial)

   Credenciales por env vars (Vercel → Settings → Environment Variables):
     VITE_EMAILJS_SYS_SERVICE      → Service ID de EmailJS
     VITE_EMAILJS_SYS_PUBLIC_KEY   → Public Key
     VITE_EMAILJS_SYS_TPL_SIGNUP   → Template ID del aviso de signup (a Ana)
     VITE_EMAILJS_SYS_TPL_TRIAL    → Template ID del aviso de trial (al usuario)
     VITE_ADMIN_EMAIL              → (opcional) email de Ana, default abajo

   Si faltan las env vars, las funciones hacen no-op silencioso (no rompen
   el registro ni la app). Así se puede deployar el código antes de configurar.
─────────────────────────────────────────── */

const SVC = import.meta.env.VITE_EMAILJS_SYS_SERVICE || ''
const PUB = import.meta.env.VITE_EMAILJS_SYS_PUBLIC_KEY || ''
const TPL_SIGNUP = import.meta.env.VITE_EMAILJS_SYS_TPL_SIGNUP || ''
const TPL_TRIAL = import.meta.env.VITE_EMAILJS_SYS_TPL_TRIAL || ''
const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || 'ana.mbperalta@gmail.com'

async function emailjsSend(template, params) {
  if (!SVC || !PUB || !template) return false  // sin config → no-op silencioso
  try {
    const emailjs = (await import('@emailjs/browser')).default
    await emailjs.send(SVC, template, params, PUB)
    return true
  } catch (e) {
    // Nunca propagar: un fallo de email no debe romper signup ni navegación
    if (import.meta.env.DEV) console.warn('systemEmail send failed:', e?.text || e?.message || e)
    return false
  }
}

/**
 * Avisa a Ana que se registró un usuario nuevo.
 * Se dispara desde el navegador del usuario justo al completar el registro.
 */
export async function notifyAdminSignup({ businessName, email, source = 'email' }) {
  return emailjsSend(TPL_SIGNUP, {
    to_email:      ADMIN_EMAIL,
    subject:       `Nuevo registro en ANMA Hub: ${businessName || email || 'sin nombre'}`,
    business_name: businessName || '—',
    user_email:    email || '—',
    signup_source: source === 'google' ? 'Google' : 'Email',
    signup_date:   new Date().toLocaleString('es-AR', { dateStyle: 'long', timeStyle: 'short' }),
  })
}

/**
 * Avisa al USUARIO sobre su trial (por vencer / vencido).
 * phase: 'day_5' | 'day_7' | 'expired'
 */
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
  }[phase] || copy?.expired

  return emailjsSend(TPL_TRIAL, {
    to_email:      email,
    subject:       copy.subject,
    headline:      copy.headline,
    body:          copy.body,
    business_name: businessName || 'tu negocio',
    days_left:     daysLeft ?? 0,
    activate_url:  'https://anmahub.com/app/activar',
  })
}

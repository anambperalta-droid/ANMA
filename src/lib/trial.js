/* ─────────────────────────────────────────
   ANMA Hub — Trial engine
   7 días desde trial_started_at en user_metadata.
   Si el usuario tiene `subscribed: true` o `invited_to_site`
   (operador invitado), el trial no aplica.
───────────────────────────────────────── */
export const TRIAL_DAYS = 30

/**
 * @param {object|null} user  — Supabase user object
 * @returns {{ isTrial, active, expired, daysLeft, elapsedDays }}
 */
export function getTrialStatus(user) {
  // ANMA Hub Test: 30 días de acceso libre, sin pago.
  if (!user) return { isTrial: false, active: false, expired: false, daysLeft: 0, elapsedDays: 0 }
  const meta = user.user_metadata || {}
  if (meta.subscribed) return { isTrial: false, active: false, expired: false, daysLeft: 0, elapsedDays: 0 }
  const start = meta.trial_started_at ? new Date(meta.trial_started_at) : new Date(user.created_at)
  const elapsed = Math.floor((Date.now() - start.getTime()) / 86400000)
  const left = Math.max(0, TRIAL_DAYS - elapsed)
  return { isTrial: true, active: left > 0, expired: left <= 0, daysLeft: left, elapsedDays: elapsed }
}

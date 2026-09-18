/* ─────────────────────────────────────────
   ANMA Hub — Trial engine
   7 días desde trial_started_at en user_metadata.
   Si el usuario tiene `subscribed: true` o `invited_to_site`
   (operador invitado), el trial no aplica.
───────────────────────────────────────── */
export const TRIAL_DAYS = 7

/**
 * @param {object|null} user  — Supabase user object
 * @returns {{ isTrial, active, expired, daysLeft, elapsedDays }}
 */
export function getTrialStatus(user) {
  // ANMA Hub Test: acceso libre sin restricción de trial ni pago.
  return { isTrial: false, active: false, expired: false, daysLeft: 0, elapsedDays: 0 }
}

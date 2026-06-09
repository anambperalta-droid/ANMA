import { useEffect, useRef } from 'react'
import { supabase } from './supabase'

/**
 * useRealtimeSignups — escucha INSERT en `workspaces` vía Supabase Realtime.
 *
 * Cuando un usuario nuevo se registra y se crea su workspace, se dispara
 * el callback `onSignup(workspace)` con los datos básicos.
 *
 * Diseño:
 *   - Solo activa el channel si el caller lo está autorizado (admin).
 *   - Auto-cleanup al desmontar (importante para no leak channels).
 *   - Filtra solo registros NUEVOS — ignora updates de workspaces existentes.
 *   - Resistente a re-renders: el callback se mantiene fresco vía ref.
 *
 * Uso:
 *   useRealtimeSignups((ws) => {
 *     showToast(`Nuevo signup: ${ws.name}`)
 *     notify(ws)
 *   }, isGlobalAdmin)
 */
export function useRealtimeSignups(onSignup, enabled = true) {
  const cbRef = useRef(onSignup)
  useEffect(() => { cbRef.current = onSignup }, [onSignup])

  useEffect(() => {
    if (!enabled) return

    const channel = supabase
      .channel('admin-signups')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'workspaces',
        },
        (payload) => {
          try {
            if (typeof cbRef.current === 'function') cbRef.current(payload.new)
          } catch { /* never throw from realtime handler */ }
        }
      )
      .subscribe()

    return () => {
      try { supabase.removeChannel(channel) } catch { /* ignorar */ }
    }
  }, [enabled])
}

/**
 * Permission helper para Notification API.
 * Devuelve 'granted' | 'denied' | 'default'
 */
export async function ensureNotificationPermission() {
  if (typeof Notification === 'undefined') return 'denied'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  try {
    const result = await Notification.requestPermission()
    return result
  } catch {
    return 'denied'
  }
}

/**
 * Envía una notificación browser nativa.
 * Si el permission no está granted, falla silenciosamente.
 */
export function sendBrowserNotification(title, opts = {}) {
  if (typeof Notification === 'undefined') return null
  if (Notification.permission !== 'granted') return null
  try {
    return new Notification(title, {
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      requireInteraction: false,
      ...opts,
    })
  } catch {
    return null
  }
}

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from './ToastContext'
import { CURRENT_SITE } from '../lib/invites'
import { setStorageUser } from '../lib/storage'
import { initSync, pullFromCloud } from '../lib/sync'
import { getTrialStatus } from '../lib/trial'
import { injectSeedData } from '../lib/seedData'

const Ctx = createContext()

// Lista única de admins globales. Tienen acceso cross-site y ven
// todas las tabs sensibles (Equipo / Pagos / Integraciones / Cuenta).
const GLOBAL_ADMINS = ['ana.mbperalta@gmail.com']

export function isGlobalAdminEmail(email) {
  return !!email && GLOBAL_ADMINS.includes(String(email).toLowerCase())
}

/**
 * Verifica si el usuario tiene permiso para acceder al sitio actual.
 * Reglas:
 *  1. Si el user NO tiene metadata `allowed_sites` → acceso libre (usuarios legacy)
 *  2. Si tiene `allowed_sites` → debe incluir el key del sitio actual
 *  3. Si tiene `invited_to_site` (de invitación nueva) → debe coincidir con el sitio actual
 *     o estar en `allowed_sites`
 *
 * Los admin (ana.mbperalta) tienen acceso a todo siempre.
 */
function canAccessSite(user) {
  if (!user) return false
  const meta = user.user_metadata || {}

  // Admins globales: siempre tienen acceso a ambos sitios
  if (isGlobalAdminEmail(user.email)) return true

  // Si el usuario tiene lista explícita de sitios permitidos
  const allowed = meta.allowed_sites
  if (Array.isArray(allowed) && allowed.length > 0) {
    return allowed.includes(CURRENT_SITE.key)
  }

  // Si fue invitado a un sitio específico, solo puede entrar a ese
  const invitedTo = meta.invited_to_site
  if (invitedTo) {
    return invitedTo === CURRENT_SITE.key
  }

  // Usuarios legacy (sin metadata de sitio): acceso libre para no romper nada
  return true
}

export function AuthProvider({ children }) {
  const [authed, setAuthed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [siteBlocked, setSiteBlocked] = useState(false)
  const toast = useToast()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user && !canAccessSite(session.user)) {
        setSiteBlocked(true)
        setAuthed(false)
        setUser(null)
        setStorageUser(null)
      } else {
        setAuthed(!!session)
        setUser(session?.user ?? null)
        setStorageUser(session?.user?.id ?? null)
        if (session?.user?.id) {
          initSync(session.user.id)
          pullFromCloud(session.user.id)
        }
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user && !canAccessSite(session.user)) {
        setSiteBlocked(true)
        setAuthed(false)
        setUser(null)
        setStorageUser(null)
        return
      }
      setSiteBlocked(false)
      setAuthed(!!session)
      setUser(session?.user ?? null)
      setStorageUser(session?.user?.id ?? null)
      initSync(session?.user?.id ?? null)

      if (_event === 'SIGNED_IN' && session?.user) {
        pullFromCloud(session.user.id)

        const meta    = session.user.user_metadata || {}
        const isNew   = !meta.trial_started_at && !meta.invited_to_site && !meta.subscribed
        const isOAuth = session.user.app_metadata?.provider !== 'email'

        if (isNew && isOAuth) {
          // Usuario nuevo vía Google/OAuth: inyectar trial metadata + seed data
          const trialStart = new Date().toISOString()
          supabase.auth.updateUser({
            data: {
              trial_started_at: trialStart,
              is_trial:         true,
              business_name:    meta.full_name || meta.name || '',
              allowed_sites:    ['hub'],
            },
          }).then(() => {
            injectSeedData(session.user.id, meta.full_name || meta.name || '')
          })
        } else if (meta.is_trial) {
          // Seed data para usuario email (si no fue inyectado aún)
          injectSeedData(session.user.id, meta.business_name || '')
        }
      }

      if (_event === 'SIGNED_OUT') {
        setStorageUser(null)
        toast('Sesion cerrada.', 'in')
      }
    })

    return () => subscription.unsubscribe()
  }, [toast])

  const login = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return error.message

    // Verificar acceso al sitio después del login
    if (data.user && !canAccessSite(data.user)) {
      await supabase.auth.signOut()
      return `No tenés acceso a ${CURRENT_SITE.label}. Contactá al administrador.`
    }

    return null
  }, [])

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
    setStorageUser(null)
    setAuthed(false)
    setUser(null)
    setSiteBlocked(false)
  }, [])

  const changePassword = useCallback(async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) throw new Error(error.message)
  }, [])

  const resetPassword = useCallback(async (email) => {
    // URL canónica hardcodeada por host: evita "link inválido" si el user
    // entró desde un dominio no whitelisteado en Supabase Dashboard.
    const host = window.location.hostname
    const base = (host === 'localhost' || host === '127.0.0.1')
      ? window.location.origin
      : host.includes('anma-host')
        ? 'https://anma-host.vercel.app'
        : 'https://anmahub.com'
    // Sin query extra: el template de email agrega ?token_hash=...&type=recovery
    // sobre esta URL (link directo a la app, inmune al prefetch de Gmail/Chrome).
    const redirectTo = `${base}/app/bienvenida`
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
    if (error) throw new Error(error.message)
  }, [])

  const isGlobalAdmin = isGlobalAdminEmail(user?.email)
  const trial         = getTrialStatus(user)

  // ── Role resolution ──────────────────────────────────────────────
  // - Admin global (email en GLOBAL_ADMINS) → 'owner' siempre.
  // - Si user_metadata.role === 'operator' → 'operator' (acceso reducido).
  // - Caso default (usuarios legacy sin role definido) → 'owner' (no rompe nada).
  const metaRole = (user?.user_metadata?.role || '').toLowerCase()
  const role = isGlobalAdmin ? 'owner' : (metaRole === 'operator' ? 'operator' : 'owner')

  // Permisos del rol operator. Owner tiene '*' implícito.
  const OPERATOR_PERMS = new Set([
    'dashboard.view',
    'pedido.view', 'pedido.create', 'pedido.edit', 'pedido.status', 'pedido.payment',
    'cliente.view', 'cliente.create', 'cliente.edit',
    'proveedor.view',
    'catalogo.view',
    'insumo.view',
    'logistica.view', 'logistica.edit',
    'mensajes.view', 'mensajes.send',
    'historial.view',
  ])

  const can = useCallback((perm) => {
    if (!perm) return true
    if (role === 'owner') return true
    return OPERATOR_PERMS.has(perm)
  }, [role])

  return (
    <Ctx.Provider value={{ authed, loading, user, login, logout, siteBlocked, isGlobalAdmin, changePassword, resetPassword, role, can, trial }}>
      {children}
    </Ctx.Provider>
  )
}

export const useAuth = () => useContext(Ctx)

/**
 * Guard declarativo. Renderiza children solo si el rol actual tiene el permiso.
 * Si no, muestra `fallback` (default: null, ocultar silenciosamente).
 * Útil para ocultar botones/secciones dentro de una página.
 */
export function RequirePerm({ perm, fallback = null, children }) {
  const { can } = useContext(Ctx)
  return can(perm) ? children : fallback
}

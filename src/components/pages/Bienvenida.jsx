import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { passwordStrength } from '../../lib/validate'
import { consumeAcquisitionAfterOAuth } from '../../lib/acquisitionTracking'

const STRENGTH_LABELS = ['', 'Débil', 'Aceptable', 'Buena', 'Excelente']
const STRENGTH_COLORS = ['#E5E7EB', '#DC2626', '#D97706', '#10B981', '#059669']

// Detecta si estamos atrapados en un webview in-app (Gmail iOS, Instagram, Facebook)
// — ahí los tokens no persisten entre webview y browser real, causando "enlace inválido".
function isInAppBrowser() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  return /FBAN|FBAV|Instagram|Line\/|MicroMessenger|GSA\/|Pinterest|TikTok/i.test(ua)
    || (/iPhone|iPad/i.test(ua) && /Mobile\/\w+ (?!Safari)/i.test(ua))   // iOS Gmail/etc
}

// Log estructurado para debug en producción (visible en consola del browser del cliente).
function logAuth(stage, info) {
  try { console.log(`[anma-auth] ${stage}`, info) } catch { /* ignorar */ }
}

/**
 * Bienvenida — landing post-auth con DOS flujos distintos:
 *
 *   A) OAuth (Google) → el usuario ya tiene cuenta vía Google, no necesita
 *      contraseña. Detectamos `app_metadata.provider === 'google'` (o
 *      `providers` contains 'google') y redirigimos directo a /.
 *
 *   B) Invitación por email (token_hash / magic link) → el usuario nuevo
 *      tiene que elegir contraseña. Mostramos el formulario clásico.
 *
 * El detector debajo distingue ambos casos para no mostrar UI confusa.
 */
export default function Bienvenida() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const [isOAuthUser, setIsOAuthUser] = useState(false)   // ← skip password form si true
  const navigate = useNavigate()

  // Helper: chequear si el usuario actual vino de OAuth (Google) en cuyo caso
  // ya tiene credenciales y NO necesita elegir contraseña. Lo mandamos al app.
  const isOAuthSession = (session) => {
    if (!session?.user) return false
    const provider = session.user.app_metadata?.provider
    const providers = session.user.app_metadata?.providers || []
    if (provider === 'google') return true
    if (Array.isArray(providers) && providers.includes('google')) return true
    return false
  }

  // Después de validar la sesión: si es OAuth user → redirect inmediato.
  // Antes de redirigir, transferimos la acquisition data persistida (UTM/referrer)
  // del localStorage al user_metadata + workspace. Esto permite trackear el canal
  // por el cual entró un user de Google OAuth.
  // Lee el next= post-OAuth: primero del query param, después del localStorage.
  // Whitelist: solo paths internos que empiezan con / y no con // (anti open-redirect).
  const resolveNextUrl = () => {
    try {
      const params = new URLSearchParams(window.location.search)
      const nQuery = params.get('next')
      if (nQuery && nQuery.startsWith('/') && !nQuery.startsWith('//')) return nQuery
      const nLS = localStorage.getItem('anma_post_auth_next')
      if (nLS && nLS.startsWith('/') && !nLS.startsWith('//')) {
        localStorage.removeItem('anma_post_auth_next')
        return nLS
      }
    } catch { /* noop */ }
    return '/'
  }
  const finishAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (isOAuthSession(session)) {
      await applyAcquisitionData(session?.user?.id)
      navigate(resolveNextUrl(), { replace: true })
      return true
    }
    return false
  }

  // Asocia los UTM/referrer capturados pre-OAuth al user_metadata y al workspace
  // (sólo si el WS aún no tiene canal — anti-overwrite de datos previos).
  const applyAcquisitionData = async (userId) => {
    if (!userId) return
    const acq = consumeAcquisitionAfterOAuth()
    if (!acq || !acq.acquisition_channel) return
    try {
      await supabase.auth.updateUser({ data: acq })
      await supabase
        .from('workspaces')
        .update({
          acquisition_channel: acq.acquisition_channel,
          acquisition_source:  acq.acquisition_source || null,
          utm_medium:          acq.utm_medium || null,
          utm_campaign:        acq.utm_campaign || null,
          utm_content:         acq.utm_content || null,
          referrer:            acq.referrer || null,
          landing_page:        acq.landing_page || null,
        })
        .eq('owner_id', userId)
        .is('acquisition_channel', null)
    } catch (e) {
      logAuth('acquisition-apply-error', e?.message)
    }
  }

  // Flow detectado del email: 'recovery' | 'invite' | 'signup' | 'magiclink' | null
  const [authFlow, setAuthFlow] = useState(null)

  useEffect(() => {
    async function detectSession() {
      const url = new URL(window.location.href)
      const params = url.searchParams
      const hash = window.location.hash || ''
      logAuth('start', { href: window.location.href, hasCode: !!params.get('code'), hasHash: hash.includes('access_token') })

      // 0) Errores devueltos por Supabase — pueden venir en el query
      //    (?error=...) O en el hash (#error=...&error_code=otp_expired).
      const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.substring(1) : hash)
      const errorParam = params.get('error') || params.get('error_code') || hashParams.get('error') || hashParams.get('error_code')
      const errorDesc = params.get('error_description') || hashParams.get('error_description')
      if (errorParam) {
        logAuth('supabase-error', { errorParam, errorDesc })
        const desc = (errorDesc || '').toLowerCase()
        const code = (errorParam || '').toLowerCase()
        // Hint específico para admin: si signup está deshabilitado en Supabase, el OAuth
        // de Google con un email nuevo rebota acá con "signup_disabled" o "database error".
        const isSignupBlocked =
          code.includes('signup') ||
          desc.includes('signup') ||
          desc.includes('signups not allowed') ||
          desc.includes('database error saving new user')
        // bad_oauth_state: cookie de state no se mantuvo entre Google y el callback.
        // Causa típica: navegador en modo incógnito / privado (bloquea cookies de terceros),
        // bloqueador de cookies muy estricto, o el usuario tardó demasiado en el consentimiento.
        const isBadOAuthState =
          code.includes('bad_oauth_state') ||
          desc.includes('state not found') ||
          desc.includes('state has expired')
        const friendly =
          isSignupBlocked
            ? 'No se pueden crear cuentas nuevas en este momento. Si esto te pasó intentando registrarte con Google, escribinos a ana.mbperalta@gmail.com — vamos a habilitarte el acceso. (Error: ' + (errorDesc || errorParam) + ')'
          : isBadOAuthState
            ? 'Tu navegador bloqueó el ingreso (suele pasar en modo incógnito o con bloqueadores de cookies estrictos). Cerrá esta ventana, abrí Chrome o Edge en modo normal y volvé a entrar — el login con Google va a funcionar.'
          : desc.includes('expired') ? 'El enlace expiró. Pedí uno nuevo desde Ingresar → ¿La olvidaste?'
          : desc.includes('used')   ? 'Este enlace ya fue usado. Si no entraste, pedí uno nuevo.'
          : desc.includes('access_denied') ? 'Rechazaste el acceso. Probá de nuevo desde el login.'
          : desc.includes('user_banned') ? 'Tu cuenta está suspendida. Escribinos a ana.mbperalta@gmail.com para revisarlo.'
          : (errorDesc || 'No pudimos completar el ingreso. Probá de nuevo o escribinos a ana.mbperalta@gmail.com')
        setError(friendly)
        setLoading(false)
        return
      }

      // Si el user abrió el link desde Gmail iOS / Instagram / etc. (in-app browser),
      // los tokens no persistirán. Mostramos guía para abrirlo en Safari/Chrome.
      if (isInAppBrowser() && (params.get('code') || params.get('token_hash') || params.get('token') || hash.includes('access_token'))) {
        logAuth('in-app-browser-detected', { ua: navigator.userAgent })
        setError('Abrí este enlace en Safari o Chrome (no en Gmail/Instagram). Tocá los 3 puntos → "Abrir en navegador".')
        setLoading(false)
        return
      }

      // 1) PKCE flow: ?code= (Google OAuth + invitation PKCE)
      // CRÍTICO: el cliente Supabase tiene detectSessionInUrl:true, que consume
      // el ?code= AUTOMÁTICAMENTE al cargar la página. Si después llamamos
      // exchangeCodeForSession manualmente, falla con "code already used" aunque
      // la sesión YA EXISTE. Por eso: chequear sesión ANTES, y si el exchange
      // falla, rechequear ANTES de mostrar error (era el bug de Google OAuth).
      const code = params.get('code')
      if (code) {
        logAuth('pkce-flow', { code: code.slice(0, 8) + '...' })

        // ¿El auto-detect ya canjeó el código? → sesión lista, seguir.
        let { data: { session: preSession } } = await supabase.auth.getSession()
        if (preSession) {
          logAuth('pkce-auto-detected', { user: preSession.user?.email })
          window.history.replaceState(null, '', window.location.pathname)
          if (await finishAuth()) return
          setSessionReady(true); setLoading(false); return
        }

        const { error: codeErr } = await supabase.auth.exchangeCodeForSession(code)
        if (codeErr) {
          logAuth('pkce-error', codeErr)
          // Carrera: el auto-detect (detectSessionInUrl) pudo estar canjeando el
          // código en paralelo. Polleamos la sesión hasta 3.5s antes de declarar
          // el enlace inválido — en redes lentas 600ms no alcanzaban.
          let recovered = null
          for (let i = 0; i < 7 && !recovered; i++) {
            await new Promise(r => setTimeout(r, 500))
            const { data: { session: postSession } } = await supabase.auth.getSession()
            if (postSession) recovered = postSession
          }
          if (recovered) {
            logAuth('pkce-race-recovered', { user: recovered.user?.email })
            window.history.replaceState(null, '', window.location.pathname)
            if (await finishAuth()) return
            setSessionReady(true); setLoading(false); return
          }
          // Caso origen cruzado: el flujo OAuth empezó en otro dominio (el
          // code_verifier vive allá). Reintentar acá mismo lo resuelve.
          const m = String(codeErr.message || '').toLowerCase()
          if (m.includes('verifier')) {
            logAuth('pkce-cross-origin', null)
            setError('El inicio de sesión empezó desde otra dirección de ANMA. Tocá "Volver a Ingresar" y probá de nuevo acá — va a funcionar.')
            setLoading(false)
            return
          }
          setError('El enlace expiró o ya fue usado. Pedí uno nuevo desde Ingresar.')
          setLoading(false)
          return
        }
        window.history.replaceState(null, '', window.location.pathname)
        if (await finishAuth()) return
        setSessionReady(true); setLoading(false); return
      }

      // 2) Implicit flow: #access_token= en hash (OAuth legacy + recovery viejo)
      if (hash && hash.includes('access_token')) {
        const hp = new URLSearchParams(hash.substring(1))
        const accessToken = hp.get('access_token')
        const refreshToken = hp.get('refresh_token')
        const hashType = hp.get('type')
        if (hashType) setAuthFlow(hashType)
        if (accessToken && refreshToken) {
          logAuth('hash-flow', { type: hashType })
          const { error: sessErr } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          if (sessErr) {
            logAuth('hash-error', sessErr)
            setError('El enlace expiró o ya fue usado. Pedí uno nuevo desde Ingresar.')
            setLoading(false)
            return
          }
          window.history.replaceState(null, '', window.location.pathname)
          if (hashType !== 'recovery' && await finishAuth()) return
          setSessionReady(true); setLoading(false); return
        }
      }

      // 3) Token hash flow: ?token_hash=&type=  (formato actual de Supabase emails)
      const tokenHash = params.get('token_hash')
      const type = params.get('type')
      if (tokenHash && type) {
        logAuth('token-hash-flow', { type })
        setAuthFlow(type)
        const { error: otpErr } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
        if (otpErr) {
          logAuth('token-hash-error', otpErr)
          // Doble click en el email: el primer click ya canjeó el token y la
          // sesión existe → seguir normal en vez de mostrar un error falso.
          const { data: { session: dupSession } } = await supabase.auth.getSession()
          if (dupSession) {
            logAuth('token-hash-dup-recovered', { user: dupSession.user?.email })
            window.history.replaceState(null, '', window.location.pathname)
            setSessionReady(true); setLoading(false); return
          }
          const m = String(otpErr.message || '').toLowerCase()
          setError(
            m.includes('expired') ? 'Este enlace expiró (vencen al hora). Pedí uno nuevo.'
            : m.includes('invalid') || m.includes('used') ? 'Este enlace ya fue usado. Pedí uno nuevo desde Ingresar.'
            : 'El enlace es inválido. Pedí uno nuevo desde Ingresar → ¿La olvidaste?'
          )
          setLoading(false)
          return
        }
        window.history.replaceState(null, '', window.location.pathname)
        setSessionReady(true); setLoading(false); return
      }

      // 4) Token legacy: ?token=&type=  (emails viejos antes de migrar a token_hash)
      const legacyToken = params.get('token')
      if (legacyToken && type) {
        logAuth('legacy-token-flow', { type })
        setAuthFlow(type)
        const { error: legacyErr } = await supabase.auth.verifyOtp({ token_hash: legacyToken, type })
        if (legacyErr) {
          logAuth('legacy-token-error', legacyErr)
          setError('El enlace expiró o ya fue usado. Pedí uno nuevo desde Ingresar.')
          setLoading(false)
          return
        }
        window.history.replaceState(null, '', window.location.pathname)
        setSessionReady(true); setLoading(false); return
      }

      // 5) Sesión ya activa (refresh de la página, o user logueado)
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        logAuth('existing-session', { provider: session.user?.app_metadata?.provider })
        if (isOAuthSession(session)) {
          navigate(resolveNextUrl(), { replace: true })
          return
        }
        setSessionReady(true); setLoading(false); return
      }

      // 6) Fallback: dejar a Supabase auto-detect (algunos flows hacen storage→event)
      logAuth('fallback-listener', null)
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (session && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION')) {
          logAuth('fallback-success', { event })
          setSessionReady(true); setLoading(false)
          subscription.unsubscribe()
        }
      })

      // 6s — algunos móviles lentos con red 3G tardan más que 3s
      setTimeout(() => {
        setLoading((prev) => {
          if (prev) {
            logAuth('timeout', null)
            setError('No detectamos una sesión válida. Si llegaste por un email, pedí un enlace nuevo desde Ingresar.')
            subscription.unsubscribe()
            return false
          }
          return prev
        })
      }, 6000)
    }

    detectSession()
  }, [])

  const handleSubmit = async () => {
    setError('')
    if (!password || !confirm) { setError('Completá ambos campos.'); return }
    // Validación robusta: mínimo 8 caracteres con al menos una letra y un número
    // (validatePassword también rechaza passwords comunes como "12345678")
    const { validatePassword } = await import('../../lib/validate')
    const v = validatePassword(password)
    if (!v.ok) { setError(v.msg); return }
    if (password !== confirm) { setError('Las contraseñas no coinciden.'); return }
    setSubmitting(true)
    const { data: updated, error: updateErr } = await supabase.auth.updateUser({ password })
    if (updateErr) {
      // Friendly translation de errores típicos
      const raw = String(updateErr.message || '').toLowerCase()
      const friendly =
        raw.includes('same') ? 'La contraseña nueva no puede ser igual a la actual.' :
        raw.includes('weak') ? 'La contraseña es muy débil. Probá una más segura.' :
        raw.includes('network') ? 'Sin conexión. Verificá tu internet e intentá de nuevo.' :
        raw.includes('session') || raw.includes('expired') ? 'Tu enlace de activación expiró. Pedí uno nuevo al administrador.' :
        updateErr.message
      setError(friendly)
      setSubmitting(false)
      return
    }
    // Si la invitación fue para OTRO sitio (metadata.invited_to_site), redirigimos alli.
    // Como el origen actual ya coincide con el site (el redirectTo nos trajo aca),
    // simplemente mandamos al dashboard.
    const siteMeta = updated?.user?.user_metadata?.invited_to_site
    const currentHost = window.location.hostname
    // El hub vive en anmahub.com (dominio propio) pero anma-hub.vercel.app
    // sigue siendo un alias válido — ambos cuentan como "ya estoy en el hub".
    const hubHosts = ['anmahub.com', 'www.anmahub.com', 'anma-hub.vercel.app']
    const hostHost = 'anma-host.vercel.app'
    if (siteMeta === 'hub' && !hubHosts.includes(currentHost) && currentHost !== 'localhost') {
      window.location.replace('https://anmahub.com/app/')
      return
    }
    if (siteMeta === 'host' && currentHost !== hostHost && currentHost !== 'localhost') {
      window.location.replace(`https://${hostHost}/`)
      return
    }
    navigate('/', { replace: true })
  }

  const handleKey = (e) => { if (e.key === 'Enter') handleSubmit() }

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.card} className="bv-card">
          <div style={styles.logo}>AN</div>
          <p style={styles.subtitle}>Verificando invitacion...</p>
          <div className="sk sk-kpi" style={{ height: 40, width: '100%' }} />
        </div>
      </div>
    )
  }

  if (!sessionReady) {
    return (
      <div style={styles.container}>
        <div style={styles.card} className="bv-card">
          <div style={styles.logo}>AN</div>
          <h1 style={styles.title} className="bv-title">Enlace no válido</h1>
          <p style={styles.subtitle}>{error}</p>
          <button
            onClick={async () => {
              // Limpieza NUCLEAR antes de volver a /login para garantizar que el próximo
              // intento empiece de cero — sin code_verifiers huérfanos, sin sesión zombi.
              try { await supabase.auth.signOut({ scope: 'local' }) } catch { /* noop */ }
              try {
                Object.keys(localStorage).forEach(k => {
                  if (k.startsWith('sb-') || k.startsWith('supabase.auth.')) {
                    try { localStorage.removeItem(k) } catch { /* noop */ }
                  }
                })
                Object.keys(sessionStorage).forEach(k => {
                  if (k.startsWith('sb-') || k.startsWith('supabase.auth.')) {
                    try { sessionStorage.removeItem(k) } catch { /* noop */ }
                  }
                })
              } catch { /* noop */ }
              window.location.replace('/login')
            }}
            style={{
              marginTop: 16, width: '100%', padding: '12px 18px',
              background: 'linear-gradient(135deg,#7C3AED,#059669)',
              color: '#fff', border: 'none', borderRadius: 10,
              fontSize: 14, fontWeight: 700, cursor: 'pointer',
              boxShadow: '0 6px 20px rgba(124,58,237,.35)',
            }}>
            <i className="fa fa-arrow-right-to-bracket" style={{ marginRight: 8 }} />
            Limpiar y volver a Ingresar
          </button>
          <button
            onClick={() => window.location.replace('/registro')}
            style={{
              marginTop: 8, width: '100%', padding: '10px 18px',
              background: 'transparent', color: 'rgba(255,255,255,.7)',
              border: '1px solid rgba(255,255,255,.15)', borderRadius: 10,
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>
            ¿No tenés cuenta? Registrate
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <style>{`
        @media(max-width:480px){
          .bv-card{padding:32px 20px 28px!important}
          .bv-title{font-size:20px!important}
          .f-inp{font-size:16px!important}  /* anti-zoom iOS Safari al hacer focus */
        }
      `}</style>
      <div style={styles.card} className="bv-card">
        <div style={styles.logo}>AN</div>
        <h1 style={styles.title} className="bv-title">
          {authFlow === 'recovery' ? 'Elegí tu nueva contraseña' : 'Bienvenido a ANMA'}
        </h1>
        <p style={styles.subtitle}>
          {authFlow === 'recovery'
            ? 'Tu cuenta ya está activa — solo definí una nueva contraseña.'
            : 'Elige tu contraseña para comenzar'}
        </p>

        {error && (
          <div style={styles.error}>
            <i className="fa fa-circle-exclamation" /> {error}
          </div>
        )}

        <div className="form-group fg" style={{ width: '100%' }}>
          <label className="f-lbl">Elegir Contraseña</label>
          <div className="f-wrap">
            <input
              type={showPwd ? 'text' : 'password'}
              className="f-inp"
              placeholder="Mínimo 8 caracteres · letra + número"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKey}
              autoComplete="new-password"
              style={{ paddingRight: 44 }}
            />
            <button className="eye-btn" type="button" onClick={() => setShowPwd(!showPwd)}>
              <i className={`fa ${showPwd ? 'fa-eye-slash' : 'fa-eye'}`} />
            </button>
          </div>
          {/* Indicador de fuerza */}
          {password && (() => {
            const score = passwordStrength(password)
            return (
              <div style={{ marginTop: 8 }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} style={{
                      flex: 1, height: 4, borderRadius: 99,
                      background: i <= score ? STRENGTH_COLORS[score] : 'rgba(255,255,255,.08)',
                      transition: 'background .2s',
                    }} />
                  ))}
                </div>
                <div style={{ marginTop: 6, fontSize: 11, color: STRENGTH_COLORS[score], fontWeight: 600, textAlign: 'right' }}>
                  {STRENGTH_LABELS[score] || ''}
                </div>
              </div>
            )
          })()}
        </div>

        <div className="form-group fg" style={{ width: '100%' }}>
          <label className="f-lbl">Confirmar Contraseña</label>
          <input
            type={showPwd ? 'text' : 'password'}
            className="f-inp"
            placeholder="Repeti la contraseña"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            onKeyDown={handleKey}
            autoComplete="new-password"
          />
        </div>

        <button
          className="btn-login"
          onClick={handleSubmit}
          disabled={submitting}
          style={{ width: '100%', marginTop: 8, opacity: submitting ? 0.6 : 1 }}
        >
          {submitting ? (
            <><i className="fa fa-spinner fa-spin" /> Configurando...</>
          ) : (
            <><i className="fa fa-rocket" /> Comenzar</>
          )}
        </button>
      </div>
    </div>
  )
}

const styles = {
  container: {
    position: 'fixed', inset: 0, zIndex: 9999,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a3e 50%, #0f0f23 100%)',
  },
  card: {
    background: 'var(--c-surface, #1e1e2e)',
    borderRadius: 16, padding: '48px 40px',
    width: '100%', maxWidth: 420,
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  logo: {
    width: 64, height: 64, borderRadius: 16,
    background: 'linear-gradient(135deg, #7C3AED, #059669)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 24, fontWeight: 800, color: '#fff', marginBottom: 24,
    letterSpacing: 2,
  },
  title: {
    margin: 0, fontSize: 24, fontWeight: 700,
    color: 'var(--c-text, #e2e8f0)',
  },
  subtitle: {
    margin: '8px 0 24px', fontSize: 14,
    color: 'var(--c-muted, #94a3b8)', textAlign: 'center',
  },
  error: {
    width: '100%', padding: '10px 14px', marginBottom: 16,
    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: 8, color: '#f87171', fontSize: 13,
    display: 'flex', alignItems: 'center', gap: 8,
  },
}

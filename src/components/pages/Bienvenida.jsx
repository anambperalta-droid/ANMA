import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

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
  const finishAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (isOAuthSession(session)) {
      // OAuth user: no password setup needed. Vamos directo al app (router
      // decidirá si va a /onboarding o /).
      navigate('/', { replace: true })
      return true
    }
    return false
  }

  useEffect(() => {
    async function detectSession() {
      // 1) PKCE flow: ?code= in query params (Google OAuth + invitation token PKCE)
      const url = new URL(window.location.href)
      const code = url.searchParams.get('code')
      if (code) {
        const { error: codeErr } = await supabase.auth.exchangeCodeForSession(code)
        if (codeErr) {
          setError('El enlace expiró o es inválido. Volvé a /login para reintentar.')
          setLoading(false)
          return
        }
        window.history.replaceState(null, '', window.location.pathname)
        // Si es Google → al app directo. Si es invitación → form contraseña.
        if (await finishAuth()) return
        setSessionReady(true)
        setLoading(false)
        return
      }

      // 2) Implicit flow: #access_token= in hash (legacy OAuth)
      const hash = window.location.hash
      if (hash && hash.includes('access_token')) {
        const params = new URLSearchParams(hash.substring(1))
        const accessToken = params.get('access_token')
        const refreshToken = params.get('refresh_token')
        if (accessToken && refreshToken) {
          const { error: sessErr } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          if (sessErr) {
            setError('El enlace expiró o es inválido. Volvé a /login para reintentar.')
            setLoading(false)
            return
          }
          window.history.replaceState(null, '', window.location.pathname)
          if (await finishAuth()) return   // OAuth → directo al app
          setSessionReady(true)
          setLoading(false)
          return
        }
      }

      // 3) Token hash flow (email OTP / invitation): ?token_hash=&type=
      const tokenHash = url.searchParams.get('token_hash')
      const type = url.searchParams.get('type')
      if (tokenHash && type) {
        const { error: otpErr } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: type,
        })
        if (otpErr) {
          setError('El enlace expiró o es inválido. Solicitá uno nuevo.')
          setLoading(false)
          return
        }
        window.history.replaceState(null, '', window.location.pathname)
        // Aquí es típicamente invitación por email → muestra form contraseña.
        setSessionReady(true)
        setLoading(false)
        return
      }

      // 4) Ya hay sesión (refresh de la página, o el user volvió logueado)
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        if (isOAuthSession(session)) {
          // Usuario Google que vuelve a /bienvenida con sesión activa → al app
          navigate('/', { replace: true })
          return
        }
        setSessionReady(true)
        setLoading(false)
        return
      }

      // 5) Let Supabase auto-detect from URL (fallback)
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (session && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION')) {
          setSessionReady(true)
          setLoading(false)
          subscription.unsubscribe()
        }
      })

      // Timeout: if nothing detected in 3s, show error
      setTimeout(() => {
        setLoading((prev) => {
          if (prev) {
            setError('No se detecto una invitacion valida. Solicita un nuevo enlace al administrador.')
            subscription.unsubscribe()
            return false
          }
          return prev
        })
      }, 3000)
    }

    detectSession()
  }, [])

  const handleSubmit = async () => {
    setError('')
    if (!password || !confirm) { setError('Completa ambos campos.'); return }
    if (password.length < 6) { setError('Minimo 6 caracteres.'); return }
    if (password !== confirm) { setError('Las contraseñas no coinciden.'); return }
    setSubmitting(true)
    const { data: updated, error: updateErr } = await supabase.auth.updateUser({ password })
    if (updateErr) {
      setError(updateErr.message)
      setSubmitting(false)
      return
    }
    // Si la invitación fue para OTRO sitio (metadata.invited_to_site), redirigimos alli.
    // Como el origen actual ya coincide con el site (el redirectTo nos trajo aca),
    // simplemente mandamos al dashboard.
    const siteMeta = updated?.user?.user_metadata?.invited_to_site
    const currentHost = window.location.hostname
    const hubHost = 'anma-hub.vercel.app'
    const hostHost = 'anma-host.vercel.app'
    if (siteMeta === 'hub' && currentHost !== hubHost && currentHost !== 'localhost') {
      window.location.replace(`https://${hubHost}/`)
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
            onClick={() => window.location.replace('/login')}
            style={{
              marginTop: 16, width: '100%', padding: '12px 18px',
              background: 'linear-gradient(135deg,#7C3AED,#059669)',
              color: '#fff', border: 'none', borderRadius: 10,
              fontSize: 14, fontWeight: 700, cursor: 'pointer',
              boxShadow: '0 6px 20px rgba(124,58,237,.35)',
            }}>
            <i className="fa fa-arrow-right-to-bracket" style={{ marginRight: 8 }} />
            Volver a Ingresar
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
        }
      `}</style>
      <div style={styles.card} className="bv-card">
        <div style={styles.logo}>AN</div>
        <h1 style={styles.title} className="bv-title">Bienvenido a ANMA</h1>
        <p style={styles.subtitle}>Elige tu contraseña para comenzar</p>

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
              placeholder="Minimo 6 caracteres"
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

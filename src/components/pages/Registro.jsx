/* ─────────────────────────────────────────
   ANMA Hub — Vista de Registro /registro
   Google OAuth (prioridad) + Email/Password
   Trial 7 días, acceso inmediato sin mail de confirmación
   (requiere "Confirm email" desactivado en Supabase → Auth > Settings)
───────────────────────────────────────── */
import { useState, useEffect, useRef } from 'react'
import { Navigate, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { injectSeedData } from '../../lib/seedData'
import { getAcquisitionData, persistAcquisitionAcrossOAuth, clearAcquisitionData } from '../../lib/acquisitionTracking'

// Google Identity Services — bypassa OAuth-redirect (que tenía bad_oauth_state
// con múltiples apps usando el mismo Supabase project + cookie partitioning).
const GOOGLE_CLIENT_ID = '102631288658-3u7abhbutcmri2t9m89fbsbis7j6m8ud.apps.googleusercontent.com'
function loadGIS() {
  return new Promise((resolve, reject) => {
    const waitForApi = () => new Promise((res, rej) => {
      const start = Date.now()
      const tick = () => {
        if (window.google?.accounts?.id) return res()
        if (Date.now() - start > 8000) return rej(new Error('GIS API not available after 8s'))
        setTimeout(tick, 50)
      }
      tick()
    })

    if (window.google?.accounts?.id) return resolve()
    const existing = document.querySelector('script[data-gis]')
    if (existing) {
      waitForApi().then(resolve).catch(reject)
      return
    }
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true; s.defer = true
    s.dataset.gis = '1'
    s.onload = () => waitForApi().then(resolve).catch(reject)
    s.onerror = () => reject(new Error('GIS script load failed (CSP o red bloqueada)'))
    document.head.appendChild(s)
  })
}

// Mobile + in-app browsers usan redirect (GIS popup falla en esos entornos)
function shouldUseRedirectFlow() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  const isInApp = /FBAN|FBAV|Instagram|Line\/|MicroMessenger|GSA\/|Pinterest|TikTok|WhatsApp/i.test(ua)
  const isMobile = /Android|iPhone|iPad|iPod/i.test(ua)
  return isInApp || isMobile
}
function clearStaleOAuthState() {
  try {
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith('sb-') && (k.includes('auth-token-code-verifier') || k.includes('-flow-state'))) {
        try { localStorage.removeItem(k) } catch { /* noop */ }
      }
    })
  } catch { /* noop */ }
}

// Monograma ANMA Hub: "A" completa de trazo continuo + bucle abierto
// enganchado en la pierna derecha (hub). Mismo diseño que favicon.svg, en blanco.
const AnmaLogo = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="38" height="38" viewBox="0 0 64 64" fill="none">
    <path d="M14 52 L30 13 Q32 8.5 34 13 L50 52" stroke="#fff" strokeWidth="5.6" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M35.3 45.5 A9.6 9.6 0 1 1 41 39.8" stroke="#fff" strokeWidth="5.6" strokeLinecap="round"/>
  </svg>
)

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 48 48" fill="none">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.35-8.16 2.35-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
  </svg>
)

function friendlyError(raw) {
  if (!raw) return ''
  const m = String(raw).toLowerCase()
  if (m.includes('already registered') || m.includes('already exists')) return 'Ya existe una cuenta con este email.'
  if (m.includes('password') && m.includes('characters')) return 'La contraseña debe tener al menos 8 caracteres.'
  if (m.includes('invalid email') || m.includes('valid email')) return 'El formato del email no es válido.'
  if (m.includes('network') || m.includes('failed to fetch')) return 'Sin conexión. Verificá tu internet.'
  return raw
}

const CSS = `
  @keyframes rg-in { from{opacity:0;transform:translateY(20px) scale(.97)} to{opacity:1;transform:none} }
  @keyframes rg-orb-a { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-28px,20px)} }
  @keyframes rg-orb-b { 0%,100%{transform:translate(0,0)} 50%{transform:translate(24px,-18px)} }

  .rg-wrap { position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;
    padding:20px;font-family:'Inter',system-ui,sans-serif;overflow-y:auto;
    background:radial-gradient(1200px 800px at 20% 10%,#3b1078 0%,transparent 60%),
               radial-gradient(900px 700px at 80% 90%,#0f7a55 0%,transparent 55%),
               linear-gradient(135deg,#0e0524 0%,#1a0636 35%,#2d0a57 70%,#1a1233 100%); }

  .rg-orb { position:absolute;border-radius:50%;pointer-events:none;filter:blur(40px) }
  .rg-orb1 { width:500px;height:500px;top:-150px;right:-130px;background:radial-gradient(circle,rgba(124,58,237,.4),transparent 70%);animation:rg-orb-a 16s ease-in-out infinite }
  .rg-orb2 { width:360px;height:360px;bottom:-100px;left:-80px;background:radial-gradient(circle,rgba(5,150,105,.3),transparent 70%);animation:rg-orb-b 20s ease-in-out infinite }
  @media(prefers-reduced-motion:reduce){.rg-orb1,.rg-orb2{animation:none}}

  .rg-card { position:relative;z-index:1;width:100%;max-width:460px;
    background:rgba(255,255,255,.065);backdrop-filter:blur(28px) saturate(180%);
    -webkit-backdrop-filter:blur(28px) saturate(180%);
    border:1px solid rgba(255,255,255,.12);border-radius:24px;padding:36px 34px 32px;
    box-shadow:0 24px 80px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.08);
    animation:rg-in .55s cubic-bezier(.2,.7,.2,1) both; }

  .rg-brand { display:flex;align-items:center;gap:12px;margin-bottom:26px }
  .rg-logo { width:46px;height:46px;border-radius:13px;background:linear-gradient(135deg,#7c3aed,#a855f7,#ec4899);
    display:flex;align-items:center;justify-content:center;box-shadow:0 8px 24px rgba(124,58,237,.4);flex-shrink:0 }
  .rg-brand-name { font-size:20px;font-weight:900;color:#fff;letter-spacing:-.5px;line-height:1 }
  .rg-brand-tag  { font-size:11px;color:rgba(255,255,255,.45);margin-top:3px }

  .rg-h { font-size:23px;font-weight:800;color:#fff;letter-spacing:-.45px;line-height:1.2;margin-bottom:4px }
  .rg-h em { font-style:normal;background:linear-gradient(90deg,#a78bfa,#34d399);-webkit-background-clip:text;background-clip:text;color:transparent }
  .rg-sub { font-size:13px;color:rgba(255,255,255,.52);margin-bottom:24px;line-height:1.55 }

  /* Google button */
  .rg-google { display:flex;align-items:center;justify-content:center;gap:12px;width:100%;
    padding:14px;background:#fff;color:#1f1f1f;border:none;border-radius:13px;
    font-size:14.5px;font-weight:700;cursor:pointer;font-family:inherit;
    box-shadow:0 4px 20px rgba(0,0,0,.3);transition:transform .15s,box-shadow .2s }
  .rg-google:hover { transform:translateY(-2px);box-shadow:0 8px 28px rgba(0,0,0,.4) }
  .rg-google:disabled { opacity:.6;cursor:not-allowed;transform:none }

  .rg-sep { display:flex;align-items:center;gap:10px;margin:20px 0 18px;
    font-size:10.5px;color:rgba(255,255,255,.35);text-transform:uppercase;letter-spacing:1.2px;font-weight:600 }
  .rg-sep::before,.rg-sep::after { content:'';flex:1;height:1px;background:rgba(255,255,255,.1) }

  .rg-fg { margin-bottom:14px }
  .rg-lbl { display:block;font-size:10.5px;font-weight:700;color:rgba(255,255,255,.68);margin-bottom:7px;letter-spacing:.7px;text-transform:uppercase }
  .rg-inp { width:100%;padding:13px 15px;box-sizing:border-box;
    background:rgba(255,255,255,.07);border:1.5px solid rgba(255,255,255,.12);border-radius:12px;
    font-size:14px;color:#fff;outline:none;font-family:'Inter',sans-serif;
    transition:border-color .2s,background .2s,box-shadow .2s }
  .rg-inp::placeholder { color:rgba(255,255,255,.28) }
  .rg-inp:focus { border-color:rgba(167,139,250,.65);background:rgba(255,255,255,.1);box-shadow:0 0 0 4px rgba(167,139,250,.12) }

  .rg-pw-wrap { position:relative }
  .rg-eye { position:absolute;right:12px;top:50%;transform:translateY(-50%);
    background:none;border:none;color:rgba(255,255,255,.4);font-size:13px;padding:6px;cursor:pointer }
  .rg-eye:hover { color:rgba(255,255,255,.8) }

  .rg-err { background:rgba(220,38,38,.12);border:1.5px solid rgba(252,165,165,.38);border-radius:11px;
    color:#fca5a5;font-size:12px;padding:10px 13px;margin-bottom:14px;display:flex;align-items:flex-start;gap:8px;line-height:1.5 }
  .rg-err i { flex-shrink:0;margin-top:1px }

  .rg-btn { width:100%;padding:14px;margin-top:4px;
    background:linear-gradient(135deg,#059669,#10b981);color:#fff;border:none;border-radius:12px;
    font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;
    box-shadow:0 8px 24px rgba(5,150,105,.38),inset 0 1px 0 rgba(255,255,255,.16);
    transition:transform .15s,box-shadow .2s;display:flex;align-items:center;justify-content:center;gap:8px }
  .rg-btn:hover:not(:disabled) { transform:translateY(-2px);box-shadow:0 12px 30px rgba(5,150,105,.5) }
  .rg-btn:disabled { opacity:.6;cursor:not-allowed }

  .rg-micro { text-align:center;font-size:11px;color:rgba(255,255,255,.36);margin-top:10px;letter-spacing:.2px }
  .rg-micro i { color:#10b981;margin-right:4px }

  .rg-already { display:flex;align-items:center;justify-content:center;gap:6px;margin-top:20px;
    padding:11px;border:1.5px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);border-radius:11px;
    color:rgba(255,255,255,.7);font-size:12.5px;font-weight:600;text-decoration:none;
    transition:background .2s,border-color .2s }
  .rg-already:hover { background:rgba(255,255,255,.09);border-color:rgba(255,255,255,.24) }

  .rg-foot { margin-top:20px;display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:10px;
    font-size:10.5px;color:rgba(255,255,255,.3) }
  .rg-foot i { color:#10b981 }
  .rg-dot { width:3px;height:3px;border-radius:50%;background:rgba(255,255,255,.2) }

  /* Pantalla de email confirmación */
  .rg-done { text-align:center;padding:8px 0 }
  .rg-done-icon { font-size:54px;color:#10b981;display:block;margin-bottom:16px }
  .rg-done h3 { font-size:21px;font-weight:800;color:#fff;margin:0 0 10px;letter-spacing:-.3px }
  .rg-done p { font-size:13.5px;color:rgba(255,255,255,.62);margin:0 0 20px;line-height:1.65 }
  .rg-done em { color:#a78bfa;font-style:normal;font-weight:700 }
  .rg-done-note { background:rgba(167,139,250,.08);border:1px solid rgba(167,139,250,.2);border-radius:12px;
    padding:12px 16px;font-size:12px;color:rgba(255,255,255,.5);line-height:1.6;margin-bottom:20px }

  @media(max-width:480px){
    .rg-card { padding:28px 20px 26px;border-radius:20px }
    .rg-h { font-size:20px }
    .rg-inp,.rg-google { font-size:16px!important }
  }
`

export default function Registro() {
  const { authed } = useAuth()
  const navigate   = useNavigate()

  // First-touch attribution: capturamos UTM + referrer al montar el form
  // y los enviamos en signUp. Si el user vino de Instagram bio, después
  // navegó por /demo, /landing y aterrizó en /registro, sigue siendo IG.
  useEffect(() => { getAcquisitionData() }, [])

  const [biz,      setBiz]      = useState('')
  const [email,    setEmail]    = useState('')
  const [pass,     setPass]     = useState('')
  const [showPwd,  setShowPwd]  = useState(false)
  const [err,      setErr]      = useState('')
  const [loading,  setLoading]  = useState(false)   // email submit
  const [googleBusy, setGoogleBusy] = useState(false)
  const [googleReady, setGoogleReady] = useState(false)
  const [emailSent, setEmailSent]   = useState(false)
  const googleBtnRef = useRef(null)
  const preferRedirect = useRef(shouldUseRedirectFlow()).current

  // Fallback / mobile: redirect tradicional con limpieza de state stale
  const handleRedirectGoogle = async () => {
    setGoogleBusy(true); setErr('')
    try { persistAcquisitionAcrossOAuth() } catch { /* noop */ }
    clearStaleOAuthState()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/bienvenida`,
        queryParams: { access_type: 'offline', prompt: 'select_account' },
      },
    })
    if (error) {
      setErr('No se pudo iniciar: ' + error.message)
      setGoogleBusy(false)
    }
  }

  // GIS init (solo desktop)
  useEffect(() => {
    if (authed || preferRedirect) return
    let mounted = true
    let timeoutId
    loadGIS().then(() => {
      if (!mounted || !window.google?.accounts?.id || !googleBtnRef.current) return
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        ux_mode: 'popup',
        auto_select: false,
        callback: async (response) => {
          if (timeoutId) clearTimeout(timeoutId)
          if (!response?.credential) {
            setErr('No recibimos confirmación de Google. Probá el método alternativo abajo.')
            setGoogleBusy(false)
            return
          }
          setGoogleBusy(true); setErr('')
          try { persistAcquisitionAcrossOAuth() } catch { /* noop */ }
          const { error } = await supabase.auth.signInWithIdToken({
            provider: 'google',
            token: response.credential,
          })
          if (error) {
            setErr('No pudimos registrarte: ' + error.message)
            setGoogleBusy(false)
            return
          }
        },
      })
      const btnWrapper = document.createElement('div')
      googleBtnRef.current.appendChild(btnWrapper)
      btnWrapper.addEventListener('click', () => {
        setGoogleBusy(true); setErr('')
        if (timeoutId) clearTimeout(timeoutId)
        timeoutId = setTimeout(() => {
          setGoogleBusy(false)
          setErr('Google no respondió. Probá el método alternativo de abajo.')
        }, 30000)
      }, true)
      window.google.accounts.id.renderButton(btnWrapper, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'signup_with',
        shape: 'rectangular',
        logo_alignment: 'left',
        width: 320,
      })
      if (mounted) setGoogleReady(true)
    }).catch(e => {
      console.error('[anma-auth] GIS load error', e)
      if (mounted) setErr('No se pudo cargar Google. Probá el método alternativo abajo o usá tu email.')
    })
    return () => { mounted = false; if (timeoutId) clearTimeout(timeoutId) }
  }, [authed, preferRedirect])

  if (authed) return <Navigate to="/" replace />

  /* ── Email + Password ── */
  const handleEmail = async (e) => {
    e?.preventDefault()
    setErr('')

    const cleanBiz   = biz.trim()
    const cleanEmail = email.trim()
    if (!cleanBiz)             { setErr('Ingresá el nombre de tu empresa.'); return }
    if (!cleanEmail)           { setErr('Ingresá tu email.'); return }

    // Validación robusta de email + password
    const { validateEmail, validatePassword } = await import('../../lib/validate')
    const ev = validateEmail(cleanEmail)
    if (!ev.ok) { setErr(ev.msg); return }
    const pv = validatePassword(pass)
    if (!pv.ok) { setErr(pv.msg); return }

    setLoading(true)

    const trialStart = new Date().toISOString()
    const acq = getAcquisitionData() || {}

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password: pass,
      options: {
        data: {
          business_name:    cleanBiz,
          trial_started_at: trialStart,
          is_trial:         true,
          allowed_sites:    ['hub'],
          // Acquisition tracking — el trigger SQL los copia al workspace.
          acquisition_channel: acq.acquisition_channel || null,
          acquisition_source:  acq.acquisition_source  || null,
          utm_medium:          acq.utm_medium          || null,
          utm_campaign:        acq.utm_campaign        || null,
          utm_content:         acq.utm_content         || null,
          referrer:            acq.referrer            || null,
          landing_page:        acq.landing_page        || null,
        },
        emailRedirectTo: `${window.location.origin}/bienvenida`,
      },
    })

    if (error) {
      setErr(friendlyError(error.message))
      setLoading(false)
      return
    }

    if (data?.session?.user) {
      injectSeedData(data.session.user.id, cleanBiz)
      clearAcquisitionData()   // limpiar después del signUp exitoso
      navigate('/', { replace: true })
    } else {
      clearAcquisitionData()
      setEmailSent(true)
    }

    setLoading(false)
  }

  const handleKey = (e) => { if (e.key === 'Enter') handleEmail() }

  /* ── Pantalla post-registro (email confirmation ON) ── */
  if (emailSent) return (
    <>
      <style>{CSS}</style>
      <div className="rg-wrap">
        <div className="rg-orb rg-orb1" /><div className="rg-orb rg-orb2" />
        <div className="rg-card">
          <div className="rg-done">
            <i className="fa fa-circle-check rg-done-icon" />
            <h3>¡Ya casi estás adentro!</h3>
            <p>Enviamos un enlace de activación a <em>{email}</em>. Hacé clic en el email para activar tu cuenta.</p>
            <div className="rg-done-note">
              <i className="fa fa-inbox" style={{ color:'#a78bfa', marginRight:6 }} />
              Revisá también la carpeta de spam si no aparece en los próximos minutos.
            </div>
            <Link to="/login" className="rg-already" style={{ justifyContent:'center', marginTop:0 }}>
              <i className="fa fa-arrow-right-to-bracket" style={{ fontSize:13 }} />
              Ya confirmé mi email — Ingresar
            </Link>
          </div>
        </div>
      </div>
    </>
  )

  /* ── Formulario principal ── */
  return (
    <>
      <style>{CSS}</style>
      <div className="rg-wrap">
        <div className="rg-orb rg-orb1" /><div className="rg-orb rg-orb2" />

        <div className="rg-card">

          {/* Brand */}
          <div className="rg-brand">
            <div className="rg-logo"><AnmaLogo /></div>
            <div>
              <div className="rg-brand-name">ANMA Hub</div>
              <div className="rg-brand-tag">7 días gratis · Sin tarjeta</div>
            </div>
          </div>

          <div className="rg-h">Empezá <em>gratis hoy</em></div>
          <div className="rg-sub">Registro en 30 segundos. Sin tarjeta de crédito.</div>

          {/* Google login: mobile → redirect botón propio. Desktop → GIS popup + fallback */}
          {preferRedirect ? (
            <button className="rg-google" onClick={handleRedirectGoogle} disabled={googleBusy || loading} type="button">
              {googleBusy
                ? <><i className="fa fa-spinner fa-spin" style={{ fontSize:16 }} /> Conectando con Google...</>
                : <><GoogleIcon /> Registrarse con Google</>}
            </button>
          ) : (
            <>
              <div style={{ display:'flex', justifyContent:'center', alignItems:'center', minHeight:48 }}>
                {googleBusy ? (
                  <div style={{ color:'#fff', fontSize:14, fontWeight:600, display:'flex', alignItems:'center', gap:8 }}>
                    <i className="fa fa-spinner fa-spin" /> Creando tu cuenta...
                  </div>
                ) : !googleReady ? (
                  <div style={{ color:'rgba(255,255,255,.5)', fontSize:13, display:'flex', alignItems:'center', gap:8 }}>
                    <i className="fa fa-spinner fa-spin" /> Cargando Google...
                  </div>
                ) : null}
                <div ref={googleBtnRef} style={{ display: (googleReady && !googleBusy) ? 'block' : 'none' }} />
              </div>
              {googleReady && !googleBusy && (
                <div style={{ textAlign:'center', marginTop:8, marginBottom:6 }}>
                  <button type="button" onClick={handleRedirectGoogle}
                    style={{ background:'none', border:'none', color:'rgba(255,255,255,.55)', fontSize:11.5, cursor:'pointer', textDecoration:'underline', textUnderlineOffset:3, fontFamily:'inherit' }}>
                    ¿No funciona el popup? Probar método alternativo →
                  </button>
                </div>
              )}
            </>
          )}

          <div className="rg-sep">o completá tus datos</div>

          {/* Formulario email */}
          <form onSubmit={handleEmail}>

            {err && (
              <div className="rg-err">
                <i className="fa fa-circle-exclamation" />
                <span>
                  {err}
                  {err.includes('Ya existe') && (
                    <> <Link to="/login" style={{ color:'#c4b5fd', fontWeight:700 }}>Ingresar →</Link></>
                  )}
                </span>
              </div>
            )}

            <div className="rg-fg">
              <label className="rg-lbl">Nombre de tu empresa</label>
              <input
                type="text"
                className="rg-inp"
                placeholder="Ej: Distribuidora López"
                value={biz}
                onChange={e => setBiz(e.target.value)}
                onKeyDown={handleKey}
                autoFocus
                autoComplete="organization"
              />
            </div>

            <div className="rg-fg">
              <label className="rg-lbl">Correo electrónico</label>
              <input
                type="email"
                className="rg-inp"
                placeholder="tu@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={handleKey}
                autoComplete="email"
              />
            </div>

            <div className="rg-fg">
              <label className="rg-lbl">Contraseña</label>
              <div className="rg-pw-wrap">
                <input
                  type={showPwd ? 'text' : 'password'}
                  className="rg-inp"
                  placeholder="Mínimo 8 caracteres · letra + número"
                  value={pass}
                  onChange={e => setPass(e.target.value)}
                  onKeyDown={handleKey}
                  autoComplete="new-password"
                  style={{ paddingRight: 42 }}
                />
                <button className="rg-eye" type="button" onClick={() => setShowPwd(!showPwd)}>
                  <i className={`fa ${showPwd ? 'fa-eye-slash' : 'fa-eye'}`} />
                </button>
              </div>
            </div>

            <button type="submit" className="rg-btn" disabled={loading || googleBusy}>
              {loading
                ? <><i className="fa fa-spinner fa-spin" /> Creando cuenta...</>
                : <><i className="fa fa-rocket" /> Probar gratis por 7 días</>}
            </button>

            <p className="rg-micro">
              <i className="fa fa-lock" />Sin tarjetas de crédito. Cancelás cuando quieras.
            </p>
            <p className="rg-micro" style={{ marginTop:6, lineHeight:1.55 }}>
              Al registrarte aceptás los{' '}
              <a href="/terminos" target="_blank" rel="noopener" style={{ color:'#a78bfa', textDecoration:'underline' }}>Términos</a>
              {' '}y la{' '}
              <a href="/privacidad" target="_blank" rel="noopener" style={{ color:'#a78bfa', textDecoration:'underline' }}>Política de Privacidad</a>.
            </p>
          </form>

          <Link to="/login" className="rg-already">
            <i className="fa fa-arrow-right-to-bracket" style={{ fontSize:13 }} />
            ¿Ya tenés cuenta? Ingresar
            <i className="fa fa-arrow-right" style={{ fontSize:11 }} />
          </Link>

          <div className="rg-foot">
            <span><i className="fa fa-shield-halved" /> Encriptación E2E</span>
            <span className="rg-dot" />
            <span><i className="fa fa-database" /> Backups diarios</span>
            <span className="rg-dot" />
            <span><i className="fa fa-flag" /> Hecho en AR</span>
          </div>
        </div>
      </div>
    </>
  )
}

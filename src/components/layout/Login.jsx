import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { persistAcquisitionAcrossOAuth } from '../../lib/acquisitionTracking'
import InstallButton from './InstallButton'

const APP_VERSION = 'v1.4'
const APP_YEAR = new Date().getFullYear()
const LS_EMAIL_KEY = 'anma_last_email'
const LS_LAST_LOGIN = 'anma_last_login'

// Limpieza NUCLEAR del estado OAuth/Supabase en localStorage + sessionStorage.
// Evita los 3 errores típicos: bad_oauth_state, verifier huérfano, sesiones zombi
// que generan "link inválido" después de múltiples intentos.
function nukeStaleAuthState() {
  try {
    // localStorage: borrar todas las claves sb-* (tokens, verifiers, flow state)
    const lsKeys = Object.keys(localStorage)
    lsKeys.forEach(k => {
      if (k.startsWith('sb-') || k.startsWith('supabase.auth.')) {
        try { localStorage.removeItem(k) } catch { /* noop */ }
      }
    })
    // sessionStorage: lo mismo (algunas versiones lo usan también)
    const ssKeys = Object.keys(sessionStorage)
    ssKeys.forEach(k => {
      if (k.startsWith('sb-') || k.startsWith('supabase.auth.')) {
        try { sessionStorage.removeItem(k) } catch { /* noop */ }
      }
    })
  } catch { /* noop */ }
}

// Antes de iniciar un nuevo flujo OAuth, signOut explícito para matar cualquier
// sesión a medio iniciar que pueda colisionar con el callback.
async function preFlightAuthReset() {
  try { await supabase.auth.signOut({ scope: 'local' }) } catch { /* noop */ }
  nukeStaleAuthState()
}

function friendlyAuthError(raw, email) {
  if (!raw) return ''
  const m = String(raw).toLowerCase()
  // Hint Google: si el email es @gmail y las credenciales son inválidas, probablemente
  // se registró con Google y no tiene password. Sugerimos el botón de arriba.
  if ((m.includes('invalid login') || m.includes('invalid credentials')) && /@(gmail|googlemail)\./i.test(email || '')) {
    return '¿Te registraste con Google? Probá el botón "Continuar con Google" de arriba — tu cuenta no tiene contraseña.'
  }
  if (m.includes('invalid login') || m.includes('invalid credentials')) return 'Email o contraseña incorrectos. Si te registraste con Google, usá el botón de arriba.'
  if (m.includes('email not confirmed')) return 'Tu email aún no está confirmado. Revisá tu bandeja.'
  if (m.includes('too many') || m.includes('rate')) return 'Demasiados intentos. Esperá unos minutos y volvé a probar.'
  if (m.includes('network') || m.includes('failed to fetch')) return 'Sin conexión. Revisá tu internet e intentá de nuevo.'
  if (m.includes('user not found')) return 'No encontramos una cuenta con ese email.'
  return raw
}

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" fill="none">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.35-8.16 2.35-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
  </svg>
)

function greeting() {
  const h = new Date().getHours()
  if (h < 6) return 'Trabajando tarde'
  if (h < 13) return 'Buen día'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

function relativeDays(iso) {
  if (!iso) return null
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (days < 1) return 'hoy'
  if (days < 2) return 'ayer'
  if (days < 7) return `hace ${days} días`
  if (days < 30) return `hace ${Math.floor(days / 7)} sem.`
  return `hace ${Math.floor(days / 30)} m.`
}

export default function Login() {
  const [email, setEmail] = useState(() => {
    try { return localStorage.getItem(LS_EMAIL_KEY) || '' } catch { return '' }
  })
  const [pass, setPass] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [err, setErr] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)
  const [capsOn, setCapsOn] = useState(false)
  const { login, resetPassword } = useAuth()

  // ── Google login (redirect tradicional — funciona en TODOS los dispositivos) ──
  // Reset NUCLEAR antes de cada intento: signOut + borra todo sb-* de localStorage/sessionStorage.
  // Esto evita "link inválido" y bad_oauth_state después de múltiples intentos fallidos.
  const handleGoogle = async () => {
    setGoogleBusy(true); setErr('')
    try { persistAcquisitionAcrossOAuth() } catch { /* noop */ }
    // Preservar ?next= a través del roundtrip de OAuth — sino se pierde y volvemos a /
    let nextUrl = null
    try {
      const p = new URLSearchParams(window.location.search)
      const n = p.get('next')
      if (n && n.startsWith('/') && !n.startsWith('//')) {
        nextUrl = n
        localStorage.setItem('anma_post_auth_next', n)
      }
    } catch { /* noop */ }
    await preFlightAuthReset()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/app/bienvenida${nextUrl ? '?next=' + encodeURIComponent(nextUrl) : ''}`,
        queryParams: { access_type: 'offline', prompt: 'select_account' },
      },
    })
    if (error) {
      setErr('No se pudo iniciar Google: ' + error.message)
      setGoogleBusy(false)
    }
  }

  // Botón visible "Limpiar y reintentar" para usuarios que vienen rebotando.
  const handleHardReset = async () => {
    setErr('')
    await preFlightAuthReset()
    // Vaciamos también localStorage propio de ANMA por si quedaron flags raros
    try {
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith('anma_acquisition_') || k === 'anma_oauth_pending') {
          try { localStorage.removeItem(k) } catch { /* noop */ }
        }
      })
    } catch { /* noop */ }
    setErr('Limpieza completa ✓ Ahora probá Continuar con Google.')
    setTimeout(() => setErr(''), 4000)
  }

  const lastLogin = (() => { try { return localStorage.getItem(LS_LAST_LOGIN) } catch { return null } })()
  const lastLoginRel = relativeDays(lastLogin)

  useEffect(() => {
    try { if (email && email.includes('@')) localStorage.setItem(LS_EMAIL_KEY, email) } catch { /* ignorar */ }
  }, [email])

  const [forgotModal, setForgotModal] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetSending, setResetSending] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [resetErr, setResetErr] = useState('')

  const handleLogin = async () => {
    if (!email || !pass) { setErr('Completá email y contraseña para continuar.'); return }
    // Validación de formato de email antes de pegar al server (mejor UX)
    const { validateEmail } = await import('../../lib/validate')
    const ev = validateEmail(email)
    if (!ev.ok) { setErr(ev.msg); return }
    setSubmitting(true); setErr('')
    const result = await login(email, pass)
    if (result) { setErr(friendlyAuthError(result, email)); setSubmitting(false); return }
    try { localStorage.setItem(LS_LAST_LOGIN, new Date().toISOString()) } catch { /* ignorar */ }
  }

  const handleKey = (e) => {
    if (typeof e.getModifierState === 'function') setCapsOn(e.getModifierState('CapsLock'))
    if (e.key === 'Enter') handleLogin()
  }

  const openForgot = () => { setResetEmail(email); setResetSent(false); setResetErr(''); setForgotModal(true) }

  // Rate limiting client-side para password reset (defensa en profundidad — el server también limita).
  // Cooldown 60s entre requests. Bloqueo de 5 min después de 3 intentos.
  const RESET_RL_KEY = 'anma_reset_rl'
  const checkResetRateLimit = () => {
    try {
      const raw = localStorage.getItem(RESET_RL_KEY)
      const data = raw ? JSON.parse(raw) : { attempts: [], blockedUntil: 0 }
      const now = Date.now()
      if (data.blockedUntil && data.blockedUntil > now) {
        const mins = Math.ceil((data.blockedUntil - now) / 60000)
        return { ok: false, msg: `Demasiados intentos. Esperá ${mins} min${mins !== 1 ? 's' : ''} antes de volver a probar.` }
      }
      // Limpiar intentos viejos (>5min)
      data.attempts = (data.attempts || []).filter(t => now - t < 5 * 60000)
      const last = data.attempts[data.attempts.length - 1]
      if (last && now - last < 60000) {
        const secs = Math.ceil((60000 - (now - last)) / 1000)
        return { ok: false, msg: `Esperá ${secs}s antes de pedir otro enlace.` }
      }
      return { ok: true, data }
    } catch {
      return { ok: true, data: { attempts: [], blockedUntil: 0 } }
    }
  }
  const recordResetAttempt = () => {
    try {
      const raw = localStorage.getItem(RESET_RL_KEY)
      const data = raw ? JSON.parse(raw) : { attempts: [], blockedUntil: 0 }
      const now = Date.now()
      data.attempts = [...(data.attempts || []).filter(t => now - t < 5 * 60000), now]
      // 3+ intentos en 5min → bloquear 5min
      if (data.attempts.length >= 3) {
        data.blockedUntil = now + 5 * 60000
        data.attempts = []
      }
      localStorage.setItem(RESET_RL_KEY, JSON.stringify(data))
    } catch { /* ignorar */ }
  }

  const handleReset = async () => {
    if (!resetEmail) { setResetErr('Ingresá tu email.'); return }
    // Validar formato antes de pegarle al servidor
    const { validateEmail } = await import('../../lib/validate')
    const ve = validateEmail(resetEmail)
    if (!ve.ok) { setResetErr(ve.msg); return }
    // Chequear rate limit
    const rl = checkResetRateLimit()
    if (!rl.ok) { setResetErr(rl.msg); return }
    setResetSending(true); setResetErr('')
    try {
      await resetPassword(resetEmail)
      recordResetAttempt()
      setResetSent(true)
    }
    catch (e) { setResetErr(e.message || 'Error al enviar. Verificá el email.') }
    setResetSending(false)
  }

  // Saludo personalizado: si recordamos el email, sacar primer nombre antes del @
  const knownName = (() => {
    if (!email || !email.includes('@')) return null
    const local = email.split('@')[0].split('.')[0].split('+')[0]
    if (!local || local.length < 2) return null
    return local.charAt(0).toUpperCase() + local.slice(1).toLowerCase()
  })()

  return (
    <>
      <style>{`
        /* ═══════════════════════════════════════════════════════
           LA ENTRADA
           El fondo era un degrade de violeta, naranja y magenta con
           tres orbes borrosos: tres colores vetados por la marca y
           ningun degrade sobrevive en la web. Ahora es el violeta
           pleno de las bandas (#360C72) con el corte diagonal del
           isotipo a escala de pantalla: una sola figura plana, que
           da profundidad sin un solo degrade. La tarjeta va blanca,
           como el mock del hero, y todo lo de adentro pasa a la
           rampa clara: violeta para lo que lleva a algun lado,
           verde para la accion, amarillo solo de acento.
           ═══════════════════════════════════════════════════════ */

        @keyframes lp-card-in { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:none} }
        @keyframes lp-fade { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }

        .lp-wrap{
          position:fixed;inset:0;z-index:9999;
          display:flex;align-items:center;justify-content:center;
          padding:24px;font-family:'Inter',system-ui,sans-serif;
          background:#360C72;
          /* Scroll, no recorte: con el teclado abierto o en apaisado la
             tarjeta es mas alta que la pantalla y antes se cortaba el pie. */
          overflow:auto;-webkit-overflow-scrolling:touch;
        }
        /* El corte del isotipo, a tamano de pantalla. */
        .lp-wrap::before{
          content:'';position:fixed;inset:0;pointer-events:none;
          background:#2B0A60;
          clip-path:polygon(100% 26%,100% 100%,26% 100%);
        }
        /* El filo amarillo de la imagen de compartir. */
        .lp-wrap::after{
          content:'';position:fixed;top:0;left:0;right:0;height:5px;
          background:#F6DE8B;pointer-events:none;
        }

        .lp-card{
          position:relative;z-index:1;width:100%;max-width:480px;margin:auto;
          background:#F5EFE4;
          border:1px solid #E4D9C6;
          border-radius:26px;padding:40px 38px 30px;
          box-shadow:0 30px 70px -24px rgba(12,2,34,.6);
          animation:lp-card-in .5s cubic-bezier(.2,.7,.2,1) both;
        }

        .lp-top{display:flex;align-items:center;gap:12px;margin-bottom:22px}
        .lp-logo{width:44px;height:44px;flex-shrink:0;display:flex;align-items:center;justify-content:center}
        .lp-logo img{width:100%;height:100%;object-fit:contain;display:block}
        .lp-brand-txt{display:flex;flex-direction:column;line-height:1}
        .lp-brand-name{font-family:'Poppins',sans-serif;font-size:19px;font-weight:600;color:#221433;letter-spacing:.2px}
        .lp-brand-tag{font-size:11px;color:#6E6383;margin-top:4px;letter-spacing:.3px}

        .lp-greet{
          font-size:26px;font-weight:800;color:#221433;letter-spacing:-.5px;line-height:1.2;
          margin-bottom:8px;animation:lp-fade .5s .1s ease both
        }
        .lp-greet em{font-style:normal;color:#4718AE}
        .lp-sub{
          font-size:13.5px;color:#574A6B;margin-bottom:24px;line-height:1.55;
          animation:lp-fade .5s .18s ease both
        }
        .lp-sub b{color:#221433;font-weight:700}

        .lp-fg{margin-bottom:16px}
        .lp-lbl{
          display:flex;justify-content:space-between;align-items:center;
          font-size:10.5px;font-weight:700;color:#6E6383;
          margin-bottom:7px;letter-spacing:.7px;text-transform:uppercase
        }
        .lp-inp{
          width:100%;padding:15px 16px;box-sizing:border-box;
          background:#fff;
          border:1.5px solid #8E7BB8;
          border-radius:13px;font-size:15px;color:#221433;outline:none;
          transition:border-color .18s,background .18s,box-shadow .18s;
          font-family:'Inter',sans-serif;
        }
        .lp-inp::placeholder{color:#9A8FAE}
        .lp-inp:focus{
          border-color:#652BDF;
          background:#fff;
          box-shadow:0 0 0 4px rgba(101,43,223,.14);
        }
        .lp-pw{position:relative}
        .lp-eye{
          position:absolute;right:8px;top:50%;transform:translateY(-50%);
          background:none;border:none;color:#6E6383;
          font-size:13px;cursor:pointer;transition:color .15s;
          width:38px;height:38px;display:flex;align-items:center;justify-content:center;
        }
        .lp-eye:hover{color:#221433}

        .lp-forgot{
          background:none;border:none;color:#4718AE;font-size:11px;font-weight:700;
          cursor:pointer;padding:0;font-family:inherit;letter-spacing:.2px;
          transition:color .15s;text-transform:none
        }
        .lp-forgot:hover{color:#652BDF;text-decoration:underline}

        .lp-err{
          background:#FDECEC;border:1.5px solid #F4CDCA;border-radius:11px;
          color:#B42318;font-size:12.5px;padding:11px 13px;margin-bottom:14px;
          display:flex;align-items:center;gap:8px;animation:lp-fade .25s ease both;
        }
        .lp-caps{display:flex;align-items:center;gap:6px;margin-top:7px;font-size:10.5px;color:#7A4F00;font-weight:700}

        .lp-btn{
          width:100%;padding:16px;margin-top:10px;min-height:52px;
          background:#0B7D59;
          color:#fff;border:none;border-radius:13px;
          font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;
          box-shadow:0 8px 20px rgba(11,125,89,.26);
          transition:background .18s,transform .15s,box-shadow .2s;
          display:flex;align-items:center;justify-content:center;gap:8px;letter-spacing:.2px;
        }
        .lp-btn:hover:not(:disabled){background:#0E9B6E;transform:translateY(-1px);box-shadow:0 12px 26px rgba(11,125,89,.32)}
        .lp-btn:active:not(:disabled){transform:translateY(0)}
        .lp-btn:disabled{opacity:.55;cursor:not-allowed}

        .lp-divider,.lp-sep{
          display:flex;align-items:center;gap:10px;
          font-size:10.5px;color:#6E6383;
          text-transform:uppercase;letter-spacing:1.2px;font-weight:700
        }
        .lp-divider{margin:20px 0 14px}
        .lp-sep{margin:0 0 16px}
        .lp-divider::before,.lp-divider::after,
        .lp-sep::before,.lp-sep::after{content:'';flex:1;height:1px;background:#E4D9C6}

        .lp-google{
          display:flex;align-items:center;justify-content:center;gap:10px;width:100%;
          padding:15px;min-height:52px;
          background:#fff;color:#221433;
          border:1.5px solid #8E7BB8;border-radius:13px;
          font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;
          transition:background .18s,border-color .18s,transform .15s;margin-bottom:14px;
        }
        .lp-google:hover:not(:disabled){background:#F7F3FF;border-color:#A68BF0;transform:translateY(-1px)}
        .lp-google:disabled{opacity:.55;cursor:not-allowed;transform:none}

        .lp-cta{
          display:flex;align-items:center;justify-content:center;gap:6px;
          width:100%;padding:12px;box-sizing:border-box;
          border:1.5px solid #DECDFC;background:#F1EBFD;border-radius:12px;
          color:#4718AE;font-size:12.5px;font-weight:600;
          text-decoration:none;transition:background .18s,border-color .18s,transform .15s;
        }
        .lp-cta:hover{background:#E2D2FF;border-color:#A68BF0;transform:translateY(-1px)}
        .lp-cta-pill{
          font-size:9.5px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;
          background:#F6DE8B;color:#3A2E02;padding:3px 7px;border-radius:8px;margin-right:4px
        }

        .lp-foot{
          margin-top:18px;text-align:center;font-size:10.5px;color:#6E6383;
          letter-spacing:.4px;display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap
        }
        .lp-foot i{color:#0B7D59}
        .lp-foot b{color:#574A6B;font-weight:700}
        .lp-foot a{color:#4718AE;text-decoration:none}
        .lp-foot a:hover{text-decoration:underline}
        .lp-dot{width:3px;height:3px;border-radius:50%;background:#CFC2E8;display:inline-block}

        /* MODAL: RECUPERAR CONTRASENA */
        .lp-modal-bg{
          position:fixed;inset:0;z-index:10000;background:rgba(27,8,66,.62);
          display:flex;align-items:center;justify-content:center;padding:20px;
          -webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);
        }
        .lp-modal{
          background:#F5EFE4;border:1px solid #E4D9C6;
          border-radius:20px;padding:28px 26px;width:100%;max-width:380px;
          box-shadow:0 30px 70px -24px rgba(12,2,34,.6);animation:lp-card-in .3s ease both;
        }
        .lp-modal h3{font-size:17px;font-weight:800;color:#221433;margin:0 0 6px;letter-spacing:-.3px}
        .lp-modal p{font-size:13px;color:#574A6B;margin:0 0 20px;line-height:1.6}
        .lp-modal-ok{
          background:#E6F6F0;border:1.5px solid #6EE7B7;border-radius:12px;padding:14px;
          text-align:center;color:#0B7D59;font-size:12.5px;line-height:1.6
        }
        .lp-modal-ok i{color:#0B7D59;font-size:18px;display:block;margin-bottom:6px}
        .lp-modal-row{display:flex;gap:8px;margin-top:16px}
        .lp-modal-cancel{
          flex:1;padding:12px;border:1.5px solid #8E7BB8;border-radius:11px;
          background:#fff;color:#574A6B;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;
          transition:background .18s,border-color .18s,transform .15s
        }
        .lp-modal-cancel:hover{background:#F7F3FF;border-color:#A68BF0}
        .lp-modal-send{
          flex:2;padding:12px;border:none;border-radius:11px;
          background:#652BDF;color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;
          transition:background .18s
        }
        .lp-modal-send:hover:not(:disabled){background:#4718AE}
        .lp-modal-send:disabled{opacity:.55;cursor:not-allowed}

        /* Quien navega con el teclado tiene que ver donde esta parado. */
        .lp-card a:focus-visible,.lp-card button:focus-visible,
        .lp-modal button:focus-visible{outline:2px solid #652BDF;outline-offset:3px;border-radius:10px}
        .lp-btn:focus-visible{outline-color:#221433}

        @media(prefers-reduced-motion:reduce){
          .lp-card,.lp-greet,.lp-sub,.lp-err{animation:none!important}
        }

        @media(max-width:480px){
          .lp-wrap{padding:16px}
          .lp-card{padding:30px 22px 24px;border-radius:20px}
          .lp-greet{font-size:22px}
          /* iOS no hace zoom si el input mide 16px o mas */
          .lp-inp{font-size:16px!important;padding:14px 15px!important}
        }
      `}</style>

      <div className="lp-wrap">
        <form className="lp-card" onSubmit={e => { e.preventDefault(); handleLogin() }}>
          <div className="lp-top">
            <div className="lp-logo"><img src="/logo-mark.svg" alt="" /></div>
            <div className="lp-brand-txt">
              <span className="lp-brand-name">ANMA</span>
              <span className="lp-brand-tag">Centro de mando</span>
            </div>
          </div>

          <div className="lp-greet">
            {greeting()}{knownName ? <>, <em>{knownName}</em></> : <em> 👋</em>}
          </div>
          <div className="lp-sub">
            {lastLoginRel
              ? <>Tu último ingreso fue <b>{lastLoginRel}</b>. Todo te está esperando.</>
              : <>Ingresá para retomar tu operación donde la dejaste.</>}
          </div>

          {/* Google login — redirect tradicional, funciona en todos los dispositivos */}
          <button type="button" className="lp-google" onClick={handleGoogle} disabled={googleBusy || submitting}>
            {googleBusy
              ? <><i className="fa fa-spinner fa-spin" /> Redirigiendo a Google...</>
              : <><GoogleIcon /> Continuar con Google</>}
          </button>

          {/* Rescate: si el user tuvo "link inválido" o intentos previos colgados */}
          <div style={{ textAlign:'center', marginTop:10, marginBottom:16 }}>
            <button type="button" onClick={handleHardReset} disabled={googleBusy}
              style={{ background:'none', border:'none', color:'#6E6383', fontSize:11, cursor:'pointer', textDecoration:'underline', textUnderlineOffset:3, fontFamily:'inherit', padding:'4px 8px' }}>
              ¿Tuviste "link inválido" antes? Limpiar y reintentar →
            </button>
          </div>

          <div className="lp-sep">o con tu email</div>

          {err && (
            <div className="lp-err">
              <i className="fa fa-circle-exclamation" /><span>{err}</span>
            </div>
          )}

          <div className="lp-fg">
            <label className="lp-lbl">Email</label>
            <input type="email" className="lp-inp" placeholder="tu@email.com"
              value={email} onChange={e => setEmail(e.target.value)}
              onKeyDown={handleKey} autoComplete="email" autoFocus={!email} />
          </div>

          <div className="lp-fg">
            <label className="lp-lbl">
              <span>Contraseña</span>
              <button type="button" className="lp-forgot" onClick={openForgot}>¿La olvidaste?</button>
            </label>
            <div className="lp-pw">
              <input
                type={showPwd ? 'text' : 'password'}
                className="lp-inp"
                placeholder="••••••••"
                value={pass}
                onChange={e => setPass(e.target.value)}
                onKeyDown={handleKey}
                autoComplete="current-password"
                style={{ paddingRight: 42 }}
                autoFocus={!!email}
              />
              <button className="lp-eye" type="button" onClick={() => setShowPwd(!showPwd)}
                aria-label={showPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                aria-pressed={showPwd} title={showPwd ? 'Ocultar' : 'Mostrar'}>
                <i className={`fa ${showPwd ? 'fa-eye-slash' : 'fa-eye'}`} />
              </button>
            </div>
            {capsOn && (
              <div className="lp-caps">
                <i className="fa fa-arrow-up" /><span>Bloq Mayús está activado</span>
              </div>
            )}
          </div>

          <button type="submit" className="lp-btn" disabled={submitting}>
            {submitting
              ? <><i className="fa fa-spinner fa-spin" /> Ingresando...</>
              : <><i className="fa fa-arrow-right-to-bracket" /> Entrar a ANMA</>}
          </button>

          {/* Link directo a registro para usuarios nuevos */}
          <div style={{
            textAlign: 'center', marginTop: 18, marginBottom: 14,
            fontSize: 13, color: '#574A6B',
          }}>
            ¿No tenés cuenta?{' '}
            <a
              href="/app/registro"
              style={{
                color: '#4718AE', fontWeight: 700, textDecoration: 'none',
                borderBottom: '1px dashed #C9B6F5', paddingBottom: 1,
              }}
            >
              Registrate gratis →
            </a>
          </div>

          <InstallButton
            label="Instalar app en mi celular"
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, margin: '0 auto 6px', background: '#fff', border: '1.5px solid #8E7BB8', color: '#574A6B', borderRadius: 11, padding: '11px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
          />

          <div className="lp-divider">o</div>

          <a className="lp-cta" href="/">
            <span className="lp-cta-pill">Nuevo</span>
            ¿Todavía no usás ANMA? Conocelo en 60 segundos
            <i className="fa fa-arrow-right" style={{ fontSize: 11, marginLeft: 2 }} />
          </a>

          <div className="lp-foot">
            <span><i className="fa fa-lock" /> Cifrado E2E</span>
            <span className="lp-dot" />
            <span>ANMA <b>{APP_VERSION}</b></span>
            <span className="lp-dot" />
            <a href="/#pricing">Planes</a>
          </div>
        </form>
      </div>

      {forgotModal && (
        <div className="lp-modal-bg" onClick={e => { if (e.target === e.currentTarget) setForgotModal(false) }}>
          <div className="lp-modal">
            <h3><i className="fa fa-key" style={{ color: '#4718AE', marginRight: 8, fontSize: 15 }} />Recuperar contraseña</h3>
            {resetSent ? (
              <>
                <div className="lp-modal-ok">
                  <i className="fa fa-circle-check" />
                  Listo. Te enviamos un enlace a <b style={{ color: '#07533B' }}>{resetEmail}</b>.<br />
                  Revisá tu bandeja (incluso spam) para crear una nueva contraseña.
                </div>
                <div className="lp-modal-row">
                  <button className="lp-modal-cancel" style={{ flex: 1 }} onClick={() => setForgotModal(false)}>Cerrar</button>
                </div>
              </>
            ) : (
              <>
                <p>Te enviamos un enlace para restablecerla. Llega en menos de un minuto.</p>
                <label className="lp-lbl">Email</label>
                <input type="email" className="lp-inp" placeholder="tu@email.com"
                  value={resetEmail} onChange={e => setResetEmail(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleReset() }} autoFocus />
                {resetErr && (
                  <div className="lp-err" style={{ marginTop: 10, marginBottom: 0 }}>
                    <i className="fa fa-circle-exclamation" /><span>{resetErr}</span>
                  </div>
                )}
                <div className="lp-modal-row">
                  <button className="lp-modal-cancel" onClick={() => setForgotModal(false)}>Cancelar</button>
                  <button className="lp-modal-send" onClick={handleReset} disabled={resetSending}>
                    {resetSending ? <><i className="fa fa-spinner fa-spin" /> Enviando...</> : <><i className="fa fa-paper-plane" /> Enviar enlace</>}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

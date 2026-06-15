import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { persistAcquisitionAcrossOAuth } from '../../lib/acquisitionTracking'

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

// Monograma ANMA Hub: "A" completa de trazo continuo + bucle abierto
// enganchado en la pierna derecha (hub). Mismo diseño que favicon.svg, en blanco.
// ANMA Hub — versión white-on-dark (Login/Registro tienen fondo violeta).
// Mantiene la geometría del logo principal: A triangular + crossbar + curl "hub".
const AnmaLogo = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="42" height="42" viewBox="0 0 100 100" fill="none">
    {/* Cuerpo de la A — trazo grueso blanco */}
    <path d="M 22 90 L 50 8 L 78 90" stroke="#fff" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"/>
    {/* Crossbar */}
    <path d="M 34 64 L 66 64" stroke="#fff" strokeWidth="6.5" strokeLinecap="round"/>
    {/* Curl "Hub" — acento magenta que envuelve la pierna derecha */}
    <path d="M 67 70 Q 86 76 82 90 Q 70 98 58 86" stroke="#F472B6" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

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
        redirectTo: `${window.location.origin}/bienvenida${nextUrl ? '?next=' + encodeURIComponent(nextUrl) : ''}`,
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
        @keyframes lp-orb-a { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-32px,24px) scale(1.08)} }
        @keyframes lp-orb-b { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(28px,-22px) scale(1.12)} }
        @keyframes lp-orb-c { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(20px,18px) scale(1.06)} }
        @keyframes lp-card-in {
          0%   { opacity:0; transform:translateY(18px) scale(.985); filter:blur(6px) }
          100% { opacity:1; transform:none; filter:blur(0) }
        }
        @keyframes lp-fade { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
        @keyframes lp-ring { 0%{box-shadow:0 0 0 0 rgba(167,139,250,.55)} 70%{box-shadow:0 0 0 16px rgba(167,139,250,0)} 100%{box-shadow:0 0 0 0 rgba(167,139,250,0)} }

        .lp-wrap{
          position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;
          padding:24px;font-family:'Inter',system-ui,sans-serif;
          background:radial-gradient(1200px 800px at 20% 10%,#3b1078 0%,transparent 60%),
                     radial-gradient(900px 700px at 80% 90%,#0f7a55 0%,transparent 55%),
                     linear-gradient(135deg,#0e0524 0%,#1a0636 35%,#2d0a57 70%,#1a1233 100%);
          overflow:hidden;
        }
        .lp-orb{position:absolute;border-radius:50%;pointer-events:none;filter:blur(40px)}
        .lp-orb1{width:520px;height:520px;top:-160px;right:-140px;background:radial-gradient(circle,rgba(124,58,237,.45) 0%,transparent 70%);animation:lp-orb-a 16s ease-in-out infinite}
        .lp-orb2{width:380px;height:380px;bottom:-120px;left:-90px;background:radial-gradient(circle,rgba(5,150,105,.35) 0%,transparent 70%);animation:lp-orb-b 20s ease-in-out infinite}
        .lp-orb3{width:240px;height:240px;top:48%;left:18%;background:radial-gradient(circle,rgba(236,72,153,.20) 0%,transparent 70%);animation:lp-orb-c 22s ease-in-out infinite}
        @media (prefers-reduced-motion:reduce){.lp-orb1,.lp-orb2,.lp-orb3{animation:none}}

        .lp-grain{position:absolute;inset:0;pointer-events:none;opacity:.04;mix-blend-mode:overlay;
          background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>")}

        .lp-card{
          position:relative;z-index:1;width:100%;max-width:420px;
          background:rgba(255,255,255,.06);
          backdrop-filter:blur(28px) saturate(180%);
          -webkit-backdrop-filter:blur(28px) saturate(180%);
          border:1px solid rgba(255,255,255,.12);
          border-radius:24px;padding:36px 34px 28px;
          box-shadow:0 24px 80px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.08);
          animation:lp-card-in .6s cubic-bezier(.2,.7,.2,1) both;
        }

        .lp-top{display:flex;align-items:center;gap:12px;margin-bottom:22px}
        .lp-logo{
          width:46px;height:46px;border-radius:13px;flex-shrink:0;
          background:linear-gradient(135deg,#7c3aed 0%,#a855f7 60%,#ec4899 100%);
          display:flex;align-items:center;justify-content:center;
          box-shadow:0 8px 24px rgba(124,58,237,.4);
          animation:lp-ring 2.6s ease-out 1.2s 1;
        }
        .lp-brand-txt{display:flex;flex-direction:column;line-height:1}
        .lp-brand-name{font-size:20px;font-weight:900;color:#fff;letter-spacing:-.5px}
        .lp-brand-tag{font-size:11px;color:rgba(255,255,255,.5);margin-top:3px;letter-spacing:.3px}

        .lp-greet{
          font-size:24px;font-weight:800;color:#fff;letter-spacing:-.5px;line-height:1.2;
          margin-bottom:6px;animation:lp-fade .5s .15s ease both
        }
        .lp-greet em{font-style:normal;background:linear-gradient(90deg,#a78bfa,#ec4899);-webkit-background-clip:text;background-clip:text;color:transparent}
        .lp-sub{
          font-size:13px;color:rgba(255,255,255,.6);margin-bottom:22px;line-height:1.55;
          animation:lp-fade .5s .25s ease both
        }
        .lp-sub b{color:rgba(255,255,255,.85);font-weight:600}

        .lp-fg{margin-bottom:14px}
        .lp-lbl{
          display:flex;justify-content:space-between;align-items:center;
          font-size:10.5px;font-weight:700;color:rgba(255,255,255,.7);
          margin-bottom:7px;letter-spacing:.7px;text-transform:uppercase
        }
        .lp-inp{
          width:100%;padding:13px 15px;box-sizing:border-box;
          background:rgba(255,255,255,.07);
          border:1.5px solid rgba(255,255,255,.12);
          border-radius:12px;font-size:14px;color:#fff;outline:none;
          transition:border-color .2s,background .2s,box-shadow .2s;
          font-family:'Inter',sans-serif;
        }
        .lp-inp::placeholder{color:rgba(255,255,255,.3)}
        .lp-inp:focus{
          border-color:rgba(167,139,250,.6);
          background:rgba(255,255,255,.10);
          box-shadow:0 0 0 4px rgba(167,139,250,.12);
        }
        .lp-pw{position:relative}
        .lp-eye{
          position:absolute;right:12px;top:50%;transform:translateY(-50%);
          background:none;border:none;color:rgba(255,255,255,.45);
          font-size:13px;padding:6px;cursor:pointer;transition:color .2s;
        }
        .lp-eye:hover{color:rgba(255,255,255,.85)}

        .lp-forgot{
          background:none;border:none;color:#a78bfa;font-size:11px;font-weight:600;
          cursor:pointer;padding:0;font-family:inherit;letter-spacing:.2px;
          transition:color .15s;text-transform:none
        }
        .lp-forgot:hover{color:#c4b5fd;text-decoration:underline}

        .lp-err{
          background:rgba(220,38,38,.12);border:1.5px solid rgba(252,165,165,.4);border-radius:11px;
          color:#fca5a5;font-size:12px;padding:10px 13px;margin-bottom:14px;
          display:flex;align-items:center;gap:8px;animation:lp-fade .25s ease both;
        }
        .lp-caps{display:flex;align-items:center;gap:6px;margin-top:7px;font-size:10.5px;color:#fbbf24;font-weight:600}

        .lp-btn{
          width:100%;padding:14px;margin-top:8px;
          background:linear-gradient(135deg,#059669 0%,#10b981 100%);
          color:#fff;border:none;border-radius:12px;
          font-size:14.5px;font-weight:700;cursor:pointer;font-family:inherit;
          box-shadow:0 8px 24px rgba(5,150,105,.4),inset 0 1px 0 rgba(255,255,255,.18);
          transition:transform .15s,box-shadow .25s,filter .2s;
          display:flex;align-items:center;justify-content:center;gap:8px;letter-spacing:.2px;
        }
        .lp-btn:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 12px 30px rgba(5,150,105,.55)}
        .lp-btn:active:not(:disabled){transform:translateY(0)}
        .lp-btn:disabled{opacity:.65;cursor:not-allowed}

        .lp-divider{
          display:flex;align-items:center;gap:10px;
          margin:18px 0 12px;font-size:10.5px;color:rgba(255,255,255,.35);
          text-transform:uppercase;letter-spacing:1.2px;font-weight:600
        }
        .lp-divider::before,.lp-divider::after{content:'';flex:1;height:1px;background:rgba(255,255,255,.10)}

        .lp-google{
          display:flex;align-items:center;justify-content:center;gap:10px;width:100%;
          padding:13px;background:#fff;color:#1f1f1f;border:none;border-radius:12px;
          font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;
          box-shadow:0 4px 18px rgba(0,0,0,.28);
          transition:transform .15s,box-shadow .2s;margin-bottom:16px;
        }
        .lp-google:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 8px 24px rgba(0,0,0,.38)}
        .lp-google:disabled{opacity:.6;cursor:not-allowed;transform:none}
        .lp-sep{
          display:flex;align-items:center;gap:10px;margin:0 0 16px;
          font-size:10.5px;color:rgba(255,255,255,.35);
          text-transform:uppercase;letter-spacing:1.2px;font-weight:600;
        }
        .lp-sep::before,.lp-sep::after{content:'';flex:1;height:1px;background:rgba(255,255,255,.10)}

        .lp-cta{
          display:flex;align-items:center;justify-content:center;gap:6px;
          width:100%;padding:11px;border:1.5px solid rgba(255,255,255,.14);
          background:rgba(255,255,255,.04);border-radius:11px;
          color:rgba(255,255,255,.85);font-size:12.5px;font-weight:600;
          text-decoration:none;transition:background .2s,border-color .2s,transform .15s;
        }
        .lp-cta:hover{background:rgba(255,255,255,.10);border-color:rgba(255,255,255,.28);transform:translateY(-1px)}
        .lp-cta-pill{font-size:9.5px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;
          background:linear-gradient(135deg,#10b981,#059669);color:#fff;padding:2px 7px;border-radius:8px;margin-right:4px}

        .lp-foot{
          margin-top:20px;text-align:center;font-size:10.5px;color:rgba(255,255,255,.32);
          letter-spacing:.4px;display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap
        }
        .lp-foot i{color:#10b981}
        .lp-foot b{color:rgba(255,255,255,.5);font-weight:600}
        .lp-foot a{color:rgba(255,255,255,.5);text-decoration:none}
        .lp-foot a:hover{color:#a78bfa}
        .lp-dot{width:3px;height:3px;border-radius:50%;background:rgba(255,255,255,.2);display:inline-block}

        /* MODAL FORGOT */
        .lp-modal-bg{position:fixed;inset:0;z-index:10000;background:rgba(10,5,30,.72);display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(8px)}
        .lp-modal{
          background:rgba(20,15,40,.85);backdrop-filter:blur(28px);
          border:1px solid rgba(255,255,255,.12);
          border-radius:20px;padding:30px 26px;width:100%;max-width:380px;
          box-shadow:0 24px 64px rgba(0,0,0,.55);animation:lp-card-in .35s ease both;
        }
        .lp-modal h3{font-size:17px;font-weight:800;color:#fff;margin:0 0 6px;letter-spacing:-.3px}
        .lp-modal p{font-size:13px;color:rgba(255,255,255,.6);margin:0 0 20px;line-height:1.6}
        .lp-modal-ok{background:rgba(16,185,129,.12);border:1.5px solid rgba(110,231,183,.4);border-radius:12px;padding:14px;text-align:center;color:#86efac;font-size:13px;font-weight:600;line-height:1.6}
        .lp-modal-ok i{color:#10b981;font-size:18px;display:block;margin-bottom:6px}
        .lp-modal-row{display:flex;gap:8px;margin-top:16px}
        .lp-modal-cancel{flex:1;padding:11px;border:1.5px solid rgba(255,255,255,.14);border-radius:10px;background:transparent;color:rgba(255,255,255,.7);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit}
        .lp-modal-cancel:hover{background:rgba(255,255,255,.04)}
        .lp-modal-send{flex:2;padding:11px;border:none;border-radius:10px;background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:6px}
        .lp-modal-send:disabled{opacity:.6;cursor:not-allowed}

        @media(max-width:480px){
          .lp-card{padding:30px 24px 24px;border-radius:20px}
          .lp-greet{font-size:21px}
          /* iOS zoom prevention: inputs necesitan font-size ≥16px */
          .lp-inp{font-size:16px!important;padding:14px 15px!important}
        }
      `}</style>

      <div className="lp-wrap">
        <div className="lp-orb lp-orb1" />
        <div className="lp-orb lp-orb2" />
        <div className="lp-orb lp-orb3" />
        <div className="lp-grain" />

        <form className="lp-card" onSubmit={e => { e.preventDefault(); handleLogin() }}>
          <div className="lp-top">
            <div className="lp-logo"><AnmaLogo /></div>
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
          <div style={{ textAlign:'center', marginTop:8, marginBottom:4 }}>
            <button type="button" onClick={handleHardReset} disabled={googleBusy}
              style={{ background:'none', border:'none', color:'rgba(255,255,255,.45)', fontSize:11, cursor:'pointer', textDecoration:'underline', textUnderlineOffset:3, fontFamily:'inherit', padding:'4px 8px' }}>
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
              <button className="lp-eye" type="button" onClick={() => setShowPwd(!showPwd)} title={showPwd ? 'Ocultar' : 'Mostrar'}>
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
            fontSize: 13, color: 'rgba(255,255,255,.65)',
          }}>
            ¿No tenés cuenta?{' '}
            <a
              href="/registro"
              style={{
                color: '#a78bfa', fontWeight: 700, textDecoration: 'none',
                borderBottom: '1px dashed rgba(167,139,250,.5)', paddingBottom: 1,
              }}
            >
              Registrate gratis →
            </a>
          </div>

          <div className="lp-divider">o</div>

          <a className="lp-cta" href="/landing.html">
            <span className="lp-cta-pill">Nuevo</span>
            ¿Todavía no usás ANMA? Conocelo en 60 segundos
            <i className="fa fa-arrow-right" style={{ fontSize: 11, marginLeft: 2 }} />
          </a>

          <div className="lp-foot">
            <span><i className="fa fa-lock" /> Cifrado E2E</span>
            <span className="lp-dot" />
            <span>ANMA <b>{APP_VERSION}</b></span>
            <span className="lp-dot" />
            <a href="/landing.html#planes">Planes</a>
          </div>
        </form>
      </div>

      {forgotModal && (
        <div className="lp-modal-bg" onClick={e => { if (e.target === e.currentTarget) setForgotModal(false) }}>
          <div className="lp-modal">
            <h3><i className="fa fa-key" style={{ color: '#a78bfa', marginRight: 8, fontSize: 15 }} />Recuperar contraseña</h3>
            {resetSent ? (
              <>
                <div className="lp-modal-ok">
                  <i className="fa fa-circle-check" />
                  Listo. Te enviamos un enlace a <b style={{ color: '#fff' }}>{resetEmail}</b>.<br />
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

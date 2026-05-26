import { useState } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'

const AnmaLogo = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="40" height="38" fill="none" viewBox="0 0 48 46">
    <path fill="white" d="M25.946 44.938c-.664.845-2.021.375-2.021-.698V33.937a2.26 2.26 0 0 0-2.262-2.262H10.287c-.92 0-1.456-1.04-.92-1.788l7.48-10.471c1.07-1.497 0-3.578-1.842-3.578H1.237c-.92 0-1.456-1.04-.92-1.788L10.013.474c.214-.297.556-.474.92-.474h28.894c.92 0 1.456 1.04.92 1.788l-7.48 10.471c-1.07 1.498 0 3.579 1.842 3.579h11.377c.943 0 1.473 1.088.89 1.83L25.947 44.94z"/>
  </svg>
)

function friendlySignupError(raw) {
  if (!raw) return ''
  const m = String(raw).toLowerCase()
  if (m.includes('already registered') || m.includes('already exists') || m.includes('already an account')) {
    return 'Ya existe una cuenta con este email. ¿Querés ingresar?'
  }
  if (m.includes('password') && m.includes('characters')) return 'La contraseña debe tener al menos 8 caracteres.'
  if (m.includes('invalid email') || m.includes('valid email')) return 'El formato del email no es válido.'
  if (m.includes('network') || m.includes('failed to fetch')) return 'Sin conexión. Revisá tu internet e intentá de nuevo.'
  return raw
}

export default function Registro() {
  const { authed } = useAuth()
  const [email, setEmail]     = useState('')
  const [pass, setPass]       = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [err, setErr]         = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone]       = useState(false)

  if (authed) return <Navigate to="/" replace />

  const handleSubmit = async (e) => {
    e?.preventDefault()
    setErr('')
    const trimEmail = email.trim()
    if (!trimEmail || !pass) { setErr('Completá todos los campos para continuar.'); return }
    if (pass.length < 8)     { setErr('La contraseña debe tener al menos 8 caracteres.'); return }
    if (pass !== confirm)    { setErr('Las contraseñas no coinciden. Verificalas.'); return }

    setSubmitting(true)
    const { error } = await supabase.auth.signUp({
      email: trimEmail,
      password: pass,
      options: { emailRedirectTo: `${window.location.origin}/bienvenida` },
    })
    setSubmitting(false)

    if (error) { setErr(friendlySignupError(error.message)); return }
    setDone(true)
  }

  const handleKey = (e) => { if (e.key === 'Enter') handleSubmit() }

  return (
    <>
      <style>{`
        @keyframes rg-orb-a { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-32px,24px) scale(1.08)} }
        @keyframes rg-orb-b { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(28px,-22px) scale(1.12)} }
        @keyframes rg-orb-c { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(20px,18px) scale(1.06)} }
        @keyframes rg-card-in {
          0%   { opacity:0; transform:translateY(18px) scale(.985); filter:blur(6px) }
          100% { opacity:1; transform:none; filter:blur(0) }
        }
        @keyframes rg-fade { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
        @keyframes rg-check { 0%{transform:scale(0.6) rotate(-10deg);opacity:0} 70%{transform:scale(1.1)} 100%{transform:scale(1);opacity:1} }

        .rg-wrap{
          position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;
          padding:24px;font-family:'Inter',system-ui,sans-serif;
          background:radial-gradient(1200px 800px at 20% 10%,#3b1078 0%,transparent 60%),
                     radial-gradient(900px 700px at 80% 90%,#0f7a55 0%,transparent 55%),
                     linear-gradient(135deg,#0e0524 0%,#1a0636 35%,#2d0a57 70%,#1a1233 100%);
          overflow:hidden;
        }
        .rg-orb{position:absolute;border-radius:50%;pointer-events:none;filter:blur(40px)}
        .rg-orb1{width:520px;height:520px;top:-160px;right:-140px;background:radial-gradient(circle,rgba(124,58,237,.45) 0%,transparent 70%);animation:rg-orb-a 16s ease-in-out infinite}
        .rg-orb2{width:380px;height:380px;bottom:-120px;left:-90px;background:radial-gradient(circle,rgba(5,150,105,.35) 0%,transparent 70%);animation:rg-orb-b 20s ease-in-out infinite}
        .rg-orb3{width:240px;height:240px;top:48%;left:18%;background:radial-gradient(circle,rgba(236,72,153,.20) 0%,transparent 70%);animation:rg-orb-c 22s ease-in-out infinite}
        @media(prefers-reduced-motion:reduce){.rg-orb1,.rg-orb2,.rg-orb3{animation:none}}

        .rg-grain{position:absolute;inset:0;pointer-events:none;opacity:.04;mix-blend-mode:overlay;
          background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>")}

        .rg-card{
          position:relative;z-index:1;width:100%;max-width:440px;
          background:rgba(255,255,255,.06);
          backdrop-filter:blur(28px) saturate(180%);
          -webkit-backdrop-filter:blur(28px) saturate(180%);
          border:1px solid rgba(255,255,255,.12);
          border-radius:24px;padding:36px 34px 28px;
          box-shadow:0 24px 80px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.08);
          animation:rg-card-in .6s cubic-bezier(.2,.7,.2,1) both;
        }

        .rg-top{display:flex;align-items:center;gap:12px;margin-bottom:22px}
        .rg-logo{
          width:46px;height:46px;border-radius:13px;flex-shrink:0;
          background:linear-gradient(135deg,#7c3aed 0%,#a855f7 60%,#ec4899 100%);
          display:flex;align-items:center;justify-content:center;
          box-shadow:0 8px 24px rgba(124,58,237,.4);
        }
        .rg-brand-txt{display:flex;flex-direction:column;line-height:1}
        .rg-brand-name{font-size:20px;font-weight:900;color:#fff;letter-spacing:-.5px}
        .rg-brand-tag{font-size:11px;color:rgba(255,255,255,.5);margin-top:3px;letter-spacing:.3px}

        .rg-title{font-size:22px;font-weight:800;color:#fff;letter-spacing:-.4px;line-height:1.2;margin-bottom:5px;animation:rg-fade .5s .1s ease both}
        .rg-title em{font-style:normal;background:linear-gradient(90deg,#a78bfa,#34d399);-webkit-background-clip:text;background-clip:text;color:transparent}
        .rg-sub{font-size:13px;color:rgba(255,255,255,.55);margin-bottom:24px;line-height:1.55;animation:rg-fade .5s .2s ease both}

        .rg-fg{margin-bottom:14px}
        .rg-lbl{display:block;font-size:10.5px;font-weight:700;color:rgba(255,255,255,.7);margin-bottom:7px;letter-spacing:.7px;text-transform:uppercase}
        .rg-inp{
          width:100%;padding:13px 15px;box-sizing:border-box;
          background:rgba(255,255,255,.07);
          border:1.5px solid rgba(255,255,255,.12);
          border-radius:12px;font-size:14px;color:#fff;outline:none;
          transition:border-color .2s,background .2s,box-shadow .2s;
          font-family:'Inter',sans-serif;
        }
        .rg-inp::placeholder{color:rgba(255,255,255,.3)}
        .rg-inp:focus{border-color:rgba(167,139,250,.6);background:rgba(255,255,255,.10);box-shadow:0 0 0 4px rgba(167,139,250,.12)}
        .rg-pw{position:relative}
        .rg-eye{position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;color:rgba(255,255,255,.45);font-size:13px;padding:6px;cursor:pointer;transition:color .2s}
        .rg-eye:hover{color:rgba(255,255,255,.85)}

        .rg-err{
          background:rgba(220,38,38,.12);border:1.5px solid rgba(252,165,165,.4);border-radius:11px;
          color:#fca5a5;font-size:12px;padding:10px 13px;margin-bottom:14px;
          display:flex;align-items:flex-start;gap:8px;animation:rg-fade .25s ease both;line-height:1.5
        }
        .rg-err i{flex-shrink:0;margin-top:1px}

        .rg-btn{
          width:100%;padding:14px;margin-top:6px;
          background:linear-gradient(135deg,#059669 0%,#10b981 100%);
          color:#fff;border:none;border-radius:12px;
          font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;
          box-shadow:0 8px 24px rgba(5,150,105,.4),inset 0 1px 0 rgba(255,255,255,.18);
          transition:transform .15s,box-shadow .25s;
          display:flex;align-items:center;justify-content:center;gap:8px;letter-spacing:.2px;
        }
        .rg-btn:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 12px 30px rgba(5,150,105,.55)}
        .rg-btn:disabled{opacity:.65;cursor:not-allowed}

        .rg-microcopy{text-align:center;font-size:11px;color:rgba(255,255,255,.38);margin-top:10px;letter-spacing:.3px}
        .rg-microcopy i{color:#10b981;margin-right:3px}

        .rg-divider{display:flex;align-items:center;gap:10px;margin:18px 0 14px;font-size:10.5px;color:rgba(255,255,255,.35);text-transform:uppercase;letter-spacing:1.2px;font-weight:600}
        .rg-divider::before,.rg-divider::after{content:'';flex:1;height:1px;background:rgba(255,255,255,.10)}

        .rg-login-link{
          display:flex;align-items:center;justify-content:center;gap:6px;
          padding:11px;border:1.5px solid rgba(255,255,255,.14);
          background:rgba(255,255,255,.04);border-radius:11px;
          color:rgba(255,255,255,.75);font-size:12.5px;font-weight:600;
          text-decoration:none;transition:background .2s,border-color .2s,transform .15s;
        }
        .rg-login-link:hover{background:rgba(255,255,255,.10);border-color:rgba(255,255,255,.28);transform:translateY(-1px)}

        .rg-foot{
          margin-top:20px;text-align:center;font-size:10.5px;color:rgba(255,255,255,.32);
          display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap
        }
        .rg-foot i{color:#10b981}
        .rg-dot{width:3px;height:3px;border-radius:50%;background:rgba(255,255,255,.2);display:inline-block}

        /* ESTADO ÉXITO */
        .rg-success{text-align:center;padding:10px 0 6px}
        .rg-success-icon{font-size:52px;color:#10b981;margin-bottom:16px;display:block;animation:rg-check .5s cubic-bezier(.2,.7,.2,1) both}
        .rg-success h3{font-size:21px;font-weight:800;color:#fff;margin:0 0 10px;letter-spacing:-.3px}
        .rg-success p{font-size:13.5px;color:rgba(255,255,255,.65);margin:0 0 22px;line-height:1.65}
        .rg-success-email{font-weight:700;color:#a78bfa}
        .rg-success-note{background:rgba(167,139,250,.08);border:1px solid rgba(167,139,250,.2);border-radius:12px;padding:12px 16px;font-size:12px;color:rgba(255,255,255,.55);line-height:1.6;margin-bottom:20px}

        @media(max-width:480px){
          .rg-card{padding:30px 22px 24px;border-radius:20px}
          .rg-title{font-size:19px}
          .rg-inp{font-size:16px!important;padding:14px 15px!important}
        }
      `}</style>

      <div className="rg-wrap">
        <div className="rg-orb rg-orb1" />
        <div className="rg-orb rg-orb2" />
        <div className="rg-orb rg-orb3" />
        <div className="rg-grain" />

        <div className="rg-card">
          <div className="rg-top">
            <div className="rg-logo"><AnmaLogo /></div>
            <div className="rg-brand-txt">
              <span className="rg-brand-name">ANMA Pro</span>
              <span className="rg-brand-tag">7 días gratis · Sin tarjeta</span>
            </div>
          </div>

          {done ? (
            <div className="rg-success">
              <i className="fa fa-circle-check rg-success-icon" />
              <h3>¡Ya casi estás adentro!</h3>
              <p>
                Te enviamos un enlace de confirmación a{' '}
                <span className="rg-success-email">{email}</span>.<br />
                Hacé clic en el email para activar tu cuenta.
              </p>
              <div className="rg-success-note">
                <i className="fa fa-inbox" style={{ color: '#a78bfa', marginRight: 6 }} />
                Revisá tu bandeja de entrada y también la carpeta de spam si no aparece en los próximos minutos.
              </div>
              <Link to="/login" className="rg-login-link" style={{ textDecoration: 'none' }}>
                <i className="fa fa-arrow-right-to-bracket" style={{ fontSize: 13 }} />
                Ya confirmé mi email — Ingresar
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="rg-title">
                Empezá <em>gratis hoy</em>
              </div>
              <div className="rg-sub">
                Registro en 30 segundos. Sin tarjeta de crédito.
              </div>

              {err && (
                <div className="rg-err">
                  <i className="fa fa-circle-exclamation" />
                  <span>
                    {err}
                    {err.includes('¿Querés ingresar?') && (
                      <> <Link to="/login" style={{ color: '#c4b5fd', fontWeight: 700 }}>Ir a login →</Link></>
                    )}
                  </span>
                </div>
              )}

              <div className="rg-fg">
                <label className="rg-lbl">Email</label>
                <input
                  type="email"
                  className="rg-inp"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={handleKey}
                  autoComplete="email"
                  autoFocus
                />
              </div>

              <div className="rg-fg">
                <label className="rg-lbl">Contraseña</label>
                <div className="rg-pw">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    className="rg-inp"
                    placeholder="Mínimo 8 caracteres"
                    value={pass}
                    onChange={e => setPass(e.target.value)}
                    onKeyDown={handleKey}
                    autoComplete="new-password"
                    style={{ paddingRight: 42 }}
                  />
                  <button className="rg-eye" type="button" onClick={() => setShowPwd(!showPwd)} title={showPwd ? 'Ocultar' : 'Mostrar'}>
                    <i className={`fa ${showPwd ? 'fa-eye-slash' : 'fa-eye'}`} />
                  </button>
                </div>
              </div>

              <div className="rg-fg">
                <label className="rg-lbl">Confirmá tu contraseña</label>
                <input
                  type={showPwd ? 'text' : 'password'}
                  className="rg-inp"
                  placeholder="Repetí la contraseña"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  onKeyDown={handleKey}
                  autoComplete="new-password"
                />
              </div>

              <button type="submit" className="rg-btn" disabled={submitting}>
                {submitting
                  ? <><i className="fa fa-spinner fa-spin" /> Creando cuenta...</>
                  : <><i className="fa fa-rocket" /> Probar gratis por 7 días</>}
              </button>

              <p className="rg-microcopy">
                <i className="fa fa-lock" />
                Sin tarjetas de crédito. Registro en 30 segundos.
              </p>

              <div className="rg-divider">¿Ya tenés cuenta?</div>

              <Link to="/login" className="rg-login-link">
                <i className="fa fa-arrow-right-to-bracket" style={{ fontSize: 13 }} />
                Ingresar a mi cuenta
                <i className="fa fa-arrow-right" style={{ fontSize: 11, marginLeft: 2 }} />
              </Link>

              <div className="rg-foot">
                <span><i className="fa fa-shield-halved" /> Encriptación E2E</span>
                <span className="rg-dot" />
                <span><i className="fa fa-database" /> Backups diarios</span>
                <span className="rg-dot" />
                <span><i className="fa fa-flag" /> Hecho en AR</span>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  )
}

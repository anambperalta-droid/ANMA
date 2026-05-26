/* ─────────────────────────────────────────
   ANMA Pro — Pantalla Trial Expirado
   Se muestra cuando el trial de 7 días venció
   y el usuario aún no está suscrito.
───────────────────────────────────────── */
import { useAuth } from '../../context/AuthContext'

const WA_LINK = 'https://api.whatsapp.com/send?phone=5491169456863&text=%C2%A1Hola%21%20Vi%20la%20web%20de%20ANMA%20y%20quier%C3%B3%20suscribirme%20al%20plan.'

export default function TrialExpirado() {
  const { user, logout } = useAuth()
  const name = user?.user_metadata?.business_name || user?.email?.split('@')[0] || 'tu negocio'

  return (
    <>
      <style>{`
        @keyframes te-in { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:none} }
        @keyframes te-pulse { 0%,100%{box-shadow:0 0 0 0 rgba(217,70,239,.45)} 70%{box-shadow:0 0 0 16px rgba(217,70,239,0)} }

        .te-wrap {
          min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;
          font-family:'Inter',system-ui,sans-serif;
          background:radial-gradient(1000px 700px at 20% 10%,#3b1078 0%,transparent 60%),
                     radial-gradient(800px 600px at 80% 90%,#1a0536 0%,transparent 55%),
                     linear-gradient(135deg,#0e0524,#1a0636 40%,#2d0a57 70%,#1a1233);
        }
        .te-card {
          width:100%;max-width:500px;text-align:center;
          background:rgba(255,255,255,.065);backdrop-filter:blur(28px);
          border:1px solid rgba(255,255,255,.12);border-radius:26px;
          padding:44px 38px 36px;box-shadow:0 24px 80px rgba(0,0,0,.5);
          animation:te-in .5s cubic-bezier(.2,.7,.2,1) both;
        }

        .te-icon-wrap {
          width:72px;height:72px;border-radius:50%;margin:0 auto 20px;
          background:linear-gradient(135deg,rgba(217,70,239,.18),rgba(124,58,237,.18));
          border:1px solid rgba(217,70,239,.35);
          display:flex;align-items:center;justify-content:center;
          animation:te-pulse 2.5s ease-out 1.2s 2;
        }
        .te-icon { font-size:28px;color:#d946ef }

        .te-h { font-size:24px;font-weight:900;color:#fff;margin:0 0 8px;letter-spacing:-.5px }
        .te-sub { font-size:14.5px;color:rgba(255,255,255,.6);margin:0 0 28px;line-height:1.65 }
        .te-sub em { color:#a78bfa;font-style:normal;font-weight:700 }

        /* Precio */
        .te-price-box {
          background:rgba(26,11,46,.8);border:1px solid #3d1b5c;border-radius:18px;
          padding:22px 24px;margin-bottom:24px;text-align:left;
        }
        .te-price-badge { display:inline-block;background:rgba(217,70,239,.2);color:#d946ef;
          font-size:10px;font-weight:800;text-transform:uppercase;padding:3px 12px;border-radius:20px;
          letter-spacing:1px;margin-bottom:10px }
        .te-price-row { display:flex;align-items:baseline;gap:5px;margin-bottom:4px }
        .te-price-num { font-size:48px;font-weight:900;color:#fff;letter-spacing:-2px;line-height:1 }
        .te-price-per { font-size:18px;font-weight:700;color:#a78bfa }
        .te-price-note { font-size:12px;color:#64748b;margin:0;line-height:1.5 }
        .te-entregables { margin-top:14px;padding-top:14px;border-top:1px solid rgba(255,255,255,.07) }
        .te-item { display:flex;align-items:center;gap:8px;font-size:12.5px;color:rgba(255,255,255,.7);margin-bottom:6px }
        .te-item:last-child { margin-bottom:0 }
        .te-item i { color:#34d399;font-size:11px;flex-shrink:0 }

        /* CTA */
        .te-wa-btn {
          display:flex;align-items:center;justify-content:center;gap:10px;width:100%;
          padding:16px;background:#25D366;color:#fff;border:none;border-radius:14px;
          font-size:15.5px;font-weight:800;cursor:pointer;font-family:inherit;text-decoration:none;
          box-shadow:0 10px 28px rgba(37,211,102,.35);transition:transform .15s,box-shadow .2s;
          margin-bottom:10px;
        }
        .te-wa-btn:hover { transform:translateY(-2px);box-shadow:0 14px 36px rgba(37,211,102,.45) }
        .te-wa-btn i { font-size:20px }

        .te-secondary { font-size:12px;color:rgba(255,255,255,.38);margin:0 }
        .te-logout { background:none;border:none;color:rgba(255,255,255,.38);font-size:12px;
          cursor:pointer;font-family:inherit;padding:4px 8px;transition:color .15s;text-decoration:underline }
        .te-logout:hover { color:rgba(255,255,255,.7) }

        @media(max-width:480px){
          .te-card { padding:32px 22px 28px }
          .te-h { font-size:20px }
          .te-price-num { font-size:40px }
        }
      `}</style>

      <div className="te-wrap">
        <div className="te-card">

          <div className="te-icon-wrap">
            <i className="fa fa-hourglass-end te-icon" />
          </div>

          <h2 className="te-h">Tu período de prueba terminó</h2>
          <p className="te-sub">
            Los 7 días de prueba de <em>{name}</em> en ANMA Pro llegaron a su fin.
            Suscribite para seguir gestionando tu negocio sin interrupciones.
          </p>

          <div className="te-price-box">
            <span className="te-price-badge">Plan Gestión Integral</span>
            <div className="te-price-row">
              <span className="te-price-num">$30.000</span>
              <span className="te-price-per">/ mes</span>
            </div>
            <p className="te-price-note">Costo fijo mensual. Sin contratos de permanencia.</p>
            <div className="te-entregables">
              <div className="te-item"><i className="fa fa-check" /> Acceso completo a todas las funciones</div>
              <div className="te-item"><i className="fa fa-check" /> Soporte técnico por WhatsApp en español</div>
              <div className="te-item"><i className="fa fa-check" /> Infraestructura segura con backups diarios</div>
              <div className="te-item"><i className="fa fa-check" /> Tus datos actuales se conservan intactos</div>
            </div>
          </div>

          <a href={WA_LINK} target="_blank" rel="noreferrer" className="te-wa-btn">
            <i className="fa-brands fa-whatsapp" />
            Quiero suscribirme — Hablemos ahora
          </a>

          <p className="te-secondary">
            ¿Tenés dudas?{' '}
            <a href={WA_LINK} target="_blank" rel="noreferrer"
               style={{ color:'#a78bfa', fontWeight:700, fontSize:12 }}>
              Escribinos por WhatsApp
            </a>
          </p>

          <br />
          <button className="te-logout" onClick={logout}>
            Cerrar sesión
          </button>

        </div>
      </div>
    </>
  )
}

/**
 * Onboarding.jsx — Paso 1: Perfil comercial del negocio
 *
 * Captura en <30s las 3 variables estructurales que condicionan el
 * comportamiento de toda la app:
 *   - businessName (texto)
 *   - rubro       (indumentaria | tecnologia | decoracion | almacen)
 *   - tipoVenta   (minorista | mayorista | ambos)
 *
 * Persistencia:
 *   - Local:  updateConfig() → cfg en localStorage (estado global de la app)
 *   - Server: sync automático vía anma_user_data upsert (sync.js)
 *   - Server (tipado): business_profiles.rubro / .tipo_venta / .onboarding_completed
 *
 * Diseño:
 *   - Pantalla completa, gradiente suave de fondo, una sola card central.
 *   - 3 secciones apiladas, formulario natural.
 *   - Cards de selección única con feedback visual (ring brand color + check).
 *   - CTA primario "Empezar" disabled hasta completar todo.
 */

import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../../context/DataContext'
import { useToast } from '../../context/ToastContext'
import { RUBROS, TIPOS_VENTA, getCategoriesForRubro, isGenericOrEmptyCats } from '../../lib/rubros'
import { getSuggestedSubtitle } from '../../lib/voice'

export default function Onboarding() {
  const { config, updateConfig } = useData()
  const toast = useToast()
  const nav = useNavigate()
  const c = config()

  const [businessName, setBusinessName] = useState(c.businessName || '')
  const [rubro, setRubro]               = useState(c.rubro || '')
  const [tipoVenta, setTipoVenta]       = useState(c.tipoVenta || '')
  const [saving, setSaving]             = useState(false)

  const ready = useMemo(() => !!businessName.trim() && !!rubro && !!tipoVenta, [businessName, rubro, tipoVenta])

  const handleSubmit = async () => {
    if (!ready) return
    setSaving(true)
    try {
      // Seedear categorías de productos según el rubro elegido — pero SOLO
      // si el usuario aún no las personalizó (tiene las genéricas o vacío).
      const currentCats = c.productCats || []
      const patch = {
        businessName: businessName.trim(),
        rubro,
        tipoVenta,
        onboardingCompleted: true,
        onboardingCompletedAt: new Date().toISOString(),
      }
      if (isGenericOrEmptyCats(currentCats)) {
        patch.productCats = getCategoriesForRubro(rubro)
      }
      // Subtitle sugerido por rubro — solo si el usuario aún no tiene uno custom.
      // Respeta override del usuario si ya configuró uno desde Comercial.
      if (!c.subtitle || c.subtitle === 'Tu negocio en un solo lugar') {
        patch.subtitle = getSuggestedSubtitle(rubro)
      }
      updateConfig(patch)
      toast(`Perfil guardado. Bienvenido, ${businessName.trim()}.`, 'ok')
      nav('/', { replace: true })
    } catch (e) {
      toast('No pudimos guardar. Intentá de nuevo.', 'er')
      setSaving(false)
    }
  }

  /* ─── Estilos inline (sin tocar el sistema global) ─── */
  const s = {
    page: {
      minHeight: '100vh',
      background: 'linear-gradient(135deg,#F5F3FF 0%,#EFF6FF 50%,#FDF2F8 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '32px 20px', fontFamily: "'Inter',system-ui,sans-serif",
    },
    card: {
      width: '100%', maxWidth: 620, background: '#fff', borderRadius: 22,
      padding: '36px 32px 28px',
      boxShadow: '0 12px 48px rgba(30,27,75,.12), 0 2px 6px rgba(0,0,0,.04)',
      border: '1px solid rgba(124,58,237,.08)',
    },
    badge: {
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 10px', borderRadius: 9999,
      background: 'linear-gradient(135deg,#F5F3FF,#FDF2F8)',
      color: '#7C3AED', fontSize: 11, fontWeight: 800,
      textTransform: 'uppercase', letterSpacing: '.06em',
      marginBottom: 10,
    },
    h1: { fontSize: 26, fontWeight: 800, color: '#1E1B4B', margin: '0 0 6px', letterSpacing: '-.5px' },
    sub: { fontSize: 13.5, color: '#6B7280', margin: '0 0 28px', lineHeight: 1.55 },
    section: { marginBottom: 22 },
    label: {
      display: 'block', fontSize: 11.5, fontWeight: 800, color: '#374151',
      textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10,
    },
    input: {
      width: '100%', padding: '13px 16px',
      border: '1.5px solid #E5E7EB', borderRadius: 12,
      fontFamily: 'inherit', fontSize: 15, color: '#111827',
      outline: 'none', boxSizing: 'border-box', transition: 'border-color .15s, box-shadow .15s',
      background: '#FAFAFB',
    },
    inputFocus: { borderColor: '#7C3AED', boxShadow: '0 0 0 4px rgba(124,58,237,.08)', background: '#fff' },
    grid4: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 11 },
    grid3: { display: 'grid', gridTemplateColumns: '1fr', gap: 10 },
    cta: {
      width: '100%', padding: '15px 20px', borderRadius: 13, border: 'none',
      background: 'linear-gradient(135deg,#7C3AED,#9D5CF5)', color: '#fff',
      fontSize: 15.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
      marginTop: 8, boxShadow: '0 6px 20px rgba(124,58,237,.32)',
      transition: 'transform .12s, filter .12s, opacity .15s',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    },
    ctaDisabled: {
      background: '#E5E7EB', color: '#9CA3AF', cursor: 'not-allowed',
      boxShadow: 'none', opacity: .7,
    },
    progress: { fontSize: 11, color: '#9CA3AF', textAlign: 'center', marginTop: 14 },
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.badge}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#7C3AED', display: 'inline-block' }} />
          Perfil comercial · Paso 1 de 3
        </div>
        <h1 style={s.h1}>Contanos sobre tu negocio</h1>
        <p style={s.sub}>
          Estos datos nos ayudan a personalizar la experiencia y a sugerirte plantillas,
          flujos y métricas que coinciden con tu modelo comercial. Te toma 30 segundos.
        </p>

        {/* Campo 1: Nombre del negocio */}
        <div style={s.section}>
          <label style={s.label}>¿Cómo se llama tu negocio?</label>
          <input
            type="text"
            value={businessName}
            onChange={e => setBusinessName(e.target.value)}
            placeholder="Ej: Anma Deco &amp; Home"
            style={s.input}
            onFocus={e => Object.assign(e.target.style, s.inputFocus)}
            onBlur={e => Object.assign(e.target.style, { borderColor: '#E5E7EB', boxShadow: 'none', background: '#FAFAFB' })}
            maxLength={60}
            autoFocus
          />
        </div>

        {/* Campo 2: Rubro */}
        <div style={s.section}>
          <label style={s.label}>¿Cuál es el rubro principal?</label>
          <div style={s.grid4}>
            {RUBROS.map(r => (
              <SelectCard
                key={r.val}
                fa={r.fa}
                label={r.label}
                sub={r.sub}
                selected={rubro === r.val}
                onClick={() => setRubro(r.val)}
              />
            ))}
          </div>
        </div>

        {/* Campo 3: Tipo de venta */}
        <div style={s.section}>
          <label style={s.label}>¿Cómo vendés tus productos?</label>
          <div style={s.grid3}>
            {TIPOS_VENTA.map(t => (
              <SelectCard
                key={t.val}
                fa={t.fa}
                label={t.label}
                sub={t.sub}
                selected={tipoVenta === t.val}
                onClick={() => setTipoVenta(t.val)}
              />
            ))}
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={!ready || saving}
          style={{ ...s.cta, ...((!ready || saving) ? s.ctaDisabled : {}) }}
        >
          {saving ? (
            <>
              <span style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
              Guardando...
            </>
          ) : (
            <>
              Empezar a usar ANMA
              <span style={{ fontSize: 18, lineHeight: 1 }}>→</span>
            </>
          )}
        </button>

        <div style={s.progress}>
          Podés modificar estos datos más tarde desde Configuración &gt; Identidad.
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}

/* ─── Iconos de línea (stroke-only, sin relleno) ───
   Diseño sofisticado tipo Lucide / Heroicons. Reemplazan los fa-solid (rellenos)
   por SVG outline limpios. ViewBox 24x24, stroke 1.7, sin fill. */
const LINE_ICONS = {
  'fa-shirt': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4 L20 6 L22 11 L18 13 L18 20 Q18 21 17 21 L7 21 Q6 21 6 20 L6 13 L2 11 L4 6 L8 4" />
      <path d="M8 4 Q12 7 16 4" />
    </svg>
  ),
  'fa-laptop': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="5" width="16" height="11" rx="1.5" />
      <path d="M2 19 L22 19" />
      <path d="M10 19 L14 19" strokeOpacity=".4" />
    </svg>
  ),
  'fa-couch': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 11 L4 16 L20 16 L20 11" />
      <path d="M4 11 Q4 8 6 8 L8 8 Q9 8 9 9 L9 13 L15 13 L15 9 Q15 8 16 8 L18 8 Q20 8 20 11" />
      <path d="M5 16 L5 19" />
      <path d="M19 16 L19 19" />
    </svg>
  ),
  'fa-store': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9 L4 4 L20 4 L21 9" />
      <path d="M3 9 Q3 11 5 11 Q7 11 7 9" />
      <path d="M7 9 Q7 11 9 11 Q11 11 11 9" />
      <path d="M11 9 Q11 11 13 11 Q15 11 15 9" />
      <path d="M15 9 Q15 11 17 11 Q19 11 19 9" />
      <path d="M19 9 Q19 11 21 11" strokeOpacity=".6" />
      <path d="M5 11 L5 20 L19 20 L19 11" />
      <path d="M10 20 L10 15 L14 15 L14 20" />
    </svg>
  ),
  'fa-bag-shopping': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 8 L19 8 L18 20 Q18 21 17 21 L7 21 Q6 21 6 20 L5 8" />
      <path d="M9 8 L9 6 Q9 3 12 3 Q15 3 15 6 L15 8" />
    </svg>
  ),
  'fa-boxes-stacked': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="13" width="8" height="8" rx="1" />
      <rect x="13" y="13" width="8" height="8" rx="1" />
      <rect x="8" y="3" width="8" height="8" rx="1" />
      <path d="M6 17 L8 17" strokeOpacity=".5" />
      <path d="M16 17 L18 17" strokeOpacity=".5" />
      <path d="M11 7 L13 7" strokeOpacity=".5" />
    </svg>
  ),
  'fa-arrows-rotate': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12 Q3 5 12 5 Q17 5 20 9" />
      <path d="M20 4 L20 9 L15 9" />
      <path d="M21 12 Q21 19 12 19 Q7 19 4 15" />
      <path d="M4 20 L4 15 L9 15" />
    </svg>
  ),
}
function LineIcon({ fa, size = 20, color = '#7C3AED' }) {
  const svg = LINE_ICONS[fa]
  if (!svg) return <i className={`fa-solid ${fa}`} style={{ fontSize: size * 0.7, color }} />
  return (
    <span style={{ width: size, height: size, color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* clone para inyectar tamaño */}
      <span style={{ width: '100%', height: '100%', display: 'block' }}>
        {svg.type === 'svg' ? <svg {...svg.props} style={{ width: '100%', height: '100%' }} /> : svg}
      </span>
    </span>
  )
}

/* ─── Sub-componente: card de selección única ───
   Ícono line-only sofisticado (sin relleno) en chip sobrio. */
function SelectCard({ fa, label, sub, selected, onClick }) {
  const base = {
    border: `1.5px solid ${selected ? '#7C3AED' : '#E5E7EB'}`,
    background: selected ? '#F5F3FF' : '#fff',
    borderRadius: 14, padding: '15px 16px',
    cursor: 'pointer', fontFamily: 'inherit',
    display: 'flex', flexDirection: 'row', gap: 13, alignItems: 'center',
    transition: 'all .15s', textAlign: 'left',
    boxShadow: selected ? '0 6px 18px rgba(124,58,237,.16), 0 0 0 3px rgba(124,58,237,.08)' : '0 1px 3px rgba(0,0,0,.04)',
    position: 'relative', width: '100%',
  }
  return (
    <button type="button" onClick={onClick} style={base}
      onMouseEnter={e => { if (!selected) { e.currentTarget.style.borderColor = '#C4B5FD'; e.currentTarget.style.transform = 'translateY(-1px)' } }}
      onMouseLeave={e => { if (!selected) { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.transform = 'none' } }}>
      <div style={{
        width: 42, height: 42, borderRadius: 12, flexShrink: 0,
        background: selected ? 'linear-gradient(135deg,#7C3AED,#9D5CF5)' : '#F5F3FF',
        border: selected ? 'none' : '1.5px solid #EDE9FE',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background .15s, border-color .15s',
        boxShadow: selected ? '0 3px 10px rgba(124,58,237,.3)' : 'none',
      }}>
        <LineIcon fa={fa} size={21} color={selected ? '#fff' : '#7C3AED'} />
      </div>
      <div style={{ flex: 1, minWidth: 0, paddingRight: selected ? 18 : 0 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: selected ? '#6D28D9' : '#1E1B4B', letterSpacing: '-.1px', lineHeight: 1.2 }}>{label}</div>
        <div style={{ fontSize: 11, color: '#6B7280', lineHeight: 1.4, marginTop: 2 }}>{sub}</div>
      </div>
      {selected && (
        <div style={{
          position: 'absolute', top: 9, right: 9,
          width: 18, height: 18, borderRadius: '50%',
          background: '#7C3AED', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <i className="fa-solid fa-check" style={{ fontSize: 9 }} />
        </div>
      )}
    </button>
  )
}

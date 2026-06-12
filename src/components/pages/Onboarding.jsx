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
    grid4: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))', gap: 10 },
    grid3: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 },
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

/* ─── Sub-componente: card de selección única ───
   Ícono FontAwesome en chip sobrio (mismo lenguaje visual que la landing)
   en lugar de emoji — transmite producto profesional sin perder calidez. */
function SelectCard({ fa, label, sub, selected, onClick }) {
  const base = {
    border: `1.5px solid ${selected ? '#7C3AED' : '#E5E7EB'}`,
    background: selected ? '#F5F3FF' : '#fff',
    borderRadius: 12, padding: '14px 12px',
    cursor: 'pointer', fontFamily: 'inherit',
    display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-start',
    transition: 'all .15s', textAlign: 'left',
    boxShadow: selected ? '0 4px 14px rgba(124,58,237,.14), 0 0 0 3px rgba(124,58,237,.07)' : '0 1px 2px rgba(0,0,0,.03)',
    position: 'relative', minHeight: 96,
  }
  return (
    <button type="button" onClick={onClick} style={base}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.borderColor = '#C4B5FD' }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.borderColor = '#E5E7EB' }}>
      <div style={{
        width: 34, height: 34, borderRadius: 10,
        background: selected ? 'linear-gradient(135deg,#7C3AED,#9D5CF5)' : 'linear-gradient(135deg,#F5F3FF,#EDE9FE)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 3, transition: 'background .15s',
        boxShadow: selected ? '0 3px 10px rgba(124,58,237,.3)' : 'none',
      }}>
        <i className={`fa-solid ${fa}`} style={{ fontSize: 14, color: selected ? '#fff' : '#7C3AED' }} />
      </div>
      <div style={{ fontSize: 13.5, fontWeight: 800, color: selected ? '#6D28D9' : '#1E1B4B', letterSpacing: '-.1px' }}>{label}</div>
      <div style={{ fontSize: 10.5, color: '#6B7280', lineHeight: 1.35 }}>{sub}</div>
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

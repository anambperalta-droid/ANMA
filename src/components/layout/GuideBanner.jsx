import { useState } from 'react'
import { db, dbW } from '../../lib/storage'

/**
 * Banner discreto en el dashboard que invita al usuario a leer la guía
 * completa de la app (sección por sección). Se dismissea con la X y queda
 * persistido en localStorage para no molestar después.
 *
 * Diseño: sutil, no invasivo. Si el usuario lo cierra, no vuelve a aparecer.
 */
export default function GuideBanner() {
  const [dismissed, setDismissed] = useState(() => db('guideBannerDismissed', false))

  if (dismissed) return null

  const close = () => {
    dbW('guideBannerDismissed', true)
    setDismissed(true)
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      background: 'linear-gradient(135deg, #F5EFFE 0%, #FDF2F8 100%)',
      border: '1px solid #E9DDFB',
      borderRadius: 14,
      padding: '12px 16px',
      margin: '0 0 14px',
      boxShadow: '0 4px 14px -10px rgba(124,58,237,.2)',
    }}>
      <div style={{
        flexShrink: 0, width: 36, height: 36, borderRadius: 10,
        background: 'linear-gradient(135deg, #7C3AED, #5B21B6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontSize: 15,
      }}>
        <i className="fa-solid fa-book-open" />
      </div>
      <div style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: '#3c3753', lineHeight: 1.45 }}>
        <strong style={{ color: '#1b1530', fontWeight: 700, display: 'block', marginBottom: 1 }}>
          ¿Recién llegás a ANMA?
        </strong>
        <span>Conocé cada sección de la app paso a paso — flujos visuales, tips y errores comunes.</span>
      </div>
      <a
        href="/recursos/guia"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          flexShrink: 0,
          background: '#7C3AED', color: '#fff',
          padding: '8px 14px', borderRadius: 9,
          fontSize: 12.5, fontWeight: 700,
          textDecoration: 'none', whiteSpace: 'nowrap',
          transition: 'background .15s, transform .15s',
        }}
        onMouseOver={(e) => { e.currentTarget.style.background = '#5B21B6'; e.currentTarget.style.transform = 'translateY(-1px)' }}
        onMouseOut={(e) => { e.currentTarget.style.background = '#7C3AED'; e.currentTarget.style.transform = 'none' }}
      >
        Ver la guía →
      </a>
      <button
        onClick={close}
        aria-label="Cerrar"
        style={{
          flexShrink: 0, width: 28, height: 28, border: 'none',
          background: 'transparent', cursor: 'pointer',
          color: '#94909f', fontSize: 14, borderRadius: 6,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background .15s, color .15s',
        }}
        onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,.05)'; e.currentTarget.style.color = '#1b1530' }}
        onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94909f' }}
      >
        <i className="fa-solid fa-xmark" />
      </button>
    </div>
  )
}

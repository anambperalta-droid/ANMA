import { useState, useEffect, useReducer } from 'react'
import { isStandalone, isIOS, canPromptInstall, promptInstall, subscribeInstall } from '../../lib/pwaInstall'

/**
 * Botón "Instalar app" siempre visible (a diferencia del banner dismissible).
 * - Android/Chrome: dispara el prompt nativo cuando está disponible.
 * - iOS/Safari: muestra instrucciones (Compartir → Agregar a inicio).
 * - Si ya está instalada (standalone) o no es instalable: no renderiza nada.
 */
export default function InstallButton({ style, className, label = 'Instalar app' }) {
  const [, force] = useReducer(x => x + 1, 0)
  const [iosHelp, setIosHelp] = useState(false)
  useEffect(() => subscribeInstall(force), [])

  if (isStandalone()) return null
  const ios = isIOS()
  if (!canPromptInstall() && !ios) return null

  const handle = async () => {
    if (ios) { setIosHelp(true); return }
    await promptInstall()
  }

  return (
    <>
      <button onClick={handle} className={className} style={style}>
        <i className="fa fa-download" style={{ marginRight: 7 }} />{label}
      </button>
      {iosHelp && (
        <div className="modal-bg open" onClick={e => { if (e.target === e.currentTarget) setIosHelp(false) }} style={{ zIndex: 9999 }}>
          <div className="modal-form-card" style={{ maxWidth: 380, height: 'auto', minHeight: 'auto', maxHeight: 'none', padding: '26px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 30, color: 'var(--brand)', marginBottom: 10 }}><i className="fa fa-mobile-screen-button" /></div>
            <h3 style={{ margin: '0 0 10px', color: 'var(--txt)' }}>Instalar en tu iPhone</h3>
            <p style={{ fontSize: 14, color: 'var(--txt2)', lineHeight: 1.6, margin: 0 }}>
              Tocá <b>Compartir</b> <i className="fa fa-arrow-up-from-bracket" style={{ margin: '0 2px' }} /> abajo en Safari, y después <b>"Agregar a pantalla de inicio"</b>.
            </p>
            <button className="btn btn-primary" onClick={() => setIosHelp(false)} style={{ marginTop: 16 }}>Entendido</button>
          </div>
        </div>
      )}
    </>
  )
}

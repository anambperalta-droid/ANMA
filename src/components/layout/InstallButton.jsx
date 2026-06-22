import { useState, useEffect, useReducer } from 'react'
import { isStandalone, isIOS, canPromptInstall, promptInstall, subscribeInstall } from '../../lib/pwaInstall'

/**
 * Botón "Instalar app" siempre visible (a diferencia del banner dismissible).
 * - Si Chrome ofrece el instalador nativo → lo dispara.
 * - Si no (iOS, o Chrome todavía no lo ofrece) → muestra instrucciones manuales.
 * - Solo se oculta si la app YA está instalada (modo standalone).
 */
export default function InstallButton({ style, className, label = 'Instalar app' }) {
  const [, force] = useReducer(x => x + 1, 0)
  const [help, setHelp] = useState(false)
  useEffect(() => subscribeInstall(force), [])

  if (isStandalone()) return null

  const handle = async () => {
    if (canPromptInstall()) { await promptInstall(); return }
    setHelp(true)
  }

  const ios = isIOS()

  return (
    <>
      <button onClick={handle} className={className} style={style}>
        <i className="fa fa-download" style={{ marginRight: 7 }} />{label}
      </button>
      {help && (
        <div className="modal-bg open" onClick={e => { if (e.target === e.currentTarget) setHelp(false) }} style={{ zIndex: 9999 }}>
          <div className="modal-form-card" style={{ maxWidth: 380, height: 'auto', minHeight: 'auto', maxHeight: 'none', padding: '26px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 30, color: 'var(--brand)', marginBottom: 10 }}><i className="fa fa-mobile-screen-button" /></div>
            <h3 style={{ margin: '0 0 12px', color: 'var(--txt)' }}>Instalá ANMA en tu celular</h3>
            {ios ? (
              <p style={{ fontSize: 14, color: 'var(--txt2)', lineHeight: 1.6, margin: 0 }}>
                Tocá <b>Compartir</b> <i className="fa fa-arrow-up-from-bracket" style={{ margin: '0 2px' }} /> abajo en Safari, y después <b>"Agregar a pantalla de inicio"</b>.
              </p>
            ) : (
              <p style={{ fontSize: 14, color: 'var(--txt2)', lineHeight: 1.6, margin: 0 }}>
                Tocá el menú <b>⋮</b> (arriba a la derecha de Chrome) y elegí <b>"Instalar app"</b> o <b>"Agregar a pantalla de inicio"</b>.
              </p>
            )}
            <button className="btn btn-primary" onClick={() => setHelp(false)} style={{ marginTop: 16 }}>Entendido</button>
          </div>
        </div>
      )}
    </>
  )
}

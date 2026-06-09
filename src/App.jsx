import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { useData } from './context/DataContext'
import Login from './components/layout/Login'
import AppShell from './components/layout/AppShell'
import Bienvenida from './components/pages/Bienvenida'
import Registro from './components/pages/Registro'
import TrialExpirado from './components/pages/TrialExpirado'
import PortalProveedor from './components/pages/PortalProveedor'
import Alta from './components/pages/Alta'
import Onboarding from './components/pages/Onboarding'
import Activar from './components/pages/Activar'
import PagoResultado from './components/pages/PagoResultado'
import ErrorBoundary from './components/layout/ErrorBoundary'

function AuthRedirect() {
  const loc = useLocation()
  const hash = loc.hash || ''
  const search = loc.search || ''
  const hasToken = hash.includes('access_token') || search.includes('code=') || search.includes('token_hash=')
  if (hasToken) {
    return <Navigate to={'/bienvenida' + search + hash} replace />
  }
  return null
}

export default function App() {
  const { authed, loading, trial } = useAuth()
  const { config } = useData()
  const loc = useLocation()
  const hash = loc.hash || ''
  const search = loc.search || ''
  const hasAuthParams = hash.includes('access_token') || search.includes('code=') || search.includes('token_hash=')

  if (loading && !hasAuthParams) return <div className="sk sk-kpi" style={{ height: '100vh' }} />

  // ── Onboarding gate ────────────────────────────────────────────────────
  // Si el usuario está autenticado pero no completó el Paso 1 (rubro vacío),
  // lo derivamos a /onboarding excepto si ya está ahí o en flujos de auth.
  const cfg = config ? config() : {}
  const needsOnboarding = authed && !trial?.expired && !cfg.onboardingCompleted && !cfg.rubro

  return (
    <ErrorBoundary>
      <Routes>
        {/* Rutas públicas sin auth */}
        <Route path="/portal-proveedor" element={<PortalProveedor />} />
        <Route path="/alta" element={<Alta appName="ANMA Pro" />} />
        <Route path="/bienvenida" element={<Bienvenida />} />
        <Route path="/registro" element={authed ? <Navigate to="/" /> : <Registro />} />
        <Route path="/login" element={
          hasAuthParams ? <Navigate to={'/bienvenida' + search + hash} replace /> :
          authed ? <Navigate to="/" /> : <Login />
        } />
        {/* Onboarding Paso 1 — captura perfil comercial del negocio */}
        <Route path="/onboarding" element={
          !authed         ? <Navigate to="/login" /> :
          trial?.expired  ? <TrialExpirado /> :
          <Onboarding />
        } />
        {/* Activación — accesible INCLUSO con trial expirado para que pueda pagar */}
        <Route path="/activar" element={
          !authed ? <Navigate to="/registro?next=/activar" replace /> : <Activar />
        } />
        {/* Páginas de retorno post-checkout MP — públicas (MP redirige acá) */}
        <Route path="/pago-exitoso" element={<PagoResultado variant="exitoso" />} />
        <Route path="/pago-pendiente" element={<PagoResultado variant="pendiente" />} />
        <Route path="/pago-error" element={<PagoResultado variant="error" />} />
        <Route path="/*" element={
          hasAuthParams    ? <Navigate to={'/bienvenida' + search + hash} replace /> :
          !authed          ? <Navigate to="/login" /> :
          trial?.expired   ? <TrialExpirado /> :
          needsOnboarding  ? <Navigate to="/onboarding" replace /> :
          <AppShell />
        } />
      </Routes>
    </ErrorBoundary>
  )
}

import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useLocation, useSearchParams } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { useData } from './context/DataContext'
import Login from './components/layout/Login'
import AppShell from './components/layout/AppShell'
import ErrorBoundary from './components/layout/ErrorBoundary'
import PWAInstall from './components/layout/PWAInstall'

// Páginas secundarias lazy: no forman parte del flujo principal post-login,
// así el bundle inicial solo carga Login + AppShell.
const Bienvenida      = lazy(() => import('./components/pages/Bienvenida'))
const Registro        = lazy(() => import('./components/pages/Registro'))
const TrialExpirado   = lazy(() => import('./components/pages/TrialExpirado'))
const PortalProveedor = lazy(() => import('./components/pages/PortalProveedor'))
const Alta            = lazy(() => import('./components/pages/Alta'))
const Onboarding      = lazy(() => import('./components/pages/Onboarding'))
const Activar         = lazy(() => import('./components/pages/Activar'))
const PagoResultado   = lazy(() => import('./components/pages/PagoResultado'))

// Si el user ya está autenticado y la URL tenía `?next=/algo`, redirigimos ahí
// en vez de tirarlo siempre a `/`. Sirve para el flow: /activar → /login?next=/activar
// → login OK → /activar (no perder contexto).
// Whitelist explícita por seguridad: sólo paths internos que arrancan con `/`
// y NO con `//` (evita open redirect tipo `?next=//evil.com`).
function NavigateToNext({ fallback = '/' }) {
  const [params] = useSearchParams()
  const next = params.get('next')
  const safe = next && next.startsWith('/') && !next.startsWith('//') ? next : fallback
  return <Navigate to={safe} replace />
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
      <Suspense fallback={<div className="sk sk-kpi" style={{ height: '100vh' }} />}>
      <Routes>
        {/* Rutas públicas sin auth */}
        <Route path="/portal-proveedor" element={<PortalProveedor />} />
        <Route path="/alta" element={<Alta appName="ANMA Hub" />} />
        <Route path="/bienvenida" element={<Bienvenida />} />
        <Route path="/registro" element={authed ? <NavigateToNext /> : <Registro />} />
        <Route path="/login" element={
          hasAuthParams ? <Navigate to={'/bienvenida' + search + hash} replace /> :
          authed ? <NavigateToNext /> : <Login />
        } />
        {/* Onboarding Paso 1 — captura perfil comercial. Si ya lo completó,
            no dejamos que lo repita por error: lo mandamos al dashboard. */}
        <Route path="/onboarding" element={
          !authed                  ? <Navigate to="/login" /> :
          trial?.expired           ? <TrialExpirado /> :
          (cfg.onboardingCompleted || cfg.rubro) ? <Navigate to="/" replace /> :
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
      </Suspense>
      {/* Banner de instalación PWA — a nivel App para que aparezca también en
          login/registro (antes solo estaba en AppShell = post-login). */}
      <PWAInstall />
    </ErrorBoundary>
  )
}

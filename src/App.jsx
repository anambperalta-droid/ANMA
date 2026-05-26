import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Login from './components/layout/Login'
import AppShell from './components/layout/AppShell'
import Bienvenida from './components/pages/Bienvenida'
import Registro from './components/pages/Registro'
import TrialExpirado from './components/pages/TrialExpirado'
import PortalProveedor from './components/pages/PortalProveedor'
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
  const loc = useLocation()
  const hash = loc.hash || ''
  const search = loc.search || ''
  const hasAuthParams = hash.includes('access_token') || search.includes('code=') || search.includes('token_hash=')

  if (loading && !hasAuthParams) return <div className="sk sk-kpi" style={{ height: '100vh' }} />

  return (
    <ErrorBoundary>
      <Routes>
        {/* Ruta pública sin auth: portal de proveedor con datos en URL */}
        <Route path="/portal-proveedor" element={<PortalProveedor />} />
        <Route path="/bienvenida" element={<Bienvenida />} />
        <Route path="/registro" element={authed ? <Navigate to="/" /> : <Registro />} />
        <Route path="/login" element={
          hasAuthParams ? <Navigate to={'/bienvenida' + search + hash} replace /> :
          authed ? <Navigate to="/" /> : <Login />
        } />
        <Route path="/*" element={
          hasAuthParams    ? <Navigate to={'/bienvenida' + search + hash} replace /> :
          !authed          ? <Navigate to="/login" /> :
          trial?.expired   ? <TrialExpirado /> :
          <AppShell />
        } />
      </Routes>
    </ErrorBoundary>
  )
}

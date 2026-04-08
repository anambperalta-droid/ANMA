import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Login from './components/layout/Login'
import AppShell from './components/layout/AppShell'
import Bienvenida from './components/pages/Bienvenida'

export default function App() {
  const { authed, loading } = useAuth()
  if (loading) return <div className="sk sk-kpi" style={{ height: '100vh' }} />
  return (
    <Routes>
      <Route path="/bienvenida" element={<Bienvenida />} />
      <Route path="/login" element={authed ? <Navigate to="/" /> : <Login />} />
      <Route path="/*" element={authed ? <AppShell /> : <Navigate to="/login" />} />
    </Routes>
  )
}

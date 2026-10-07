import { Navigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext.tsx'

export function DashboardPage() {
  const { role, roleLoading } = useAuth()

  if (roleLoading) {
    return (
      <div className="auth-loading-screen">
        <Loader2 className="btn-spinner animate-spin" size={32} />
        <p>Dirigiéndote a tu espacio de trabajo...</p>
      </div>
    )
  }

  if (role === 'admin') {
    return <Navigate to="/admin" replace />
  }

  // Por defecto redirige al espacio de estudiante
  return <Navigate to="/student" replace />
}


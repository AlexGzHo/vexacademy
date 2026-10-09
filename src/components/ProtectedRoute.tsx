import type { ReactNode } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { Loader2, ShieldAlert } from 'lucide-react'
import { brandConfig } from '../config/brand.ts'
import { useAuth } from '../context/AuthContext.tsx'
import type { AppRole } from '../types/index.ts'

interface ProtectedRouteProps {
  children: ReactNode
  allowedRoles?: AppRole[]
  allowReviewer?: boolean
}

export function ProtectedRoute({ children, allowedRoles, allowReviewer }: ProtectedRouteProps) {
  const { user, role, isPaymentReviewer, loading, roleLoading } = useAuth()
  const location = useLocation()


  // 1. Estado de carga de sesión inicial
  if (loading) {
    return (
      <div className="auth-loading-screen">
        <Loader2 className="btn-spinner animate-spin" size={32} />
        <p>Comprobando sesión...</p>
      </div>
    )
  }

  // 2. Si no hay usuario autenticado, redirigir a login guardando la ruta de origen
  if (!user) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />
  }

  // 3. Si se exigen roles específicos
  if (allowedRoles && allowedRoles.length > 0) {
    // Si la sesión ya existe pero el rol aún se está consultando en user_roles
    if (roleLoading) {
      return (
        <div className="auth-loading-screen">
          <Loader2 className="btn-spinner animate-spin" size={32} />
          <p>Verificando permisos de acceso...</p>
        </div>
      )
    }

    // Si el rol ya terminó de cargar pero no coincide con los autorizados (a menos que sea un revisor permitido)
    const isAllowedByRole = role && allowedRoles.includes(role)
    const isAllowedByReviewer = allowReviewer && isPaymentReviewer

    if (!isAllowedByRole && !isAllowedByReviewer) {
      return (

        <section className="page-section">
          <div className="access-denied-card">
            <ShieldAlert size={48} className="access-denied-icon" />
            <h2>Acceso Denegado</h2>
            <p>
              No dispones de los permisos necesarios para ingresar a esta sección ({allowedRoles.join(', ')}).
            </p>
            <div style={{ marginTop: '1.5rem' }}>
              <Link to="/dashboard" className="btn-primary" style={{ display: 'inline-block' }}>
                Volver a mi espacio en {brandConfig.shortName}
              </Link>
            </div>
          </div>
        </section>
      )
    }
  }

  // 4. Usuario autenticado y con rol verificado
  return <>{children}</>
}


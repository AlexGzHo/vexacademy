import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { brandConfig } from '../../config/brand.ts'
import { useAuth } from '../../context/AuthContext.tsx'

export function ConfirmPage() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [timedOut, setTimedOut] = useState(false)

  // Detectar si la URL contiene parámetros de error directamente durante el render
  const hasUrlError =
    typeof window !== 'undefined' &&
    (window.location.hash.includes('error') ||
      new URLSearchParams(window.location.search).has('error'))

  // Estado derivado sin causar re-renders síncronos dentro de useEffect
  const status: 'verifying' | 'success' | 'error' = user
    ? 'success'
    : hasUrlError || timedOut
      ? 'error'
      : 'verifying'

  useEffect(() => {
    // Si la autenticación fue exitosa, programar redirección automática al dashboard
    if (user) {
      const timer = setTimeout(() => {
        navigate('/dashboard', { replace: true })
      }, 2500)
      return () => clearTimeout(timer)
    }

    // Si terminó la carga inicial y no hay error explícito en URL, esperar margen de procesamiento
    if (!authLoading && !hasUrlError && !timedOut) {
      const fallbackTimer = setTimeout(() => {
        setTimedOut(true)
      }, 3000)
      return () => clearTimeout(fallbackTimer)
    }
  }, [user, authLoading, hasUrlError, timedOut, navigate])

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h2>Confirmación de cuenta</h2>
          <p className="auth-subtitle">{brandConfig.name}</p>
        </div>

        {status === 'verifying' && (
          <div className="auth-alert" style={{ textAlign: 'center', padding: '2rem 1rem' }}>
            <Loader2 className="btn-spinner animate-spin" size={36} style={{ margin: '0 auto 1rem' }} />
            <p>Verificando enlace de confirmación de tu correo electrónico...</p>
          </div>
        )}

        {status === 'success' && (
          <div className="auth-alert success-alert">
            <CheckCircle2 className="alert-icon" size={28} />
            <div>
              <h3>¡Cuenta confirmada con éxito!</h3>
              <p>Tu correo ha sido validado correctamente. Redirigiéndote a tu espacio personal...</p>
              <div style={{ marginTop: '1rem' }}>
                <Link to="/dashboard" className="btn-primary" style={{ display: 'inline-block' }}>
                  Ir al Dashboard ahora
                </Link>
              </div>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="auth-alert error-alert">
            <AlertCircle className="alert-icon" size={28} />
            <div>
              <h3>No pudimos verificar tu correo</h3>
              <p>El enlace de confirmación puede ser inválido o haber expirado.</p>
              <div style={{ marginTop: '1rem' }}>
                <Link to="/auth/login" className="btn-primary" style={{ display: 'inline-block' }}>
                  Ir a Iniciar Sesión
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, Navigate } from 'react-router-dom'
import { AlertCircle, Loader2 } from 'lucide-react'
import { brandConfig } from '../../config/brand.ts'
import { useAuth } from '../../context/AuthContext.tsx'

export function LoginPage() {
  const { user, signIn, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Redirigir si ya está autenticado
  if (!authLoading && user) {
    const destination = (location.state as { from?: { pathname?: string } })?.from?.pathname || '/dashboard'
    return <Navigate to={destination} replace />
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!email.trim() || !password) {
      setError('Por favor, ingresa tu correo y contraseña.')
      return
    }

    setLoading(true)

    try {
      const { error: signInError } = await signIn(email, password)

      if (signInError) {
        // Mensajes comprensibles en español para errores comunes de Supabase Auth
        if (signInError.message.includes('Invalid login credentials')) {
          setError('Credenciales inválidas. Verifica tu correo y contraseña.')
        } else if (signInError.message.includes('Email not confirmed')) {
          setError('Tu correo aún no ha sido confirmado. Por favor revisa tu bandeja de entrada.')
        } else {
          setError(signInError.message || 'Error al iniciar sesión. Intenta nuevamente.')
        }
        return
      }

      // Redirigir al destino previsto o al dashboard
      const destination = (location.state as { from?: { pathname?: string } })?.from?.pathname || '/dashboard'
      navigate(destination, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado al iniciar sesión.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h2>Iniciar sesión en {brandConfig.shortName}</h2>
          <p className="auth-subtitle">Ingresa a tu cuenta de {brandConfig.name}</p>
        </div>

        {error && (
          <div className="auth-alert error-alert" role="alert">
            <AlertCircle className="alert-icon" size={20} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Correo electrónico</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu_correo@ejemplo.com"
              required
              disabled={loading}
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              disabled={loading}
              autoComplete="current-password"
            />
          </div>

          <button type="submit" className="btn-primary auth-submit-btn" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="btn-spinner animate-spin" size={18} />
                <span>Iniciando sesión...</span>
              </>
            ) : (
              'Iniciar sesión'
            )}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            ¿No tienes una cuenta?{' '}
            <Link to="/auth/signup" className="auth-link">
              Regístrate aquí
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

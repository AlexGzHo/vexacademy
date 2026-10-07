import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { brandConfig } from '../../config/brand.ts'
import { useAuth } from '../../context/AuthContext.tsx'

export function SignupPage() {
  const { user, signUp, loading: authLoading } = useAuth()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [confirmationSent, setConfirmationSent] = useState(false)

  // Si ya tiene sesión activa, redirigir a dashboard
  if (!authLoading && user) {
    return <Navigate to="/dashboard" replace />
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!fullName.trim()) {
      setError('Por favor, ingresa tu nombre completo.')
      return
    }

    if (!email.trim()) {
      setError('Por favor, ingresa un correo electrónico válido.')
      return
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden. Por favor verifícalas.')
      return
    }

    setLoading(true)

    try {
      const { error: signUpError, needsEmailConfirmation } = await signUp(
        email,
        password,
        fullName,
      )

      if (signUpError) {
        setError(signUpError.message || 'Ocurrió un error al crear la cuenta.')
        return
      }

      if (needsEmailConfirmation) {
        setConfirmationSent(true)
      }
      // Si no requiere confirmación, onAuthStateChange detectará la sesión y el Navigate inicial actuará
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado al registrar usuario.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h2>Crear cuenta en {brandConfig.shortName}</h2>
          <p className="auth-subtitle">
            Comienza tu aprendizaje en {brandConfig.name}
          </p>
        </div>

        {confirmationSent ? (
          <div className="auth-alert success-alert" role="status">
            <CheckCircle2 className="alert-icon" size={24} />
            <div>
              <h3>¡Revisa tu bandeja de entrada!</h3>
              <p>
                Hemos enviado un correo de confirmación a <strong>{email}</strong>.
                Por favor, haz clic en el enlace del mensaje para verificar tu cuenta antes de iniciar sesión.
              </p>
              <div style={{ marginTop: '1rem' }}>
                <Link to="/auth/login" className="btn-primary" style={{ display: 'inline-block' }}>
                  Ir a Iniciar Sesión
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <>
            {error && (
              <div className="auth-alert error-alert" role="alert">
                <AlertCircle className="alert-icon" size={20} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="auth-form">
              <div className="form-group">
                <label htmlFor="fullName">Nombre completo</label>
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ej. Alex González"
                  required
                  disabled={loading}
                  autoComplete="name"
                />
              </div>

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
                  placeholder="Mínimo 6 caracteres"
                  required
                  disabled={loading}
                  autoComplete="new-password"
                />
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword">Confirmar contraseña</label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repite la contraseña"
                  required
                  disabled={loading}
                  autoComplete="new-password"
                />
              </div>

              <button type="submit" className="btn-primary auth-submit-btn" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="btn-spinner animate-spin" size={18} />
                    <span>Creando cuenta...</span>
                  </>
                ) : (
                  'Registrarse'
                )}
              </button>
            </form>

            <div className="auth-footer">
              <p>
                ¿Ya tienes una cuenta?{' '}
                <Link to="/auth/login" className="auth-link">
                  Inicia sesión
                </Link>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}


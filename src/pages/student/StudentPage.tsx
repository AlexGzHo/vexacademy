import { useAuth } from '../../context/AuthContext.tsx'
import { brandConfig } from '../../config/brand.ts'

export function StudentPage() {
  const { user, role } = useAuth()

  return (
    <section className="page-section">
      <div className="section-header">
        <h1>Área de Estudiante</h1>
        <p className="subtitle">
          Bienvenido a tu panel de aprendizaje en {brandConfig.name}.
        </p>
      </div>

      <div className="user-info-card">
        <h3>Sesión activa</h3>
        <p><strong>Usuario:</strong> {user?.email}</p>
        <p><strong>Rol asignado:</strong> <span className="badge">{role || 'student'}</span></p>
      </div>

      <div className="placeholder-box">
        <p>El catálogo y seguimiento de cursos se implementarán en las siguientes fases.</p>
      </div>
    </section>
  )
}

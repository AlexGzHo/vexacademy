import { useAuth } from '../../context/AuthContext.tsx'
import { brandConfig } from '../../config/brand.ts'

export function AdminPage() {
  const { user, role } = useAuth()

  return (
    <section className="page-section">
      <div className="section-header">
        <h1>Panel de Administración</h1>
        <p className="subtitle">
          Gestión central de la plataforma {brandConfig.name}.
        </p>
      </div>

      <div className="user-info-card">
        <h3>Sesión de Administrador</h3>
        <p><strong>Usuario:</strong> {user?.email}</p>
        <p><strong>Rol verificado:</strong> <span className="badge" style={{ backgroundColor: '#fef2f2', color: '#b91c1c' }}>{role}</span></p>
      </div>

      <div className="placeholder-box">
        <p>Los módulos de administración y gestión se desarrollarán en las siguientes fases.</p>
      </div>
    </section>
  )
}

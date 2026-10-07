import { Link } from 'react-router-dom'
import { brandConfig } from '../config/brand.ts'
import { useAuth } from '../context/AuthContext.tsx'

export function HomePage() {
  const { user } = useAuth()

  return (
    <section className="page-section">
      <div className="hero-banner">
        <h1>{brandConfig.name}</h1>
        <p className="subtitle">{brandConfig.tagline}</p>
        <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          {user ? (
            <Link to="/dashboard" className="btn-primary">
              Ir a mi Panel
            </Link>
          ) : (
            <>
              <Link to="/auth/signup" className="btn-primary">
                Comenzar ahora
              </Link>
              <Link to="/courses" className="btn-secondary">
                Explorar Cursos
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="cards-grid">
        <article className="info-card">
          <h2>Catálogo de Cursos</h2>
          <p>Rutas formativas prácticas en programación moderna, apps y flujos con IA.</p>
          <Link to="/courses" className="card-link">
            Ver catálogo &rarr;
          </Link>
        </article>

        <article className="info-card">
          <h2>Área de Estudiante</h2>
          <p>Panel privado para tus inscripciones, avances y recursos formativos.</p>
          <Link to="/student" className="card-link">
            Zona de alumnos &rarr;
          </Link>
        </article>

        <article className="info-card">
          <h2>Panel de Administración</h2>
          <p>Gestión restringida para administradores de {brandConfig.shortName}.</p>
          <Link to="/admin" className="card-link">
            Administración &rarr;
          </Link>
        </article>

        <article className="info-card">
          <h2>Acceso a la Cuenta</h2>
          <p>Inicia sesión o crea tu cuenta gratuita para acceder a la academia.</p>
          <Link to={user ? '/dashboard' : '/auth/login'} className="card-link">
            {user ? 'Ir al Dashboard &rarr;' : 'Ingresar / Registrarse &rarr;'}
          </Link>
        </article>
      </div>
    </section>
  )
}

import { Link } from 'react-router-dom'
import { brandConfig } from '../config/brand.ts'

export function HomePage() {
  return (
    <section className="page-section">
      <div className="hero-banner">
        <h1>{brandConfig.name}</h1>
        <p className="subtitle">{brandConfig.tagline}</p>
        <span className="badge">Routing operativo</span>
      </div>

      <div className="cards-grid">
        <article className="info-card">
          <h2>Explorar Cursos</h2>
          <p>Consulta la oferta académica y las rutas de aprendizaje disponibles.</p>
          <Link to="/courses" className="card-link">
            Ir a cursos &rarr;
          </Link>
        </article>

        <article className="info-card">
          <h2>Zona de Estudiante</h2>
          <p>Acceso al panel personal, progreso de cursos y recursos didácticos.</p>
          <Link to="/student" className="card-link">
            Ir a estudiante &rarr;
          </Link>
        </article>

        <article className="info-card">
          <h2>Panel de Administración</h2>
          <p>Gestión de contenidos, catálogo de cursos y administración de la academia.</p>
          <Link to="/admin" className="card-link">
            Ir a administración &rarr;
          </Link>
        </article>

        <article className="info-card">
          <h2>Autenticación</h2>
          <p>Entrada a la plataforma para estudiantes y docentes.</p>
          <Link to="/auth/login" className="card-link">
            Ir a acceso &rarr;
          </Link>
        </article>
      </div>
    </section>
  )
}


import { NavLink, Outlet } from 'react-router-dom'
import { brandConfig } from '../config/brand.ts'

export function Layout() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-inner">
          <NavLink to="/" className="brand-logo">
            {brandConfig.name}
          </NavLink>
          <nav className="main-nav">
            <NavLink
              to="/"
              end
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              Inicio
            </NavLink>
            <NavLink
              to="/courses"
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              Cursos
            </NavLink>
            <NavLink
              to="/student"
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              Estudiante
            </NavLink>
            <NavLink
              to="/admin"
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              Admin
            </NavLink>
            <NavLink
              to="/auth/login"
              className={({ isActive }) => (isActive ? 'nav-link nav-btn active' : 'nav-link nav-btn')}
            >
              Acceso
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="app-content">
        <Outlet />
      </main>

      <footer className="app-footer">
        <p>
          {brandConfig.name} &bull; Contacto:{' '}
          <a href={`mailto:${brandConfig.supportEmail}`}>{brandConfig.supportEmail}</a>
        </p>
      </footer>
    </div>
  )
}


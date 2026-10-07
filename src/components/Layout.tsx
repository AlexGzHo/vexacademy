import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LogOut, User } from 'lucide-react'
import { brandConfig } from '../config/brand.ts'
import { useAuth } from '../context/AuthContext.tsx'

export function Layout() {
  const { user, role, signOut, loading } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

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

            {!loading && user ? (
              <>
                <NavLink
                  to="/dashboard"
                  className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
                >
                  Dashboard
                </NavLink>

                {role === 'admin' && (
                  <NavLink
                    to="/admin"
                    className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
                  >
                    Admin
                  </NavLink>
                )}

                <div className="nav-user-info">
                  <span className="user-email" title={user.email || ''}>
                    <User size={15} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                    {user.email?.split('@')[0]}
                  </span>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="nav-btn-logout"
                    title="Cerrar sesión"
                  >
                    <LogOut size={15} />
                    <span>Salir</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <NavLink
                  to="/auth/login"
                  className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
                >
                  Ingresar
                </NavLink>
                <NavLink
                  to="/auth/signup"
                  className={({ isActive }) =>
                    isActive ? 'nav-link nav-btn active' : 'nav-link nav-btn'
                  }
                >
                  Registrarse
                </NavLink>
              </>
            )}
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

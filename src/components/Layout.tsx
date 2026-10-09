import { useState, useEffect } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { LogOut, User, Menu, X } from 'lucide-react'
import { brandConfig } from '../config/brand.ts'
import { useAuth } from '../context/AuthContext.tsx'
import { NotificationBell } from './NotificationBell.tsx'

export function Layout() {
  const { user, role, isPaymentReviewer, signOut, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Cerrar el menú móvil automáticamente cuando cambia la ruta
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  const handleSignOut = async () => {
    setMobileMenuOpen(false)
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

          {/* Navegación Escritorio (>= 768px) */}
          <nav className="main-nav desktop-nav">
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
                  to="/student"
                  className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
                >
                  Mis Cursos
                </NavLink>

                {(role === 'admin' || isPaymentReviewer) && (
                  <NavLink
                    to="/admin"
                    className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
                  >
                    {role === 'admin' ? 'Admin' : 'Pagos'}
                  </NavLink>
                )}

                <div className="nav-user-info" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <NotificationBell />
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

          {/* Acciones Móviles en la cabecera (< 768px) */}
          <div className="mobile-header-actions">
            {!loading && user && (
              <NotificationBell />
            )}
            <button
              type="button"
              className="mobile-nav-toggle"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* Menú desplegable Móvil (< 768px) */}
        {mobileMenuOpen && (
          <nav className="mobile-nav-drawer" aria-label="Navegación móvil">
            <NavLink
              to="/"
              end
              className={({ isActive }) => (isActive ? 'mobile-nav-link active' : 'mobile-nav-link')}
            >
              Inicio
            </NavLink>
            <NavLink
              to="/courses"
              className={({ isActive }) => (isActive ? 'mobile-nav-link active' : 'mobile-nav-link')}
            >
              Cursos
            </NavLink>

            {!loading && user ? (
              <>
                <NavLink
                  to="/student"
                  className={({ isActive }) => (isActive ? 'mobile-nav-link active' : 'mobile-nav-link')}
                >
                  Mis Cursos
                </NavLink>

                {(role === 'admin' || isPaymentReviewer) && (
                  <NavLink
                    to="/admin"
                    className={({ isActive }) => (isActive ? 'mobile-nav-link active' : 'mobile-nav-link')}
                  >
                    {role === 'admin' ? 'Admin' : 'Pagos'}
                  </NavLink>
                )}

                <div className="mobile-nav-divider" />

                <div className="mobile-nav-user">
                  <div className="mobile-user-info">
                    <User size={15} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                    <span>{user.email}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="mobile-btn-logout"
                  >
                    <LogOut size={16} />
                    <span>Cerrar sesión</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="mobile-nav-divider" />
                <div className="mobile-nav-auth-group">
                  <NavLink
                    to="/auth/login"
                    className="mobile-btn-auth mobile-btn-login"
                  >
                    Ingresar
                  </NavLink>
                  <NavLink
                    to="/auth/signup"
                    className="mobile-btn-auth mobile-btn-signup"
                  >
                    Registrarse
                  </NavLink>
                </div>
              </>
            )}
          </nav>
        )}
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

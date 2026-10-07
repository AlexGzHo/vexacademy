import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <section className="page-section">
      <div className="section-header">
        <h1>404</h1>
        <p className="subtitle">La página solicitada no existe.</p>
      </div>
      <p style={{ textAlign: 'center', marginTop: '1rem' }}>
        <Link to="/" className="card-link">
          Volver al inicio
        </Link>
      </p>
    </section>
  )
}


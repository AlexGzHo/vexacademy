import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BookOpen, Sparkles, Clock, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase.ts'
import type { Course } from '../types/index.ts'


interface FeaturedCourse extends Course {
  lessons_count: number
  modules_count: number
}

export function HomePage() {
  const [featuredCourses, setFeaturedCourses] = useState<FeaturedCourse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadFeaturedCourses() {
      try {
        setLoading(true)
        setError(null)

        const { data, error: fetchError } = await supabase
          .from('courses')
          .select(`
            *,
            modules (
              id,
              lessons (id)
            )
          `)
          .eq('is_published', true)
          .order('created_at', { ascending: false })
          .limit(3)

        if (fetchError) throw fetchError

        const formattedCourses: FeaturedCourse[] = (data || []).map((c: any) => {
          let lessonCount = 0
          if (c.modules) {
            c.modules.forEach((m: any) => {
              if (m.lessons) lessonCount += m.lessons.length
            })
          }
          return {
            ...c,
            lessons_count: lessonCount,
            modules_count: c.modules ? c.modules.length : 0,
          }
        })

        setFeaturedCourses(formattedCourses)
      } catch (err: any) {
        console.error('Error loading featured courses:', err)
        setError(err.message || 'No se pudieron cargar los cursos destacados.')
      } finally {
        setLoading(false)
      }
    }

    loadFeaturedCourses()
  }, [])

  return (
    <section className="home-page">
      {/* Editorial Hero */}
      <header className="hero">
        <div className="hero-content">
          <span className="hero-badge">
            <Sparkles size={12} aria-hidden="true" />
            Nueva temporada 2025
          </span>
          <h1 className="hero-title">
            Aprende a programar,<br />
            <span className="hero-title-accent">crea con IA</span>
          </h1>
          <p className="hero-description">
            Rutas formativas prácticas en desarrollo de software, aplicaciones móviles y flujos de trabajo con inteligencia artificial.
            Diseñadas para que avances a tu ritmo, con código real desde el primer día.
          </p>
          <div className="hero-actions">
            <Link to="/courses" className="btn-primary">
              Explorar catálogo
              <ArrowRight className="arrow" size={16} aria-hidden="true" />
            </Link>
            <Link to="/auth/signup" className="btn-secondary">
              Crear cuenta gratis
              <ArrowRight className="arrow" size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </header>

      {/* Featured Courses Section */}
      <section className="featured-section" aria-labelledby="featured-heading">
        <div className="section-header">
          <h2 id="featured-heading" className="section-title">Cursos destacados</h2>
          <p className="section-subtitle">
            Una selección de nuestros programas más recientes y mejor valorados.
          </p>
          <Link to="/courses" className="section-link">
            Ver todo el catálogo
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>

        {loading ? (
          <div className="courses-loading" role="status" aria-live="polite">
            <Loader2 size={32} className="animate-spin" style={{ color: 'var(--color-ember)' }} />
            <p>Cargando cursos destacados…</p>
          </div>
        ) : error ? (
          <div className="courses-error" role="alert">
            <p>No se pudieron cargar los cursos destacados.</p>
            <Link to="/courses" className="btn-ghost" style={{ marginTop: 'var(--space-3)' }}>
              Ir al catálogo completo
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
        ) : featuredCourses.length === 0 ? (
          <div className="courses-empty">
            <BookOpen size={48} aria-hidden="true" />
            <h3>Próximamente nuevos cursos</h3>
            <p>Estamos preparando nuevas rutas formativas. Vuelve a visitarnos pronto.</p>
            <Link to="/courses" className="btn-ghost" style={{ marginTop: 'var(--space-3)' }}>
              Ver catálogo
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <div className="courses-grid" role="list">
            {featuredCourses.map((course) => (
              <article key={course.id} className="course-card" role="listitem">
                <Link
                  to={`/courses/${course.id}`}
                  className="course-card-media"
                  aria-label={`Ver detalles de ${course.title}`}
                >
                  {course.thumbnail_url ? (
                    <img
                      src={course.thumbnail_url}
                      alt=""
                      className="course-card-image"
                      loading="lazy"
                    />
                  ) : (
                    <div className="course-card-placeholder" aria-hidden="true">
                      <BookOpen size={32} />
                    </div>
                  )}
                  <div className="course-card-badges">
                    <span className={`course-badge badge-${course.level.toLowerCase()}`}>
                      {course.level}
                    </span>
                    {course.is_free || course.price_pen === 0 ? (
                      <span className="course-badge badge-free">Gratis</span>
                    ) : (
                      <span className="course-badge badge-price">
                        S/ {Number(course.price_pen).toFixed(2)}
                      </span>
                    )}
                  </div>
                </Link>

                <div className="course-card-content">
                  <h3 className="course-card-title">
                    <Link to={`/courses/${course.id}`}>{course.title}</Link>
                  </h3>

                  <p className="course-card-description">
                    {course.description || 'Aprende los fundamentos y mejores prácticas en este curso especializado.'}
                  </p>

                  <div className="course-card-meta">
                    <span className="meta-item" title="Duración estimada">
                      <Clock size={14} aria-hidden="true" />
                      {course.duration || 'Flexible'}
                    </span>
                    {course.lessons_count > 0 && (
                      <span className="meta-item" title="Número de lecciones">
                        <BookOpen size={14} aria-hidden="true" />
                        {course.lessons_count} lecciones
                      </span>
                    )}
                  </div>

                  <Link
                    to={`/courses/${course.id}`}
                    className="course-card-cta"
                  >
                    Ver curso
                    <ArrowRight size={14} aria-hidden="true" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}

        {featuredCourses.length > 0 && (
          <div className="section-footer">
            <Link to="/courses" className="btn-secondary">
              Ver todos los cursos
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        )}
      </section>

      {/* Value Proposition Section */}
      <section className="values-section" aria-labelledby="values-heading">
        <h2 id="values-heading" className="visually-hidden">Por qué elegir VEX Academy</h2>
        <div className="values-grid">
          <article className="value-card">
            <div className="value-icon" aria-hidden="true">
              <Sparkles size={24} />
            </div>
            <h3 className="value-title">Enfoque práctico</h3>
            <p className="value-description">
              Código real, proyectos reales. Cada lección incluye ejercicios hands-on que refuerzan lo aprendido.
            </p>
          </article>

          <article className="value-card">
            <div className="value-icon" aria-hidden="true">
              <BookOpen size={24} />
            </div>
            <h3 className="value-title">Ritmo propio</h3>
            <p className="value-description">
              Acceso ilimitado y sin horarios. Avanza cuando quieras, desde cualquier dispositivo.
            </p>
          </article>

          <article className="value-card">
            <div className="value-icon" aria-hidden="true">
              <Clock size={24} />
            </div>
            <h3 className="value-title">Actualización continua</h3>
            <p className="value-description">
              Contenido revisado cada trimestre. Las tecnologías cambian rápido; nuestros cursos también.
            </p>
          </article>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section" aria-labelledby="cta-heading">
        <h2 id="cta-heading" className="cta-title">
          ¿Listo para empezar?
        </h2>
        <p className="cta-description">
          Crea tu cuenta gratuita en segundos y accede a la primera lección de cualquier curso sin compromiso.
        </p>
        <div className="cta-actions">
          <Link to="/auth/signup" className="btn-primary btn-lg">
            Crear mi cuenta gratis
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link to="/courses" className="btn-ghost btn-lg">
            Primero quiero explorar
          </Link>
        </div>
      </section>
    </section>
  )
}
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Clock, BookOpen, AlertCircle, Loader2, Sparkles } from 'lucide-react'
import { supabase } from '../../lib/supabase.ts'
import type { Course, CourseLevel } from '../../types/index.ts'

export function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [levelFilter, setLevelFilter] = useState<'all' | CourseLevel>('all')
  const [priceFilter, setPriceFilter] = useState<'all' | 'free' | 'paid'>('all')

  useEffect(() => {
    async function loadCourses() {
      try {
        setLoading(true)
        setError(null)

        // Consultar cursos publicados desde Supabase
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

        if (fetchError) throw fetchError

        // Calcular conteo de lecciones
        const formattedCourses: Course[] = (data || []).map((c: any) => {
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

        setCourses(formattedCourses)
      } catch (err: any) {
        console.error('Error cargando catálogo de cursos:', err)
        setError(err.message || 'Error al conectar con el catálogo de cursos.')
      } finally {
        setLoading(false)
      }
    }

    loadCourses()
  }, [])

  // Filtrado local
  const filteredCourses = courses.filter((course) => {
    const matchesSearch =
      course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (course.description && course.description.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesLevel = levelFilter === 'all' || course.level === levelFilter

    const matchesPrice =
      priceFilter === 'all' ||
      (priceFilter === 'free' && (course.is_free || course.price_pen === 0)) ||
      (priceFilter === 'paid' && !course.is_free && course.price_pen > 0)

    return matchesSearch && matchesLevel && matchesPrice
  })

  return (
    <section className="page-section">
      <div className="section-header">
        <div className="catalog-header-badge">
          <Sparkles size={14} />
          <span>Especialización Tecnológica</span>
        </div>
        <h1>Catálogo de Cursos</h1>
        <p className="subtitle">
          Domina desarrollo de software, inteligencia artificial y automatización con cursos prácticos y orientados a resultados.
        </p>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="catalog-filters-bar">
        <div className="catalog-search-box">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Buscar por título o contenido del curso..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="clear-search-btn"
              title="Limpiar búsqueda"
            >
              &times;
            </button>
          )}
        </div>

        <div className="catalog-filters-group">
          {/* Filtro de nivel */}
          <div className="filter-select-wrapper">
            <span className="filter-label">Nivel:</span>
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value as any)}
              className="filter-select"
            >
              <option value="all">Todos los niveles</option>
              <option value="Principiante">Principiante</option>
              <option value="Intermedio">Intermedio</option>
              <option value="Avanzado">Avanzado</option>
            </select>
          </div>

          {/* Filtro de precio */}
          <div className="filter-select-wrapper">
            <span className="filter-label">Precio:</span>
            <select
              value={priceFilter}
              onChange={(e) => setPriceFilter(e.target.value as any)}
              className="filter-select"
            >
              <option value="all">Todos los precios</option>
              <option value="free">Gratuitos</option>
              <option value="paid">De pago</option>
            </select>
          </div>
        </div>
      </div>

      {/* Estados de carga, error y listado */}
      {loading ? (
        <div className="catalog-loading-state">
          <Loader2 size={36} className="animate-spin text-primary" />
          <p>Cargando cursos disponibles...</p>
        </div>
      ) : error ? (
        <div className="auth-alert error-alert">
          <AlertCircle size={20} className="alert-icon" />
          <div>
            <strong>Error al cargar el catálogo:</strong> {error}
          </div>
        </div>
      ) : filteredCourses.length === 0 ? (
        <div className="catalog-empty-card">
          <BookOpen size={48} className="empty-icon" />
          <h3>No se encontraron cursos</h3>
          <p>
            {searchTerm || levelFilter !== 'all' || priceFilter !== 'all'
              ? 'Prueba modificando tus términos de búsqueda o los filtros aplicados.'
              : 'Aún no hay cursos publicados en la academia. Vuelve a visitarnos pronto.'}
          </p>
          {(searchTerm || levelFilter !== 'all' || priceFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('')
                setLevelFilter('all')
                setPriceFilter('all')
              }}
              className="btn-secondary"
              style={{ marginTop: '1rem' }}
            >
              Restablecer filtros
            </button>
          )}
        </div>
      ) : (
        <div className="courses-grid">
          {filteredCourses.map((course) => (
            <article key={course.id} className="course-card">
              <Link to={`/courses/${course.id}`} className="course-card-image-wrap">
                {course.thumbnail_url ? (
                  <img
                    src={course.thumbnail_url}
                    alt={course.title}
                    className="course-card-image"
                    loading="lazy"
                  />
                ) : (
                  <div className="course-card-image-placeholder">
                    <BookOpen size={40} />
                    <span>VEX ACADEMY</span>
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
                  <div className="meta-item" title="Duración estimada">
                    <Clock size={15} />
                    <span>{course.duration || 'Flexible'}</span>
                  </div>
                  {course.lessons_count !== undefined && course.lessons_count > 0 && (
                    <div className="meta-item" title="Número de lecciones">
                      <BookOpen size={15} />
                      <span>{course.lessons_count} lecciones</span>
                    </div>
                  )}
                </div>

                <div className="course-card-footer">
                  <div className="course-price-display">
                    {course.is_free || course.price_pen === 0 ? (
                      <span className="price-tag-free">Gratuito</span>
                    ) : (
                      <span className="price-tag-paid">
                        S/ {Number(course.price_pen).toFixed(2)}
                      </span>
                    )}
                  </div>

                  <Link to={`/courses/${course.id}`} className="btn-primary btn-sm">
                    Ver curso
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

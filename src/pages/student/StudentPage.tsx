import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BookOpen,
  Clock,
  PlayCircle,
  Loader2,
  AlertCircle,
  CheckCircle,
  CreditCard,
  XCircle,
  Bell,
  ArrowRight
} from 'lucide-react'
import { supabase } from '../../lib/supabase.ts'
import { useAuth } from '../../context/AuthContext.tsx'
import type { Course, Lesson, PaymentRequest } from '../../types/index.ts'
import { useRealTimeNotifications } from '../../hooks/useRealTimeNotifications.ts'

interface StudentEnrolledCourse {
  enrollmentId: string
  enrolledAt: string
  course: Course
  totalLessons: number
  completedLessons: number
  progressPercentage: number
  nextLessonId?: string
}

export function StudentPage() {
  const { user } = useAuth()
  const { notifications } = useRealTimeNotifications()
  const [enrolledCourses, setEnrolledCourses] = useState<StudentEnrolledCourse[]>([])
  const [myRequests, setMyRequests] = useState<PaymentRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadStudentData() {
      if (!user) return

      try {
        setLoading(true)
        setError(null)

        // 1. Consultar matrículas del estudiante
        const { data: enrollmentsData, error: enrollError } = await supabase
          .from('enrollments')
          .select(`
            id,
            enrolled_at,
            course_id,
            courses (
              id,
              title,
              description,
              thumbnail_url,
              level,
              duration,
              is_free,
              price_pen,
              is_published
            )
          `)
          .eq('user_id', user.id)
          .eq('status', 'active')
          .order('enrolled_at', { ascending: false })

        if (enrollError) throw enrollError

        if (!enrollmentsData || enrollmentsData.length === 0) {
          setEnrolledCourses([])
        } else {
          const courseIds = enrollmentsData.map((e: any) => e.course_id)

          // 2. Consultar todas las lecciones de estos cursos para calcular progreso y siguiente lección
          const { data: allLessonsData, error: lessonsError } = await supabase
            .from('lessons')
            .select('id, course_id, module_id, order_index, is_published')
            .in('course_id', courseIds)
            .eq('is_published', true)
            .order('order_index', { ascending: true })

          if (lessonsError) throw lessonsError

          // 3. Consultar progreso completado del usuario
          const { data: progressData, error: progressError } = await supabase
            .from('lesson_progress')
            .select('lesson_id, course_id, is_completed')
            .eq('user_id', user.id)
            .eq('is_completed', true)

          if (progressError) throw progressError

          const completedMap = new Map<string, Set<string>>()
          ;(progressData || []).forEach((p: any) => {
            if (!completedMap.has(p.course_id)) {
              completedMap.set(p.course_id, new Set())
            }
            completedMap.get(p.course_id)!.add(p.lesson_id)
          })

          // Agrupar lecciones por curso
          const lessonsByCourse = new Map<string, Lesson[]>()
          ;(allLessonsData || []).forEach((l: any) => {
            if (!lessonsByCourse.has(l.course_id)) {
              lessonsByCourse.set(l.course_id, [])
            }
            lessonsByCourse.get(l.course_id)!.push(l)
          })

          // 4. Calcular métricas consolidadas por curso
          const processed: StudentEnrolledCourse[] = enrollmentsData
            .filter((e: any) => !!e.courses)
            .map((e: any) => {
              const courseObj: Course = e.courses
              const courseLessons = lessonsByCourse.get(courseObj.id) || []
              const completedSet = completedMap.get(courseObj.id) || new Set<string>()

              const total = courseLessons.length
              const completed = completedSet.size
              const percentage = total > 0 ? Math.round((completed / total) * 100) : 0

              // Siguiente lección recomendada
              const nextIncomplete =
                courseLessons.find((l) => !completedSet.has(l.id)) || courseLessons[0]

              return {
                enrollmentId: e.id,
                enrolledAt: e.enrolled_at,
                course: courseObj,
                totalLessons: total,
                completedLessons: completed,
                progressPercentage: percentage,
                nextLessonId: nextIncomplete?.id,
              }
            })

          setEnrolledCourses(processed)
        }

        // 5. Consultar solicitudes de pago Yape/Plin del estudiante
        const { data: reqData } = await supabase
          .from('payment_requests')
          .select(`
            *,
            course:courses (
              id,
              title,
              price_pen
            )
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })

        setMyRequests(reqData || [])
      } catch (err: any) {
        console.error('Error al cargar panel del estudiante:', err)
        setError(err.message || 'Error al conectar con la base de datos de estudiante.')
      } finally {
        setLoading(false)
      }
    }

    loadStudentData()
  }, [user])

  const totalEnrolled = enrolledCourses.length
  const completedCoursesCount = enrolledCourses.filter((c) => c.progressPercentage === 100).length
  const inProgressCoursesCount = enrolledCourses.filter(
    (c) => c.progressPercentage > 0 && c.progressPercentage < 100,
  ).length
  const totalCompletedLessons = enrolledCourses.reduce((acc, c) => acc + c.completedLessons, 0)

  // Encontrar el curso principal para el Hero (el que está en progreso con mayor porcentaje que no sea 100)
  // Si no hay, buscar el último matriculado con 0%. Si todos al 100%, mostrar el último completado.
  const getHeroCourse = () => {
    if (enrolledCourses.length === 0) return null

    const inProgress = enrolledCourses.filter((c) => c.progressPercentage > 0 && c.progressPercentage < 100)
    if (inProgress.length > 0) {
      // Ordenar por porcentaje completado descendente
      return inProgress.sort((a, b) => b.progressPercentage - a.progressPercentage)[0]
    }

    const notStarted = enrolledCourses.filter((c) => c.progressPercentage === 0)
    if (notStarted.length > 0) {
      return notStarted[0]
    }

    return enrolledCourses[0] // El primero (más reciente o completado)
  }

  const heroCourse = getHeroCourse()

  const recentNotifications = notifications.slice(0, 3)
  const recentPayments = myRequests.slice(0, 3)

  return (
    <div className="student-dashboard-container">
      {/* Encabezado Principal Limpio */}
      <header className="student-header">
        <div className="student-header-text">
          <h1 className="student-page-title">Mi aprendizaje</h1>
          <p className="student-page-subtitle">Continúa desarrollando tus habilidades.</p>
        </div>

        {totalEnrolled > 0 && (
          <div className="student-inline-stats">
            <span><strong>{totalEnrolled}</strong> {totalEnrolled === 1 ? 'curso' : 'cursos'}</span>
            <span className="stat-separator">&bull;</span>
            <span><strong>{inProgressCoursesCount}</strong> en progreso</span>
            <span className="stat-separator">&bull;</span>
            <span><strong>{completedCoursesCount}</strong> completados</span>
            <span className="stat-separator">&bull;</span>
            <span><strong>{totalCompletedLessons}</strong> lecciones</span>
          </div>
        )}
      </header>

      {loading ? (
        <div className="catalog-loading-state" style={{ margin: '3rem 0' }}>
          <Loader2 size={32} className="animate-spin text-primary" />
          <p>Cargando cursos...</p>
        </div>
      ) : error ? (
        <div className="auth-alert error-alert" style={{ margin: '2rem 0' }}>
          <AlertCircle size={20} className="alert-icon" />
          <div>{error}</div>
        </div>
      ) : (
        <div className="student-learning-flow">
          {/* Bloque Dominante: Continúa aprendiendo (Hero) */}
          {heroCourse ? (
            <section className="student-hero-section">
              <div className="learning-hero-card">
                <div className="learning-hero-media">
                  {heroCourse.course.thumbnail_url ? (
                    <img
                      src={heroCourse.course.thumbnail_url}
                      alt={heroCourse.course.title}
                      className="learning-hero-img"
                    />
                  ) : (
                    <div className="learning-hero-placeholder">
                      <BookOpen size={40} />
                    </div>
                  )}
                </div>

                <div className="learning-hero-content">
                  <div className="learning-hero-badge">
                    {heroCourse.progressPercentage > 0 && heroCourse.progressPercentage < 100 
                      ? 'Continúa donde te quedaste'
                      : heroCourse.progressPercentage === 0
                        ? 'Empieza tu aprendizaje'
                        : 'Curso completado'}
                  </div>

                  <h2 className="learning-hero-title">{heroCourse.course.title}</h2>
                  
                  {heroCourse.course.description && (
                    <p className="learning-hero-desc">
                      {heroCourse.course.description}
                    </p>
                  )}

                  <div className="learning-hero-progress-block">
                    <div className="learning-progress-info">
                      <span className="progress-lessons">
                        {heroCourse.completedLessons} de {heroCourse.totalLessons} lecciones completadas
                      </span>
                      <span className="progress-percentage">
                        {heroCourse.progressPercentage}%
                      </span>
                    </div>

                    <div className="learning-progress-bar-bg">
                      <div
                        className="learning-progress-bar-fill"
                        style={{ width: `${heroCourse.progressPercentage}%` }}
                      />
                    </div>
                  </div>

                  <div className="learning-hero-action">
                    {heroCourse.nextLessonId ? (
                      <Link
                        to={`/courses/${heroCourse.course.id}/lessons/${heroCourse.nextLessonId}`}
                        className="btn-primary learning-hero-cta"
                      >
                        <PlayCircle size={18} />
                        {heroCourse.progressPercentage > 0 && heroCourse.progressPercentage < 100
                          ? 'Continuar curso'
                          : heroCourse.progressPercentage === 100
                            ? 'Repasar curso'
                            : 'Iniciar curso'}
                      </Link>
                    ) : (
                      <Link to={`/courses/${heroCourse.course.id}`} className="btn-secondary">
                        Ver temario
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </section>
          ) : (
            <section className="student-hero-section">
              <div className="learning-hero-empty">
                <div className="empty-hero-icon">
                  <BookOpen size={32} />
                </div>
                <h3>Aún no tienes cursos inscritos</h3>
                <p>Explora el catálogo para comenzar a aprender hoy.</p>
                <Link to="/courses" className="btn-primary" style={{ marginTop: '1rem' }}>
                  Explorar catálogo de cursos
                </Link>
              </div>
            </section>
          )}

          {/* Sección: Mis Cursos (Filas horizontales compactas estilo Codecademy/Coursera) */}
          {enrolledCourses.length > 1 && (
            <section className="student-courses-section">
              <div className="section-title-wrap">
                <h3 className="section-title-clean">Mis cursos activos</h3>
              </div>

              <div className="course-rows-container">
                {enrolledCourses
                  .filter((c) => c.enrollmentId !== heroCourse?.enrollmentId)
                  .map((item) => {
                    const { course, totalLessons, completedLessons, progressPercentage, nextLessonId } = item

                    return (
                      <div key={item.enrollmentId} className="course-progress-row">
                        <div className="course-row-thumb">
                          {course.thumbnail_url ? (
                            <img src={course.thumbnail_url} alt={course.title} />
                          ) : (
                            <div className="course-row-thumb-fallback">
                              <BookOpen size={20} />
                            </div>
                          )}
                        </div>

                        <div className="course-row-main">
                          <div className="course-row-header">
                            <Link to={`/courses/${course.id}`} className="course-row-title">
                              {course.title}
                            </Link>
                            {course.level && (
                              <span className={`course-badge badge-${course.level.toLowerCase()}`}>
                                {course.level}
                              </span>
                            )}
                          </div>

                          <div className="course-row-progress-wrap">
                            <div className="course-row-bar-bg">
                              <div
                                className="course-row-bar-fill"
                                style={{ width: `${progressPercentage}%` }}
                              />
                            </div>
                            <span className="course-row-progress-text">
                              {progressPercentage}% &bull; {completedLessons} de {totalLessons} lecciones
                            </span>
                          </div>
                        </div>

                        <div className="course-row-cta">
                          {nextLessonId ? (
                            <Link
                              to={`/courses/${course.id}/lessons/${nextLessonId}`}
                              className="btn-secondary btn-sm"
                            >
                              <span>
                                {progressPercentage > 0 && progressPercentage < 100
                                  ? 'Continuar'
                                  : progressPercentage === 100
                                    ? 'Repasar'
                                    : 'Iniciar'}
                              </span>
                              <ArrowRight size={14} />
                            </Link>
                          ) : (
                            <Link to={`/courses/${course.id}`} className="btn-secondary btn-sm">
                              Ver temario
                            </Link>
                          )}
                        </div>
                      </div>
                    )
                  })}
              </div>
            </section>
          )}

          {/* Información Secundaria Discreta: Actividad y Estado de Pagos */}
          <section className="student-secondary-section">
            <div className="student-secondary-grid">
              {/* Notificaciones / Novedades */}
              <div className="secondary-card">
                <div className="secondary-card-header">
                  <div className="secondary-card-title">
                    <Bell size={15} />
                    <span>Últimas novedades</span>
                  </div>
                </div>

                <div className="secondary-card-body">
                  {recentNotifications.length > 0 ? (
                    <div className="secondary-notifications-list">
                      {recentNotifications.map((n) => (
                        <div key={n.id} className="secondary-notification-item">
                          <div className="secondary-item-dot" />
                          <div className="secondary-item-text">
                            <h5>{n.title}</h5>
                            <p>{n.message}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="secondary-empty-text">Sin novedades recientes.</p>
                  )}
                </div>
              </div>

              {/* Estado de Pagos */}
              <div className="secondary-card">
                <div className="secondary-card-header">
                  <div className="secondary-card-title">
                    <CreditCard size={15} />
                    <span>Estado de pagos</span>
                  </div>
                </div>

                <div className="secondary-card-body">
                  {recentPayments.length > 0 ? (
                    <div className="secondary-payments-list">
                      {recentPayments.map((req) => (
                        <div key={req.id} className="secondary-payment-item">
                          <div className="secondary-payment-info">
                            <span className="secondary-payment-course">
                              {req.course?.title || 'Curso VEX'}
                            </span>
                            <span className="secondary-payment-meta">
                              {new Date(req.created_at).toLocaleDateString('es-PE', {
                                day: '2-digit',
                                month: 'short',
                              })}{' '}
                              &bull; {req.payment_method ? req.payment_method.toUpperCase() : 'PAGO'}
                            </span>
                          </div>
                          <div className="secondary-payment-badge-wrap">
                            <span className="secondary-payment-price">
                              S/ {Number(req.amount_pen).toFixed(2)}
                            </span>
                            <span className={`status-pill status-${req.status}`}>
                              {req.status === 'pending'
                                ? 'En revisión'
                                : req.status === 'approved'
                                  ? 'Aprobado'
                                  : 'Rechazado'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="secondary-empty-text">No registras solicitudes recientes.</p>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Historial Completo de Pagos (Desplegable discreto) */}
      {!loading && !error && myRequests.length > 0 && (
        <details className="payments-history-details">
          <summary className="payments-history-summary">
            <CreditCard size={18} />
            Ver historial completo de solicitudes de pago
          </summary>
          <div className="admin-table-container" style={{ border: 'none', margin: 0, borderRadius: 0 }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Curso</th>
                  <th>Método / Importe</th>
                  <th>Fecha de Envío</th>
                  <th>Estado de la Solicitud</th>
                  <th>Detalles / Observaciones</th>
                </tr>
              </thead>
              <tbody>
                {myRequests.map((req) => (
                  <tr key={req.id}>
                    <td>
                      <strong>{req.course?.title || 'Curso VEX'}</strong>
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          background: req.payment_method === 'yape' ? '#71277a' : '#00a4e4',
                          color: 'white',
                          fontWeight: 700,
                          fontSize: '0.7rem',
                          marginRight: '0.35rem',
                        }}
                      >
                        {req.payment_method.toUpperCase()}
                      </span>
                      <strong>S/ {Number(req.amount_pen).toFixed(2)}</strong>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.85rem' }}>
                        {new Date(req.created_at).toLocaleDateString('es-PE', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </td>
                    <td>
                      {req.status === 'pending' && (
                        <span className="badge badge-preview" style={{ background: '#fef3c7', color: '#92400e' }}>
                          <Clock size={12} style={{ marginRight: '4px' }} />
                          En revisión
                        </span>
                      )}
                      {req.status === 'approved' && (
                        <span className="badge badge-preview" style={{ background: '#dcfce7', color: '#166534' }}>
                          <CheckCircle size={12} style={{ marginRight: '4px' }} />
                          Aprobado
                        </span>
                      )}
                      {req.status === 'rejected' && (
                        <span className="badge badge-preview" style={{ background: '#ffe4e6', color: '#9f1239' }}>
                          <XCircle size={12} style={{ marginRight: '4px' }} />
                          Rechazado
                        </span>
                      )}
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>
                      {req.status === 'pending' && (
                        <span className="text-muted">Comprobante en cola de verificación.</span>
                      )}
                      {req.status === 'approved' && (
                        <span className="text-success font-semibold">¡Pago verificado!</span>
                      )}
                      {req.status === 'rejected' && (
                        <span className="text-danger">
                          Motivo: <em>{req.rejection_reason || 'Comprobante no verificado.'}</em>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  )
}

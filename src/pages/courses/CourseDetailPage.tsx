import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  Clock,
  BookOpen,
  CheckCircle,
  CheckCircle2,
  PlayCircle,
  Lock,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Loader2,
  Sparkles,
  CreditCard,
  ShieldCheck,
  Layers,
} from 'lucide-react'
import { supabase } from '../../lib/supabase.ts'
import { useAuth } from '../../context/AuthContext.tsx'
import { PaymentRequestModal } from '../../components/payment/PaymentRequestModal.tsx'
import { MarkdownRenderer } from '../../components/common/MarkdownRenderer.tsx'
import type { Course, Module, Lesson, Enrollment, PaymentRequest } from '../../types/index.ts'

function formatDuration(minutes: number): string {
  if (!minutes || minutes <= 0) return ''
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  if (hours > 0 && remainingMinutes > 0) {
    return `${hours}h ${remainingMinutes}m`
  }
  if (hours > 0) {
    return `${hours}h`
  }
  return `${remainingMinutes}m`
}

function stripMarkdown(text: string): string {
  return text
    // Eliminar bloques de código
    .replace(/```[\s\S]*?```/g, '')
    // Eliminar encabezados # ## ###
    .replace(/^#+\s+/gm, '')
    // Eliminar citas >
    .replace(/^>\s+/gm, '')
    // Convertir enlaces [texto](url) en texto
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Eliminar negritas **texto** y __texto__
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    // Eliminar cursivas *texto* y _texto_
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    // Eliminar código inline `codigo`
    .replace(/`([^`]+)`/g, '$1')
    // Eliminar viñetas
    .replace(/^[\*\-+]\s+/gm, '')
    // Eliminar listas numeradas
    .replace(/^\d+\.\s+/gm, '')
    // Normalizar espacios múltiples y saltos
    .replace(/\s+/g, ' ')
    .trim()
}

function getLeadSummary(description?: string | null): string {
  if (!description) {
    return 'Domina esta tecnología paso a paso con lecciones guiadas y ejercicios prácticos.'
  }
  // Tomar el texto sin bloques de código
  const noCode = description.replace(/```[\s\S]*?```/g, '').trim()
  const paragraphs = noCode.split(/\n\s*\n/)
  // Buscar el primer párrafo descriptivo significativo
  let leadText = ''
  for (const para of paragraphs) {
    const cleanedPara = para.replace(/^#+\s+[^\n]+/g, '').trim()
    if (cleanedPara.length > 20) {
      leadText = cleanedPara
      break
    }
  }
  if (!leadText) {
    leadText = noCode.replace(/^#+\s+/gm, '').trim()
  }
  const clean = stripMarkdown(leadText)
  if (!clean) {
    return 'Domina esta tecnología paso a paso con lecciones guiadas y ejercicios prácticos.'
  }
  if (clean.length <= 220) {
    return clean
  }
  return clean.slice(0, 217).trim() + '...'
}

export function CourseDetailPage() {
  const { courseId } = useParams<{ courseId: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [course, setCourse] = useState<Course | null>(null)
  const [modules, setModules] = useState<Module[]>([])
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null)
  const [pendingPaymentRequest, setPendingPaymentRequest] = useState<PaymentRequest | null>(null)
  const [completedLessonIds, setCompletedLessonIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [enrolling, setEnrolling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({})
  const [showPaymentModal, setShowPaymentModal] = useState(false)

  useEffect(() => {
    async function loadCourseDetail() {
      if (!courseId) return

      try {
        setLoading(true)
        setError(null)

        // 1. Obtener datos del curso
        const { data: courseData, error: courseError } = await supabase
          .from('courses')
          .select('*')
          .eq('id', courseId)
          .maybeSingle()

        if (courseError) throw courseError

        if (!courseData) {
          setError('El curso solicitado no existe o no se encuentra disponible.')
          return
        }

        setCourse(courseData)

        // 2. Obtener módulos y lecciones publicadas
        const { data: modulesData, error: modulesError } = await supabase
          .from('modules')
          .select(`
            *,
            lessons (
              id,
              module_id,
              course_id,
              title,
              description,
              duration_minutes,
              order_index,
              is_published,
              is_preview
            )
          `)
          .eq('course_id', courseId)
          .eq('is_published', true)
          .order('order_index', { ascending: true })

        if (modulesError) throw modulesError

        const sortedModules: Module[] = (modulesData || []).map((m: any) => ({
          ...m,
          lessons: (m.lessons || [])
            .filter((l: Lesson) => l.is_published)
            .sort((a: Lesson, b: Lesson) => a.order_index - b.order_index),
        }))

        setModules(sortedModules)

        let targetModuleId = sortedModules[0]?.id

        // 3. Si el usuario está autenticado, consultar matrícula y progreso
        if (user) {
          const { data: enrollmentData } = await supabase
            .from('enrollments')
            .select('*')
            .eq('course_id', courseId)
            .eq('user_id', user.id)
            .eq('status', 'active')
            .maybeSingle()

          setEnrollment(enrollmentData || null)

          // 3b. Consultar si tiene solicitud de pago Yape/Plin pendiente
          const { data: pendingReqData } = await supabase
            .from('payment_requests')
            .select('*')
            .eq('course_id', courseId)
            .eq('user_id', user.id)
            .eq('status', 'pending')
            .maybeSingle()

          setPendingPaymentRequest(pendingReqData || null)

          if (enrollmentData) {
            const { data: progressData } = await supabase
              .from('lesson_progress')
              .select('lesson_id, is_completed')
              .eq('course_id', courseId)
              .eq('user_id', user.id)
              .eq('is_completed', true)

            if (progressData) {
              const completedSet = new Set(progressData.map((p: any) => p.lesson_id as string))
              setCompletedLessonIds(completedSet)

              // Abrir por defecto el módulo que contiene la siguiente lección pendiente
              const activeMod = sortedModules.find((m: Module) =>
                (m.lessons || []).some((l: Lesson) => !completedSet.has(l.id))
              )
              if (activeMod) {
                targetModuleId = activeMod.id
              }
            }
          }
        }

        // Acordeón: solo el módulo objetivo abierto por defecto
        const initialExpanded: Record<string, boolean> = {}
        if (targetModuleId) {
          initialExpanded[targetModuleId] = true
        }
        setExpandedModules(initialExpanded)

      } catch (err: any) {
        console.error('Error cargando detalle del curso:', err)
        setError(err.message || 'Error al conectar con el servidor.')
      } finally {
        setLoading(false)
      }
    }

    loadCourseDetail()
  }, [courseId, user])

  // Obtener primera lección para iniciar
  const allLessons: Lesson[] = modules.flatMap((m): Lesson[] => m.lessons ?? [])
  const firstLesson: Lesson | undefined = allLessons[0]

  // Encontrar la primera lección no completada si está matriculado
  const nextIncompleteLesson: Lesson | undefined =
    allLessons.find((l) => !completedLessonIds.has(l.id)) ?? firstLesson

  // Cálculo de duración acumulada
  const totalDurationMinutes = allLessons.reduce(
    (acc, l) => acc + (l.duration_minutes || 0),
    0
  )
  const totalDurationFormatted = formatDuration(totalDurationMinutes)

  // Resumen lead derivado
  const leadSummary = getLeadSummary(course?.description)

  // Matrícula gratuita
  const handleEnrollFree = async () => {
    if (!user) {
      navigate(`/auth/login?redirect=/courses/${courseId}`)
      return
    }

    if (!course) return

    try {
      setEnrolling(true)
      setError(null)

      const { error: rpcError } = await supabase.rpc('enroll_in_free_course', {
        p_course_id: course.id,
      })

      if (rpcError) throw rpcError

      const { data: newEnrollment } = await supabase
        .from('enrollments')
        .select('*')
        .eq('course_id', course.id)
        .eq('user_id', user.id)
        .single()

      setEnrollment(newEnrollment)

      if (firstLesson) {
        navigate(`/courses/${course.id}/lessons/${firstLesson.id}`)
      }
    } catch (err: any) {
      console.error('Error durante la matrícula gratuita:', err)
      setError(err.message || 'No fue posible completar la matrícula.')
    } finally {
      setEnrolling(false)
    }
  }

  const toggleModule = (moduleId: string) => {
    setExpandedModules((prev) => ({
      ...prev,
      [moduleId]: !prev[moduleId],
    }))
  }

  const areAllExpanded =
    modules.length > 0 && modules.every((m) => !!expandedModules[m.id])

  const handleToggleAllModules = () => {
    if (areAllExpanded) {
      setExpandedModules({})
    } else {
      const all: Record<string, boolean> = {}
      modules.forEach((m) => {
        all[m.id] = true
      })
      setExpandedModules(all)
    }
  }

  if (loading) {
    return (
      <div className="catalog-loading-state" style={{ minHeight: '60vh' }}>
        <Loader2 size={36} className="animate-spin text-primary" />
        <p>Cargando información del curso...</p>
      </div>
    )
  }

  if (error || !course) {
    return (
      <div className="page-section">
        <Link to="/courses" className="back-link">
          <ArrowLeft size={16} />
          <span>Volver al catálogo</span>
        </Link>
        <div className="auth-alert error-alert" style={{ marginTop: '1rem' }}>
          <AlertCircle size={20} className="alert-icon" />
          <div>{error || 'El curso no existe.'}</div>
        </div>
      </div>
    )
  }

  const totalLessonsCount = allLessons.length
  const progressPercentage =
    totalLessonsCount > 0
      ? Math.round((completedLessonIds.size / totalLessonsCount) * 100)
      : 0

  return (
    <div className="course-detail-container">
      {/* Navegación y enlace de retorno */}
      <nav className="course-detail-nav">
        <Link to="/courses" className="back-link">
          <ArrowLeft size={16} />
          <span>Volver al catálogo de cursos</span>
        </Link>
      </nav>

      {/* Cabecera del Curso (Header Compacto) */}
      <header className="course-detail-header-card">
        <div className="course-header-main">
          <div className="course-badges-row">
            <span className={`course-badge badge-${course.level.toLowerCase()}`}>
              {course.level}
            </span>
            {enrollment ? (
              <span className="course-badge badge-enrolled">
                <CheckCircle2 size={13} style={{ marginRight: '4px' }} />
                Matriculado
              </span>
            ) : course.is_free || course.price_pen === 0 ? (
              <span className="course-badge badge-free">Gratuito</span>
            ) : (
              <span className="course-badge badge-price">
                S/ {Number(course.price_pen).toFixed(2)}
              </span>
            )}
          </div>

          <h1 className="course-detail-title">{course.title}</h1>

          <p className="course-detail-lead">{leadSummary}</p>

          <div className="course-meta-pills">
            {course.duration && (
              <div className="meta-pill">
                <Clock size={15} />
                <span>{course.duration}</span>
              </div>
            )}
            <div className="meta-pill">
              <Layers size={15} />
              <span>
                {modules.length} {modules.length === 1 ? 'módulo' : 'módulos'}
              </span>
            </div>
            <div className="meta-pill">
              <BookOpen size={15} />
              <span>
                {totalLessonsCount} {totalLessonsCount === 1 ? 'lección' : 'lecciones'}
              </span>
            </div>
            {totalDurationFormatted && (
              <div className="meta-pill">
                <Clock size={15} />
                <span>{totalDurationFormatted} de contenido</span>
              </div>
            )}
            <div className="meta-pill">
              <Sparkles size={15} />
              <span>Acceso ilimitado</span>
            </div>
          </div>
        </div>
      </header>

      {/* Distribución de 2 Columnas: Contenido Principal + Tarjeta Lateral Sticky */}
      <div className="course-detail-layout">
        {/* Columna Principal (Izquierda) */}
        <div className="course-main-content">
          {/* Sección 1: Acerca de este curso */}
          <section className="course-content-card course-about-section">
            <div className="section-header-block">
              <h2 className="section-title">Acerca de este curso</h2>
            </div>
            <div className="course-about-body">
              <MarkdownRenderer
                content={course.description}
                emptyMessage="Este curso no tiene una descripción detallada por el momento."
              />
            </div>
          </section>

          {/* Sección 2: Temario y Contenido del Curso */}
          <section className="course-content-card course-curriculum-section">
            <div className="curriculum-header-bar">
              <div>
                <h2 className="section-title">Contenido del curso</h2>
                <p className="curriculum-meta-sub">
                  {modules.length} módulos &bull; {totalLessonsCount} lecciones
                  {totalDurationFormatted && ` &bull; ${totalDurationFormatted} en total`}
                </p>
              </div>

              {modules.length > 0 && (
                <button
                  type="button"
                  onClick={handleToggleAllModules}
                  className="btn-toggle-all-modules"
                >
                  {areAllExpanded ? 'Contraer todos' : 'Expandir todos'}
                </button>
              )}
            </div>

            {modules.length === 0 ? (
              <div className="placeholder-box">
                <p>El temario de este curso se encuentra en proceso de estructuración.</p>
              </div>
            ) : (
              <div className="modules-accordion">
                {modules.map((mod, moduleIdx) => {
                  const isExpanded = !!expandedModules[mod.id]
                  const moduleLessons = mod.lessons || []
                  const moduleDuration = moduleLessons.reduce(
                    (sum, l) => sum + (l.duration_minutes || 0),
                    0
                  )
                  const completedInModule = moduleLessons.filter((l) =>
                    completedLessonIds.has(l.id)
                  ).length

                  return (
                    <div key={mod.id} className="module-item-card">
                      <button
                        type="button"
                        onClick={() => toggleModule(mod.id)}
                        className="module-item-header"
                        aria-expanded={isExpanded}
                      >
                        <div className="module-title-wrap">
                          <span className="module-index-badge">Módulo {moduleIdx + 1}</span>
                          <h3 className="module-title">{mod.title}</h3>
                        </div>

                        <div className="module-meta-wrap">
                          {enrollment && moduleLessons.length > 0 && (
                            <span className="module-progress-chip">
                              {completedInModule}/{moduleLessons.length}
                            </span>
                          )}
                          <span className="module-lessons-count">
                            {moduleLessons.length}{' '}
                            {moduleLessons.length === 1 ? 'lección' : 'lecciones'}
                            {moduleDuration > 0 && ` • ${formatDuration(moduleDuration)}`}
                          </span>
                          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </div>
                      </button>

                      {mod.description && isExpanded && (
                        <div className="module-desc">{mod.description}</div>
                      )}

                      {isExpanded && (
                        <div className="module-lessons-list">
                          {moduleLessons.length === 0 ? (
                            <div className="empty-module-notice">
                              Sin lecciones agregadas en este módulo todavía.
                            </div>
                          ) : (
                            moduleLessons.map((lesson, lessonIdx) => {
                              const isCompleted = completedLessonIds.has(lesson.id)
                              const canAccess = !!enrollment || !!lesson.is_preview

                              return (
                                <div
                                  key={lesson.id}
                                  className={`lesson-row-item ${
                                    canAccess ? 'accessible' : 'locked'
                                  } ${isCompleted ? 'completed' : ''}`}
                                >
                                  <div className="lesson-row-left">
                                    <span className="lesson-order-num">{lessonIdx + 1}</span>
                                    {isCompleted ? (
                                      <CheckCircle
                                        size={18}
                                        className="text-success flex-shrink-0"
                                      />
                                    ) : canAccess ? (
                                      <PlayCircle
                                        size={18}
                                        className="text-primary flex-shrink-0"
                                      />
                                    ) : (
                                      <Lock
                                        size={16}
                                        className="text-muted flex-shrink-0"
                                      />
                                    )}

                                    <div className="lesson-row-info">
                                      <span className="lesson-row-title">{lesson.title}</span>
                                      {lesson.description && (
                                        <span className="lesson-row-subtitle">
                                          {lesson.description}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="lesson-row-right">
                                    {lesson.duration_minutes > 0 && (
                                      <span className="lesson-duration">
                                        <Clock size={13} style={{ marginRight: '3px' }} />
                                        {lesson.duration_minutes} min
                                      </span>
                                    )}

                                    {lesson.is_preview && (
                                      <span className="badge badge-preview">
                                        Vista previa
                                      </span>
                                    )}

                                    {canAccess ? (
                                      <Link
                                        to={`/courses/${course.id}/lessons/${lesson.id}`}
                                        className="btn-secondary btn-xs lesson-action-btn"
                                      >
                                        {lesson.is_preview && !enrollment
                                          ? 'Ver previa'
                                          : isCompleted
                                          ? 'Repasar'
                                          : 'Iniciar'}
                                      </Link>
                                    ) : (
                                      <span className="locked-pill" title="Requiere matrícula">
                                        <Lock size={12} />
                                        <span>Bloqueado</span>
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )
                            })
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>

        {/* Columna Lateral Sticky (Derecha) */}
        <aside className="course-sidebar">
          <div className="course-sticky-card">
            {/* Miniatura del curso */}
            <div className="sidebar-thumbnail-wrap">
              {course.thumbnail_url ? (
                <img
                  src={course.thumbnail_url}
                  alt={course.title}
                  className="sidebar-thumbnail"
                />
              ) : (
                <div className="sidebar-thumbnail-placeholder">
                  <BookOpen size={48} />
                  <span>VEX ACADEMY</span>
                </div>
              )}
            </div>

            {/* Cuerpo de acción según estado */}
            <div className="sidebar-card-body">
              {enrollment ? (
                /* ESTADO 1: MATRICULADO */
                <div className="sidebar-enrolled-state">
                  <div className="enrolled-status-badge">
                    <CheckCircle2 size={18} className="text-success" />
                    <span>Estás matriculado en este curso</span>
                  </div>

                  <div className="sidebar-progress-panel">
                    <div className="progress-header-row">
                      <span>Tu avance:</span>
                      <strong>
                        {completedLessonIds.size} de {totalLessonsCount} ({progressPercentage}%)
                      </strong>
                    </div>
                    <div className="progress-bar-bg">
                      <div
                        className="progress-bar-fill"
                        style={{ width: `${progressPercentage}%` }}
                      />
                    </div>
                  </div>

                  {nextIncompleteLesson ? (
                    <div className="sidebar-cta-group">
                      <Link
                        to={`/courses/${course.id}/lessons/${nextIncompleteLesson.id}`}
                        className="btn-primary btn-block btn-lg"
                      >
                        <PlayCircle size={18} style={{ marginRight: '8px' }} />
                        {completedLessonIds.size > 0 ? 'Continuar aprendiendo' : 'Empezar curso'}
                      </Link>
                      <span className="next-lesson-hint">
                        Siguiente: {nextIncompleteLesson.title}
                      </span>
                    </div>
                  ) : (
                    <div className="sidebar-cta-group">
                      <Link
                        to={`/courses/${course.id}/lessons/${firstLesson?.id}`}
                        className="btn-secondary btn-block btn-lg"
                      >
                        <CheckCircle size={18} style={{ marginRight: '8px' }} />
                        Repasar curso completo
                      </Link>
                      <span className="course-completed-hint">
                        ¡Has completado todas las lecciones!
                      </span>
                    </div>
                  )}
                </div>
              ) : pendingPaymentRequest ? (
                /* ESTADO 2: PAGO PENDIENTE DE REVISIÓN */
                <div className="sidebar-pending-state">
                  <div className="pending-alert-box">
                    <Clock size={20} className="text-warning flex-shrink-0" />
                    <div>
                      <strong>Solicitud de pago en revisión</strong>
                      <p>
                        Método: <b>{pendingPaymentRequest.payment_method.toUpperCase()}</b> &bull; Monto: <b>S/ {Number(pendingPaymentRequest.amount_pen).toFixed(2)}</b>
                      </p>
                      <span className="pending-note">
                        Hemos recibido tu constancia. Un administrador activará tu acceso a la brevedad.
                      </span>
                    </div>
                  </div>
                </div>
              ) : course.is_free || course.price_pen === 0 ? (
                /* ESTADO 3: CURSO GRATUITO */
                <div className="sidebar-pricing-state">
                  <div className="pricing-header">
                    <span className="price-tag-free">Gratis</span>
                    <span className="price-tag-subtitle">Acceso libre sin costo</span>
                  </div>

                  <button
                    type="button"
                    onClick={handleEnrollFree}
                    disabled={enrolling}
                    className="btn-primary btn-block btn-lg"
                  >
                    {enrolling ? (
                      <>
                        <Loader2 size={18} className="animate-spin" style={{ marginRight: '8px' }} />
                        Matriculando...
                      </>
                    ) : (
                      <>
                        <PlayCircle size={18} style={{ marginRight: '8px' }} />
                        {user ? 'Matricularme gratis ahora' : 'Iniciar sesión para matricularme'}
                      </>
                    )}
                  </button>

                  <div className="course-perks-list">
                    <div className="perk-item">
                      <ShieldCheck size={16} />
                      <span>Acceso ilimitado a todo el contenido</span>
                    </div>
                    <div className="perk-item">
                      <Clock size={16} />
                      <span>Aprende a tu propio ritmo</span>
                    </div>
                    <div className="perk-item">
                      <Sparkles size={16} />
                      <span>Ejercicios y lecciones prácticas</span>
                    </div>
                  </div>
                </div>
              ) : (
                /* ESTADO 4: CURSO DE PAGO (YAPE / PLIN) */
                <div className="sidebar-pricing-state">
                  <div className="pricing-header">
                    <div className="price-main-row">
                      <span className="price-amount">
                        S/ {Number(course.price_pen).toFixed(2)}
                      </span>
                      <span className="price-badge-unique">Pago único</span>
                    </div>
                    <span className="price-tag-subtitle">Acceso de por vida sin mensualidades</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (!user) {
                        navigate(`/auth/login?redirect=/courses/${courseId}`)
                      } else {
                        setShowPaymentModal(true)
                      }
                    }}
                    className="btn-primary btn-block btn-lg"
                  >
                    <CreditCard size={18} style={{ marginRight: '8px' }} />
                    Inscribirme con Yape o Plin
                  </button>

                  <div className="course-perks-list">
                    <div className="perk-item">
                      <ShieldCheck size={16} />
                      <span>Activación rápida tras validación</span>
                    </div>
                    <div className="perk-item">
                      <Clock size={16} />
                      <span>Acceso permanente sin renovaciones</span>
                    </div>
                    <div className="perk-item">
                      <Sparkles size={16} />
                      <span>Recursos y material descargable</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* Barra de acción fija inferior para Móviles (< 1024px) */}
      <div className="course-mobile-action-bar">
        <div className="mobile-action-bar-info">
          <span className="mobile-bar-title">{course.title}</span>
          {enrollment ? (
            <span className="mobile-bar-sub">{progressPercentage}% completado</span>
          ) : course.is_free || course.price_pen === 0 ? (
            <span className="mobile-bar-sub text-success font-semibold">Gratis</span>
          ) : (
            <span className="mobile-bar-sub font-semibold">
              S/ {Number(course.price_pen).toFixed(2)}
            </span>
          )}
        </div>

        <div className="mobile-action-bar-btn">
          {enrollment ? (
            nextIncompleteLesson ? (
              <Link
                to={`/courses/${course.id}/lessons/${nextIncompleteLesson.id}`}
                className="btn-primary btn-sm mobile-cta-btn"
              >
                <PlayCircle size={15} style={{ marginRight: '4px' }} />
                Continuar
              </Link>
            ) : (
              <Link
                to={`/courses/${course.id}/lessons/${firstLesson?.id}`}
                className="btn-secondary btn-sm mobile-cta-btn"
              >
                Repasar
              </Link>
            )
          ) : pendingPaymentRequest ? (
            <span className="mobile-pending-tag">En revisión</span>
          ) : course.is_free || course.price_pen === 0 ? (
            <button
              type="button"
              onClick={handleEnrollFree}
              disabled={enrolling}
              className="btn-primary btn-sm mobile-cta-btn"
            >
              {enrolling ? '...' : 'Matricularme'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (!user) {
                  navigate(`/auth/login?redirect=/courses/${courseId}`)
                } else {
                  setShowPaymentModal(true)
                }
              }}
              className="btn-primary btn-sm mobile-cta-btn"
            >
              Inscribirme
            </button>
          )}
        </div>
      </div>

      {/* Modal de Pago Yape / Plin */}
      {showPaymentModal && course && (
        <PaymentRequestModal
          course={course}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={() => {
            setShowPaymentModal(false)
            // Recargar detalles para actualizar solicitud pendiente
            window.location.reload()
          }}
        />
      )}
    </div>
  )
}

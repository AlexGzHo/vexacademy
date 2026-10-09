import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  PlayCircle,
  Menu,
  X,
  Lock,
  Download,
  ExternalLink,
  Sparkles,
  Terminal,
  Loader2,
  AlertCircle,
  Eye,
  Clock,
} from 'lucide-react'
import { supabase } from '../../lib/supabase.ts'
import { useAuth } from '../../context/AuthContext.tsx'
import { VideoPlayer } from '../../components/common/VideoPlayer.tsx'
import { MarkdownRenderer } from '../../components/common/MarkdownRenderer.tsx'
import { CopyableBlock } from '../../components/common/CopyableBlock.tsx'
import type { Course, Module, Lesson, LessonContent, Enrollment, LessonResource } from '../../types/index.ts'

export function LessonPlayerPage() {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>()
  const { user, role } = useAuth()
  const navigate = useNavigate()

  const [course, setCourse] = useState<Course | null>(null)
  const [modules, setModules] = useState<Module[]>([])
  const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null)
  const [lessonContent, setLessonContent] = useState<LessonContent | null>(null)
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null)
  const [completedLessonIds, setCompletedLessonIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [togglingProgress, setTogglingProgress] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isAdmin = role === 'admin'

  const closeSidebar = () => {
    setIsSidebarOpen(false)
    setTimeout(() => {
      const toggleBtn = document.querySelector('.sidebar-mobile-toggle') as HTMLElement
      if (toggleBtn) toggleBtn.focus()
    }, 0)
  }

  // Manejo del estado del drawer (body overflow y foco)
  useEffect(() => {
    if (isSidebarOpen) {
      document.body.classList.add('drawer-open')
      setTimeout(() => {
        const closeBtn = document.querySelector('.sidebar-close-btn') as HTMLElement
        if (closeBtn) closeBtn.focus()
      }, 0)
    } else {
      document.body.classList.remove('drawer-open')
    }
    
    return () => {
      document.body.classList.remove('drawer-open')
    }
  }, [isSidebarOpen])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSidebarOpen) {
        closeSidebar()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isSidebarOpen])

  // Cargar información del curso, módulos, lecciones y progreso
  useEffect(() => {
    async function loadPlayerData() {
      if (!courseId || !lessonId) return

      try {
        setLoading(true)
        setError(null)

        // 1. Obtener curso
        const { data: courseData, error: courseErr } = await supabase
          .from('courses')
          .select('*')
          .eq('id', courseId)
          .maybeSingle()

        if (courseErr) throw courseErr
        if (!courseData) {
          setError('El curso no fue encontrado.')
          return
        }
        setCourse(courseData)

        // 2. Obtener módulos y lecciones
        const { data: modulesData, error: modulesErr } = await supabase
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

        if (modulesErr) throw modulesErr

        const sortedModules: Module[] = (modulesData || []).map((m: any) => ({
          ...m,
          lessons: (m.lessons || [])
            .filter((l: Lesson) => l.is_published || isAdmin)
            .sort((a: Lesson, b: Lesson) => a.order_index - b.order_index),
        }))

        setModules(sortedModules)

        // 3. Obtener lección actual
        const allLessons = sortedModules.flatMap((m) => m.lessons || [])
        const targetLesson = allLessons.find((l) => l.id === lessonId)

        if (!targetLesson) {
          setError('La lección solicitada no existe o no está publicada.')
          return
        }
        setCurrentLesson(targetLesson)

        // 4. Verificar matrícula del usuario
        let userEnrollment: Enrollment | null = null
        if (user) {
          const { data: enrollData } = await supabase
            .from('enrollments')
            .select('*')
            .eq('course_id', courseId)
            .eq('user_id', user.id)
            .eq('status', 'active')
            .maybeSingle()

          userEnrollment = enrollData || null
          setEnrollment(userEnrollment)

          // 5. Cargar progreso completado
          if (userEnrollment) {
            const { data: progressData } = await supabase
              .from('lesson_progress')
              .select('lesson_id, is_completed')
              .eq('course_id', courseId)
              .eq('user_id', user.id)
              .eq('is_completed', true)

            if (progressData) {
              setCompletedLessonIds(new Set(progressData.map((p: any) => p.lesson_id)))
            }
          }
        }

        // 6. Validar si el usuario tiene permiso para ver el contenido protegido
        const hasAccess = isAdmin || targetLesson.is_preview || !!userEnrollment

        if (hasAccess) {
          // Consultar contenido protegido de la lección
          const { data: contentData, error: contentErr } = await supabase
            .from('lesson_contents')
            .select('*')
            .eq('lesson_id', lessonId)
            .maybeSingle()

          if (!contentErr && contentData) {
            setLessonContent(contentData)
          } else {
            setLessonContent(null)
          }
        } else {
          setLessonContent(null)
        }
      } catch (err: any) {
        console.error('Error cargando reproductor de lección:', err)
        setError(err.message || 'Error al cargar los datos de la lección.')
      } finally {
        setLoading(false)
      }
    }

    loadPlayerData()
  }, [courseId, lessonId, user, isAdmin])

  // Aplanar todas las lecciones del curso ordenadas
  const flatLessons: Lesson[] = modules.flatMap((m) => m.lessons || [])
  const currentIndex = flatLessons.findIndex((l) => l.id === lessonId)
  const prevLesson = currentIndex > 0 ? flatLessons[currentIndex - 1] : null
  const nextLesson = currentIndex < flatLessons.length - 1 ? flatLessons[currentIndex + 1] : null

  const isCurrentCompleted = currentLesson ? completedLessonIds.has(currentLesson.id) : false
  const hasAccess = isAdmin || !!currentLesson?.is_preview || !!enrollment

  // Toggle de completar lección
  const handleToggleComplete = async () => {
    if (!user || !currentLesson || !courseId) return
    if (!enrollment && !isAdmin) return

    try {
      setTogglingProgress(true)
      const nextCompleted = !isCurrentCompleted

      if (nextCompleted) {
        const { error: upsertErr } = await supabase
          .from('lesson_progress')
          .upsert(
            {
              user_id: user.id,
              lesson_id: currentLesson.id,
              course_id: courseId,
              is_completed: true,
              completed_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,lesson_id' },
          )

        if (upsertErr) throw upsertErr

        setCompletedLessonIds((prev) => new Set(prev).add(currentLesson.id))

      } else {
        const { error: delErr } = await supabase
          .from('lesson_progress')
          .delete()
          .eq('user_id', user.id)
          .eq('lesson_id', currentLesson.id)

        if (delErr) throw delErr

        setCompletedLessonIds((prev) => {
          const updated = new Set(prev)
          updated.delete(currentLesson.id)
          return updated
        })
      }
    } catch (err: any) {
      console.error('Error al actualizar progreso de lección:', err)
    } finally {
      setTogglingProgress(false)
    }
  }

  // Progreso general del curso
  const totalLessons = flatLessons.length
  const completedCount = completedLessonIds.size
  const progressPercent = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0

  if (loading) {
    return (
      <div className="player-loading-container">
        <Loader2 size={40} className="animate-spin text-primary" />
        <p>Cargando lección educativa...</p>
      </div>
    )
  }

  if (error || !course || !currentLesson) {
    return (
      <div className="page-section">
        <Link to={`/courses/${courseId}`} className="back-link">
          <ArrowLeft size={16} />
          <span>Volver al curso</span>
        </Link>
        <div className="auth-alert error-alert" style={{ marginTop: '1.5rem' }}>
          <AlertCircle size={20} className="alert-icon" />
          <div>{error || 'No fue posible abrir la lección.'}</div>
        </div>
      </div>
    )
  }

  // Si la lección no es preview y el usuario no está matriculado
  if (!hasAccess) {
    return (
      <div className="page-section">
        <div className="access-denied-card" style={{ maxWidth: '640px', marginTop: '2rem' }}>
          <div className="access-denied-icon">
            <Lock size={48} />
          </div>
          <h2>Contenido Restringido</h2>
          <p>
            Esta lección es parte exclusiva del contenido completo de <strong>{course.title}</strong>.
            Para acceder a los videos, guías, prompts y código descargable, necesitas una matrícula activa.
          </p>

          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <Link to={`/courses/${course.id}`} className="btn-primary">
              Ver opciones de inscripción
            </Link>
            <Link to="/courses" className="btn-secondary">
              Explorar otros cursos
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="lesson-player-layout">
      {/* Barra Superior del Reproductor */}
      <header className="player-topbar">
        <div className="player-topbar-left">
          <Link to={`/courses/${course.id}`} className="player-back-btn" title="Volver al temario">
            <ArrowLeft size={18} />
            <span className="hide-mobile">Volver al curso</span>
          </Link>
          <div className="player-course-info">
            <h1 className="player-course-title">{course.title}</h1>
            <span className="player-lesson-breadcrumb">
              Lección {currentIndex + 1} de {totalLessons}: {currentLesson.title}
            </span>
          </div>
        </div>

        <div className="player-topbar-right">
          {enrollment && (
            <div className="player-progress-compact" title={`Progreso: ${progressPercent}%`}>
              <span className="progress-compact-text">
                {completedCount}/{totalLessons} completadas
              </span>
              <div className="progress-compact-bar">
                <div
                  className="progress-compact-fill"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          <button
            type="button"
            className="sidebar-mobile-toggle"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            title="Temario del curso"
          >
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
            <span>Temario</span>
          </button>
        </div>
      </header>

      {/* Contenido Principal + Barra Lateral */}
      <div className="player-body">
        <main className="player-main-content">
          {/* Reproductor de Video */}
          <div className="player-video-section">
            <div className="video-player-container">
              <VideoPlayer
                url={lessonContent?.video_url}
                title={currentLesson.title}
              />
            </div>
          </div>

          <div className="lesson-content-wrapper">
            {/* Título y Metadatos de la Lección */}
            <div className="lesson-header-info">
              <h2 className="current-lesson-headline">{currentLesson.title}</h2>
              <div className="lesson-badges-row">
                {currentLesson.duration_minutes > 0 && (
                  <span className="badge-meta">
                    <Clock size={14} style={{ marginRight: '4px' }} />
                    {currentLesson.duration_minutes} minutos
                  </span>
                )}
                {currentLesson.is_preview && (
                  <span className="badge badge-preview">
                    <Eye size={12} style={{ marginRight: '4px' }} />
                    Vista previa libre
                  </span>
                )}
              </div>
            </div>

            {/* Explicación Principal */}
            <div className="lesson-text-body">
              {currentLesson.description && (
                <p className="lesson-summary-lead">{currentLesson.description}</p>
              )}
              <MarkdownRenderer content={lessonContent?.content_markdown} />
            </div>

            {/* Sección de Recursos Complementarios */}
            {(lessonContent?.prompt_text || lessonContent?.code_snippet || (lessonContent?.resources && lessonContent.resources.length > 0)) && (
              <div className="lesson-resources-section">
                <h3 className="resources-section-title">Recursos de la lección</h3>
                
                <div className="resources-grid-stack">
                  {lessonContent?.prompt_text && (
                    <div className="resource-block">
                      <h4 className="resource-block-title">
                        <Sparkles size={16} className="text-primary" />
                        Prompt Recomendado
                      </h4>
                      <CopyableBlock
                        content={lessonContent.prompt_text}
                        variant="prompt"
                      />
                    </div>
                  )}

                  {lessonContent?.code_snippet && (
                    <div className="resource-block">
                      <h4 className="resource-block-title">
                        <Terminal size={16} className="text-info" />
                        Código Fuente
                      </h4>
                      <CopyableBlock
                        content={lessonContent.code_snippet}
                        variant="code"
                        language={lessonContent.code_language || 'javascript'}
                      />
                    </div>
                  )}

                  {lessonContent?.resources && lessonContent.resources.length > 0 && (
                    <div className="resource-block">
                      <h4 className="resource-block-title">
                        <Download size={16} className="text-success" />
                        Archivos y Enlaces
                      </h4>
                      <div className="resources-grid">
                        {lessonContent.resources.map((res: LessonResource, idx: number) => (
                          <a
                            key={idx}
                            href={res.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="resource-card"
                          >
                            <div className="resource-icon-box">
                              <ExternalLink size={18} />
                            </div>
                            <div className="resource-info">
                              <span className="resource-title">{res.title}</span>
                              <span className="resource-url">{res.url}</span>
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Controles Inferiores */}
            <div className="player-bottom-controls">
              <button
                type="button"
                onClick={() => prevLesson && navigate(`/courses/${course.id}/lessons/${prevLesson.id}`)}
                disabled={!prevLesson}
                className="btn-secondary btn-nav"
              >
                <ChevronLeft size={18} />
                <span>Anterior</span>
              </button>

              {(enrollment || isAdmin) && (
                <button
                  type="button"
                  onClick={handleToggleComplete}
                  disabled={togglingProgress}
                  className={`btn-complete-lesson ${isCurrentCompleted ? 'completed' : ''}`}
                >
                  <CheckCircle size={18} />
                  <span>
                    {isCurrentCompleted ? 'Lección completada' : 'Marcar como completada'}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={() => nextLesson && navigate(`/courses/${course.id}/lessons/${nextLesson.id}`)}
                disabled={!nextLesson}
                className="btn-primary btn-nav"
              >
                <span>Siguiente</span>
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </main>
        {/* Backdrop para móviles */}
        {isSidebarOpen && (
          <div 
            className="sidebar-backdrop hide-desktop" 
            onClick={closeSidebar}
            aria-hidden="true"
          />
        )}

        {/* Barra Lateral */}
        <aside className={`player-sidebar ${isSidebarOpen ? 'open' : ''}`}>
          <div className="sidebar-header">
            <h3>Contenido del Curso</h3>
            <button
              type="button"
              className="sidebar-close-btn hide-desktop"
              onClick={closeSidebar}
              aria-label="Cerrar temario"
            >
              <X size={20} />
            </button>
          </div>

          <div className="sidebar-modules-list">
            {modules.map((mod, modIdx) => (
              <div key={mod.id} className="sidebar-module-block">
                <div className="sidebar-module-title">
                  <span>Módulo {modIdx + 1}</span>
                  <h4>{mod.title}</h4>
                </div>

                <div className="sidebar-lessons-sublist">
                  {(mod.lessons || []).map((les, lesIdx) => {
                    const isActive = les.id === currentLesson.id
                    const isCompleted = completedLessonIds.has(les.id)
                    const canPlay = isAdmin || les.is_preview || !!enrollment

                    return (
                      <button
                        key={les.id}
                        type="button"
                        onClick={() => {
                          if (canPlay) {
                            navigate(`/courses/${course.id}/lessons/${les.id}`)
                            closeSidebar()
                          }
                        }}
                        disabled={!canPlay}
                        className={`sidebar-lesson-item ${isActive ? 'active' : ''} ${
                          isCompleted ? 'completed' : ''
                        } ${!canPlay ? 'locked' : ''}`}
                      >
                        <div className="sidebar-item-status">
                          {isCompleted ? (
                            <CheckCircle size={16} className="text-success" />
                          ) : isActive ? (
                            <PlayCircle size={16} className="text-primary" />
                          ) : canPlay ? (
                            <span className="lesson-number-circle">{lesIdx + 1}</span>
                          ) : (
                            <Lock size={14} className="text-muted" />
                          )}
                        </div>

                        <div className="sidebar-item-text">
                          <span className="sidebar-item-title">{les.title}</span>
                          <div className="sidebar-item-sub">
                            {les.duration_minutes > 0 && (
                              <span>{les.duration_minutes} min</span>
                            )}
                            {les.is_preview && (
                              <span className="badge-preview-tiny">Libre</span>
                            )}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  )
}


import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BookOpen,
  Plus,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  CheckCircle,
  Users,
  AlertCircle,
  Loader2,
  Search,
  ExternalLink,
  CreditCard,
  Bell,
  X,
} from 'lucide-react'
import { supabase } from '../../lib/supabase.ts'
import { brandConfig } from '../../config/brand.ts'
import { useAuth } from '../../context/AuthContext.tsx'
import { CourseEditor } from '../../components/admin/CourseEditor.tsx'
import { PaymentManagement } from '../../components/admin/PaymentManagement.tsx'
import type { Course } from '../../types/index.ts'

export function AdminPage() {
  const { role, isPaymentReviewer } = useAuth()
  const [activeTab, setActiveTab] = useState<'courses' | 'payments'>(
    role === 'admin' ? 'courses' : 'payments'
  )
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'published' | 'draft'>('all')

  // Contador de pagos pendientes para el badge de navegación
  const [pendingCount, setPendingCount] = useState<number>(0)
  const [globalToast, setGlobalToast] = useState<{
    id: string
    title: string
    message: string
    timestamp: string
  } | null>(null)

  // Modos de vista: 'list' o 'editor'
  const [viewMode, setViewMode] = useState<'list' | 'editor'>('list')
  const [editingCourseId, setEditingCourseId] = useState<string | undefined>(undefined)

  const loadPendingCount = useCallback(async () => {
    try {
      const { count, error: countErr } = await supabase
        .from('payment_requests')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending')

      if (!countErr && count !== null) {
        setPendingCount(count)
      }
    } catch (err) {
      console.warn('Error al obtener conteo de solicitudes pendientes:', err)
    }
  }, [])

  useEffect(() => {
    if (!isPaymentReviewer) return

    loadPendingCount()

    const channel = supabase
      .channel('admin_global_payments_tracker')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payment_requests',
        },
        async (payload) => {
          loadPendingCount()

          if (payload.eventType === 'INSERT') {
            const newRecord = payload.new as any
            if (newRecord.status === 'pending') {
              const { data } = await supabase
                .from('payment_requests')
                .select(`
                  *,
                  course:courses(title),
                  profile:profiles!payment_requests_user_id_fkey(full_name)
                `)
                .eq('id', newRecord.id)
                .single()

              const studentName = data?.profile?.full_name || 'Estudiante'
              const courseTitle = data?.course?.title || 'Curso'
              const method = (newRecord.payment_method || 'PAGO').toUpperCase()
              const amount = Number(newRecord.amount_pen || 0).toFixed(2)

              setGlobalToast({
                id: newRecord.id,
                title: 'Nueva solicitud de pago recibida',
                message: `${studentName} envió comprobante de ${method} (S/ ${amount}) para "${courseTitle}".`,
                timestamp: new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
              })
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [isPaymentReviewer, loadPendingCount])


  const loadCourses = useCallback(async (isInitial = false) => {
    try {
      if (!isInitial) {
        setLoading(true)
      }
      setError(null)

      // Cargar todos los cursos con conteo de módulos y lecciones
      const { data, error: fetchErr } = await supabase
        .from('courses')
        .select(`
          *,
          modules (
            id,
            lessons (id)
          ),
          enrollments (id)
        `)
        .order('created_at', { ascending: false })

      if (fetchErr) throw fetchErr

      const mapped: Course[] = (data || []).map((c: any) => {
        let lessonCount = 0
        if (c.modules) {
          c.modules.forEach((m: any) => {
            if (m.lessons) lessonCount += m.lessons.length
          })
        }
        return {
          ...c,
          modules_count: c.modules ? c.modules.length : 0,
          lessons_count: lessonCount,
          enrollments_count: c.enrollments ? c.enrollments.length : 0,
        }
      })

      setCourses(mapped)
    } catch (err: any) {
      console.error('Error al cargar cursos para administración:', err)
      setError(err.message || 'Error al conectar con la base de datos.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCourses(true)
  }, [loadCourses])

  // Publicar / Despublicar
  const handleTogglePublish = async (course: Course) => {
    try {
      const nextStatus = !course.is_published
      const { error: updateErr } = await supabase
        .from('courses')
        .update({ is_published: nextStatus })
        .eq('id', course.id)

      if (updateErr) throw updateErr

      setCourses((prev) =>
        prev.map((c) => (c.id === course.id ? { ...c, is_published: nextStatus } : c)),
      )
    } catch (err: any) {
      console.error('Error cambiando estado de publicación:', err)
      alert(err.message || 'No fue posible cambiar el estado de publicación.')
    }
  }

  // Eliminar curso
  const handleDeleteCourse = async (course: Course) => {
    const confirmed = confirm(
      `¿Estás seguro de que deseas eliminar permanentemente el curso "${course.title}"? Se eliminarán todos sus módulos y lecciones asociadas.`,
    )
    if (!confirmed) return

    try {
      const { error: delErr } = await supabase.from('courses').delete().eq('id', course.id)
      if (delErr) throw delErr

      setCourses((prev) => prev.filter((c) => c.id !== course.id))
    } catch (err: any) {
      console.error('Error eliminando curso:', err)
      alert(err.message || 'Error al eliminar el curso.')
    }
  }

  // Navegar al editor
  const handleCreateCourse = () => {
    setEditingCourseId(undefined)
    setViewMode('editor')
  }

  const handleEditCourse = (id: string) => {
    setEditingCourseId(id)
    setViewMode('editor')
  }

  const handleBackToList = () => {
    setViewMode('list')
    setEditingCourseId(undefined)
    loadCourses()
  }

  // Filtrado de cursos
  const filteredCourses = courses.filter((c) => {
    const matchText =
      c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.description && c.description.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchStatus =
      filterStatus === 'all' ||
      (filterStatus === 'published' && c.is_published) ||
      (filterStatus === 'draft' && !c.is_published)

    return matchText && matchStatus
  })

  // Si estamos en modo editor, mostramos CourseEditor
  if (viewMode === 'editor') {
    return (
      <section className="page-section">
        <CourseEditor
          courseId={editingCourseId}
          onClose={handleBackToList}
          onCourseSaved={() => loadCourses(false)}
        />
      </section>
    )
  }

  const totalCourses = courses.length
  const publishedCount = courses.filter((c) => c.is_published).length
  const draftCount = courses.filter((c) => !c.is_published).length
  const totalEnrollments = courses.reduce((acc, c) => acc + (c.enrollments_count || 0), 0)

  return (
    <section className="page-section">
      <div className="section-header" style={{ marginBottom: '1rem' }}>
        <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>Panel de Administración</h1>
        <p className="subtitle" style={{ fontSize: '0.9rem', marginTop: 0 }}>
          Gestión educativa y financiera de {brandConfig.name}.
        </p>
      </div>

      {/* Pestañas de Navegación del Panel */}
      <div className="editor-tabs-bar" style={{ marginBottom: '1.5rem' }}>
        {role === 'admin' && (
          <button
            type="button"
            onClick={() => setActiveTab('courses')}
            className={`editor-tab-btn ${activeTab === 'courses' ? 'active' : ''}`}
          >
            <BookOpen size={18} />
            Gestión de Cursos
          </button>
        )}

        {isPaymentReviewer && (
          <button
            type="button"
            onClick={() => {
              setActiveTab('payments')
              setGlobalToast(null)
            }}
            className={`editor-tab-btn ${activeTab === 'payments' ? 'active' : ''}`}
          >
            <CreditCard size={18} />
            Pagos Yape / Plin
            {pendingCount > 0 && (
              <span
                style={{
                  background: 'var(--color-ember)',
                  color: '#ffffff',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  borderRadius: '9999px',
                  padding: '0.15rem 0.55rem',
                  lineHeight: 1,
                  marginLeft: '0.25rem'
                }}
                title={`${pendingCount} solicitud(es) pendiente(s)`}
              >
                {pendingCount}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Renderizado de Pestaña activa */}
      {activeTab === 'payments' ? (
        <PaymentManagement />
      ) : (
        <>
          {/* Métricas rápidas */}
          <div className="admin-stats-grid">
            <div className="admin-stat-card">
              <BookOpen size={20} className="text-primary" />
              <div className="stat-info">
                <span className="stat-number">{totalCourses}</span>
                <span className="stat-label">Cursos Totales</span>
              </div>
            </div>

            <div className="admin-stat-card">
              <CheckCircle size={20} className="text-success" />
              <div className="stat-info">
                <span className="stat-number">{publishedCount}</span>
                <span className="stat-label">Publicados</span>
              </div>
            </div>

            <div className="admin-stat-card">
              <EyeOff size={20} className="text-muted" />
              <div className="stat-info">
                <span className="stat-number">{draftCount}</span>
                <span className="stat-label">Borradores</span>
              </div>
            </div>

            <div className="admin-stat-card">
              <Users size={20} className="text-info" />
              <div className="stat-info">
                <span className="stat-number">{totalEnrollments}</span>
                <span className="stat-label">Matrículas Activas</span>
              </div>
            </div>
          </div>

      {/* Barra de Búsqueda y Crear Curso */}
      <div className="admin-actions-bar">
        <div className="admin-search-wrap">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Buscar por título de curso..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="admin-filters-wrap">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="filter-select"
          >
            <option value="all">Todos los estados</option>
            <option value="published">Solo publicados</option>
            <option value="draft">Solo borradores</option>
          </select>

          <button type="button" onClick={handleCreateCourse} className="btn-primary">
            <Plus size={18} style={{ marginRight: '6px' }} />
            Crear Nuevo Curso
          </button>
        </div>
      </div>

      {/* Lista de cursos */}
      {loading ? (
        <div className="catalog-loading-state">
          <Loader2 size={36} className="animate-spin text-primary" />
          <p>Cargando cursos administrativos...</p>
        </div>
      ) : error ? (
        <div className="auth-alert error-alert">
          <AlertCircle size={20} className="alert-icon" />
          <div>{error}</div>
        </div>
      ) : filteredCourses.length === 0 ? (
        <div className="placeholder-box" style={{ padding: '3.5rem 1.5rem' }}>
          <BookOpen size={48} className="text-muted" style={{ margin: '0 auto 1rem' }} />
          <h3>No se encontraron cursos</h3>
          <p>
            {searchTerm || filterStatus !== 'all'
              ? 'Prueba modificando tus términos de búsqueda o filtros.'
              : 'Todavía no has creado ningún curso en la plataforma.'}
          </p>
          <button
            type="button"
            onClick={handleCreateCourse}
            className="btn-primary"
            style={{ marginTop: '1rem' }}
          >
            <Plus size={16} style={{ marginRight: '6px' }} />
            Crear el Primer Curso
          </button>
        </div>
      ) : (
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Curso</th>
                <th>Nivel</th>
                <th>Estructura</th>
                <th>Precio (PEN)</th>
                <th>Estado</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredCourses.map((c) => (
                <tr key={c.id}>
                  <td data-label="Curso">
                    <div className="course-table-cell">
                      {c.thumbnail_url ? (
                        <img
                          src={c.thumbnail_url}
                          alt={c.title}
                          className="table-thumb"
                        />
                      ) : (
                        <div className="table-thumb-placeholder">
                          <BookOpen size={16} />
                        </div>
                      )}
                      <div>
                        <strong>{c.title}</strong>
                        <div className="table-slug">slug: /{c.slug}</div>
                      </div>
                    </div>
                  </td>

                  <td data-label="Nivel">
                    <span className={`course-badge badge-${c.level.toLowerCase()}`}>
                      {c.level}
                    </span>
                  </td>

                  <td data-label="Estructura">
                    <div className="table-structure">
                      <span>{c.modules_count || 0} módulos</span>
                      <span className="text-muted">&bull; {c.lessons_count || 0} lecciones</span>
                    </div>
                  </td>

                  <td data-label="Precio (PEN)">
                    {c.is_free || c.price_pen === 0 ? (
                      <span className="badge badge-free">Gratis</span>
                    ) : (
                      <strong>S/ {Number(c.price_pen).toFixed(2)}</strong>
                    )}
                  </td>

                  <td data-label="Estado">
                    <button
                      type="button"
                      onClick={() => handleTogglePublish(c)}
                      className={`status-toggle-btn ${c.is_published ? 'published' : 'draft'}`}
                      title={c.is_published ? 'Clic para despublicar' : 'Clic para publicar'}
                    >
                      {c.is_published ? (
                        <>
                          <Eye size={14} />
                          <span>Publicado</span>
                        </>
                      ) : (
                        <>
                          <EyeOff size={14} />
                          <span>Borrador</span>
                        </>
                      )}
                    </button>
                  </td>

                  <td data-label="Acciones" style={{ textAlign: 'right' }}>
                    <div className="table-actions-group">
                      <Link
                        to={`/courses/${c.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-icon-subtle"
                        title="Ver en catálogo público"
                      >
                        <ExternalLink size={16} />
                      </Link>

                      <button
                        type="button"
                        onClick={() => handleEditCourse(c.id)}
                        className="btn-icon-subtle"
                        title="Editar curso y lecciones"
                      >
                        <Edit size={16} />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteCourse(c)}
                        className="btn-icon-danger"
                        title="Eliminar curso"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
        </>
      )}

      {/* Toast de notificación en tiempo real centralizado */}
      {globalToast && (
        <div
          style={{
            position: 'fixed',
            bottom: '1.5rem',
            right: '1.5rem',
            zIndex: 9999,
            backgroundColor: '#1e293b',
            color: '#ffffff',
            padding: '1rem 1.25rem',
            borderRadius: '8px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem',
            maxWidth: '420px',
          }}
        >
          <div
            style={{
              background: 'rgba(245, 158, 11, 0.2)',
              padding: '0.4rem',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Bell size={20} style={{ color: '#f59e0b' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '0.9rem', color: '#f8fafc' }}>{globalToast.title}</strong>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginLeft: '0.5rem' }}>
                {globalToast.timestamp}
              </span>
            </div>
            <p style={{ fontSize: '0.825rem', color: '#cbd5e1', margin: '0.25rem 0 0.5rem 0', lineHeight: 1.4 }}>
              {globalToast.message}
            </p>
            <button
              type="button"
              onClick={() => {
                setActiveTab('payments')
                setGlobalToast(null)
              }}
              style={{
                background: 'var(--color-ember, #f54e00)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '4px',
                padding: '0.35rem 0.75rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Ver pagos pendientes
            </button>
          </div>
          <button
            type="button"
            onClick={() => setGlobalToast(null)}
            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0.1rem' }}
            title="Cerrar aviso"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </section>
  )
}



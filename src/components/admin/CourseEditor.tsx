import React, { useEffect, useState } from 'react'
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  Edit2,
  Video,
  FileText,
  Sparkles,
  Terminal,
  Download,
  Clock,
  Layers,
  Loader2,
  AlertCircle,
  CheckCircle,
} from 'lucide-react'
import { supabase } from '../../lib/supabase.ts'
import type { CourseLevel, Module, Lesson, LessonResource } from '../../types/index.ts'

interface CourseEditorProps {
  courseId?: string
  onClose: () => void
  onCourseSaved?: () => void
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function CourseEditor({ courseId, onClose, onCourseSaved }: CourseEditorProps) {
  const [createdCourseId, setCreatedCourseId] = useState<string | undefined>(undefined)
  const activeCourseId = courseId || createdCourseId
  const isEditing = Boolean(activeCourseId)
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(Boolean(courseId))
  const savingCourseRef = React.useRef(false)

  // Estado del curso
  const [courseForm, setCourseForm] = useState<{
    title: string
    slug: string
    description: string
    thumbnail_url: string
    level: CourseLevel
    duration: string
    price_pen: number
    is_free: boolean
    is_published: boolean
  }>({
    title: '',
    slug: '',
    description: '',
    thumbnail_url: '',
    level: 'Principiante',
    duration: '4 semanas',
    price_pen: 0,
    is_free: true,
    is_published: false,
  })

  const [activeTab, setActiveTab] = useState<'details' | 'curriculum'>('details')
  const [modules, setModules] = useState<Module[]>([])
  const [loading, setLoading] = useState(isEditing)
  const [savingCourse, setSavingCourse] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Modales de módulo y lección
  const [moduleModalOpen, setModuleModalOpen] = useState(false)
  const [editingModule, setEditingModule] = useState<Module | null>(null)
  const [moduleTitle, setModuleTitle] = useState('')
  const [moduleDescription, setModuleDescription] = useState('')
  const [moduleOrder, setModuleOrder] = useState(1)

  const [lessonModalOpen, setLessonModalOpen] = useState(false)
  const [targetModuleId, setTargetModuleId] = useState<string | null>(null)
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null)

  const [lessonTitle, setLessonTitle] = useState('')
  const [lessonDescription, setLessonDescription] = useState('')
  const [lessonDuration, setLessonDuration] = useState(10)
  const [lessonOrder, setLessonOrder] = useState(1)
  const [lessonIsPublished, setLessonIsPublished] = useState(true)
  const [lessonIsPreview, setLessonIsPreview] = useState(false)
  const [lessonVideoUrl, setLessonVideoUrl] = useState('')
  const [lessonContentMarkdown, setLessonContentMarkdown] = useState('')
  const [lessonCodeSnippet, setLessonCodeSnippet] = useState('')
  const [lessonCodeLanguage, setLessonCodeLanguage] = useState('javascript')
  const [lessonPromptText, setLessonPromptText] = useState('')
  const [lessonResources, setLessonResources] = useState<LessonResource[]>([])
  const [savingLesson, setSavingLesson] = useState(false)
  const [savingModule, setSavingModule] = useState(false)
  const [lessonActiveTab, setLessonActiveTab] = useState<'config' | 'content' | 'resources'>('config')

  const reloadCurriculum = async (targetId: string) => {
    const { data: modulesData, error: modErr } = await supabase
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
          is_preview,
          lesson_contents (*)
        )
      `)
      .eq('course_id', targetId)
      .order('order_index', { ascending: true })

    if (modErr) {
      console.error('Error al recargar temario:', modErr)
      return
    }

    const sortedModules: Module[] = (modulesData || []).map((m: any) => ({
      ...m,
      lessons: (m.lessons || []).sort(
        (a: Lesson, b: Lesson) => a.order_index - b.order_index,
      ),
    }))

    setModules(sortedModules)
  }

  // Cargar datos del curso si se edita
  useEffect(() => {
    async function loadCourseData() {
      if (!courseId) return

      try {
        setLoading(true)
        setError(null)

        // 1. Obtener curso
        const { data: courseData, error: courseErr } = await supabase
          .from('courses')
          .select('*')
          .eq('id', courseId)
          .single()

        if (courseErr) throw courseErr

        setCourseForm({
          title: courseData.title || '',
          slug: courseData.slug || '',
          description: courseData.description || '',
          thumbnail_url: courseData.thumbnail_url || '',
          level: courseData.level || 'Principiante',
          duration: courseData.duration || '4 semanas',
          price_pen: courseData.price_pen || 0,
          is_free: courseData.is_free ?? true,
          is_published: courseData.is_published ?? false,
        })
        setIsSlugManuallyEdited(true)

        // 2. Obtener módulos y lecciones
        await reloadCurriculum(courseId)
      } catch (err: any) {
        console.error('Error al cargar datos del curso:', err)
        setError(err.message || 'Error al cargar curso.')
      } finally {
        setLoading(false)
      }
    }

    loadCourseData()
  }, [courseId])

  // Generador de slug a partir del título
  const handleTitleChange = (val: string) => {
    setCourseForm((prev) => {
      const updated = { ...prev, title: val }
      if (!isEditing && !isSlugManuallyEdited) {
        updated.slug = slugify(val)
      }
      return updated
    })
  }

  // Cambio manual del slug
  const handleSlugChange = (val: string) => {
    const formatted = val
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w-]/g, '')
    setCourseForm((prev) => ({ ...prev, slug: formatted }))
    setIsSlugManuallyEdited(formatted.length > 0)
  }

  // Comprobar disponibilidad de slug en Supabase
  const checkSlugAvailable = async (candidateSlug: string, targetId?: string): Promise<boolean> => {
    let query = supabase.from('courses').select('id').eq('slug', candidateSlug)
    if (targetId) {
      query = query.neq('id', targetId)
    }
    const { data, error } = await query.maybeSingle()
    if (error) throw error
    return !data
  }

  // Resolver colisiones de slug asignando sufijos numéricos únicos (-2, -3...)
  const resolveUniqueSlug = async (baseSlug: string, targetId?: string): Promise<string> => {
    let cleanBase = slugify(baseSlug) || 'curso'
    let candidate = cleanBase
    let counter = 1

    while (!(await checkSlugAvailable(candidate, targetId))) {
      counter++
      candidate = `${cleanBase}-${counter}`
    }

    return candidate
  }

  // Guardar curso (crear o actualizar)
  const handleSaveCourse = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (savingCourseRef.current) return
    savingCourseRef.current = true

    setError(null)
    setSuccessMessage(null)

    if (!courseForm.title.trim()) {
      setError('El título del curso es obligatorio.')
      savingCourseRef.current = false
      return
    }

    const rawSlug = courseForm.slug.trim() || courseForm.title.trim()
    if (!rawSlug) {
      setError('El slug o identificador de URL es obligatorio.')
      savingCourseRef.current = false
      return
    }

    try {
      setSavingCourse(true)

      // Resolver colisiones de slug automáticamente contra la BD
      const targetSlug = await resolveUniqueSlug(rawSlug, activeCourseId)

      if (targetSlug !== courseForm.slug) {
        setCourseForm((prev) => ({ ...prev, slug: targetSlug }))
      }

      const payload = {
        title: courseForm.title.trim(),
        slug: targetSlug,
        description: courseForm.description.trim(),
        thumbnail_url: courseForm.thumbnail_url.trim(),
        level: courseForm.level,
        duration: courseForm.duration.trim() || '4 semanas',
        price_pen: courseForm.is_free ? 0 : Number(courseForm.price_pen) || 0,
        is_free: courseForm.is_free,
        is_published: courseForm.is_published,
      }

      if (isEditing && activeCourseId) {
        const { error: updateErr } = await supabase
          .from('courses')
          .update(payload)
          .eq('id', activeCourseId)

        if (updateErr) throw updateErr
        setSuccessMessage('¡Curso actualizado exitosamente!')
      } else {
        const { data: newCourse, error: insertErr } = await supabase
          .from('courses')
          .insert(payload)
          .select()
          .single()

        if (insertErr) throw insertErr
        if (newCourse) {
          setCreatedCourseId(newCourse.id)
          setIsSlugManuallyEdited(true)
        }
        setSuccessMessage('¡Curso creado exitosamente!')
        if (onCourseSaved) onCourseSaved()
        // Cambiar a pestaña de currículum ahora que ya existe el id
        setActiveTab('curriculum')
      }

      if (onCourseSaved) onCourseSaved()
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err: any) {
      console.error('Error al guardar curso:', err)
      const isDuplicateKey =
        err.code === '23505' ||
        (err.message &&
          (err.message.includes('courses_slug_key') ||
            err.message.includes('duplicate key value violates unique constraint')))

      if (isDuplicateKey) {
        setError(
          `El identificador URL (slug) "${courseForm.slug}" ya está en uso por otro curso. Por favor ingresa un slug diferente.`
        )
      } else {
        setError(err.message || 'No fue posible guardar el curso.')
      }
    } finally {
      savingCourseRef.current = false
      setSavingCourse(false)
    }
  }

  // --- GESTIÓN DE MÓDULOS ---
  const handleOpenModuleModal = (mod?: Module) => {
    if (mod) {
      setEditingModule(mod)
      setModuleTitle(mod.title)
      setModuleDescription(mod.description || '')
      setModuleOrder(mod.order_index)
    } else {
      setEditingModule(null)
      setModuleTitle('')
      setModuleDescription('')
      const nextOrder = modules.length > 0 ? Math.max(...modules.map((m) => m.order_index)) + 1 : 1
      setModuleOrder(nextOrder)
    }
    setModuleModalOpen(true)
  }

  const handleSaveModule = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeCourseId) {
      setError('Debes guardar primero el curso antes de agregar módulos.')
      return
    }

    try {
      setSavingModule(true)
      if (editingModule) {
        const { error: err } = await supabase
          .from('modules')
          .update({
            title: moduleTitle.trim(),
            description: moduleDescription.trim(),
            order_index: moduleOrder,
          })
          .eq('id', editingModule.id)

        if (err) throw err
      } else {
        const { error: err } = await supabase.from('modules').insert({
          course_id: activeCourseId,
          title: moduleTitle.trim(),
          description: moduleDescription.trim(),
          order_index: moduleOrder,
          is_published: true,
        })

        if (err) throw err
      }

      await reloadCurriculum(activeCourseId)
      setModuleModalOpen(false)
    } catch (err: any) {
      console.error('Error guardando módulo:', err)
      setError(err.message || 'Error al guardar el módulo.')
    } finally {
      setSavingModule(false)
    }
  }

  const handleDeleteModule = async (mod: Module) => {
    if (
      !confirm(
        `¿Eliminar el módulo "${mod.title}" y todas sus lecciones asociadas? Esta acción no se puede deshacer.`,
      )
    ) {
      return
    }

    try {
      const { error: err } = await supabase.from('modules').delete().eq('id', mod.id)
      if (err) throw err
      if (activeCourseId) await reloadCurriculum(activeCourseId)
    } catch (err: any) {
      console.error('Error al eliminar módulo:', err)
      setError(err.message || 'Error al eliminar el módulo.')
    }
  }

  // --- GESTIÓN DE LECCIONES ---
  const handleOpenLessonModal = async (moduleId: string, lesson?: Lesson) => {
    setTargetModuleId(moduleId)
    if (lesson) {
      setEditingLesson(lesson)
      setLessonTitle(lesson.title)
      setLessonDescription(lesson.description || '')
      setLessonDuration(lesson.duration_minutes || 10)
      setLessonOrder(lesson.order_index)
      setLessonIsPublished(lesson.is_published)
      setLessonIsPreview(lesson.is_preview)

      // Cargar contenidos protegidos de la lección
      const { data: contents } = await supabase
        .from('lesson_contents')
        .select('*')
        .eq('lesson_id', lesson.id)
        .maybeSingle()

      if (contents) {
        setLessonVideoUrl(contents.video_url || '')
        setLessonContentMarkdown(contents.content_markdown || '')
        setLessonCodeSnippet(contents.code_snippet || '')
        setLessonCodeLanguage(contents.code_language || 'javascript')
        setLessonPromptText(contents.prompt_text || '')
        setLessonResources(contents.resources || [])
      } else {
        setLessonVideoUrl('')
        setLessonContentMarkdown('')
        setLessonCodeSnippet('')
        setLessonCodeLanguage('javascript')
        setLessonPromptText('')
        setLessonResources([])
      }
    } else {
      setEditingLesson(null)
      setLessonTitle('')
      setLessonDescription('')
      setLessonDuration(10)
      const targetMod = modules.find((m) => m.id === moduleId)
      const curLessons = targetMod?.lessons || []
      const nextOrder = curLessons.length > 0 ? Math.max(...curLessons.map((l) => l.order_index)) + 1 : 1
      setLessonOrder(nextOrder)
      setLessonIsPublished(true)
      setLessonIsPreview(false)
      setLessonVideoUrl('')
      setLessonContentMarkdown('')
      setLessonCodeSnippet('')
      setLessonCodeLanguage('javascript')
      setLessonPromptText('')
      setLessonResources([])
    }
    setLessonActiveTab('config')
    setLessonModalOpen(true)
  }

  const handleSaveLesson = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeCourseId || !targetModuleId) return

    if (!lessonTitle.trim()) {
      alert('El título de la lección es obligatorio.')
      return
    }

    try {
      setSavingLesson(true)
      let lessonIdToUse = editingLesson?.id

      if (editingLesson) {
        // Actualizar lección
        const { error: lessonErr } = await supabase
          .from('lessons')
          .update({
            title: lessonTitle.trim(),
            description: lessonDescription.trim(),
            duration_minutes: Number(lessonDuration) || 0,
            order_index: Number(lessonOrder) || 1,
            is_published: lessonIsPublished,
            is_preview: lessonIsPreview,
          })
          .eq('id', editingLesson.id)

        if (lessonErr) throw lessonErr
      } else {
        // Crear lección
        const { data: newLesson, error: lessonErr } = await supabase
          .from('lessons')
          .insert({
            module_id: targetModuleId,
            course_id: activeCourseId,
            title: lessonTitle.trim(),
            description: lessonDescription.trim(),
            duration_minutes: Number(lessonDuration) || 0,
            order_index: Number(lessonOrder) || 1,
            is_published: lessonIsPublished,
            is_preview: lessonIsPreview,
          })
          .select()
          .single()

        if (lessonErr) throw lessonErr
        lessonIdToUse = newLesson.id
      }

      // Guardar o actualizar lesson_contents
      if (lessonIdToUse) {
        const { error: contentErr } = await supabase
          .from('lesson_contents')
          .upsert(
            {
              lesson_id: lessonIdToUse,
              video_url: lessonVideoUrl.trim(),
              content_markdown: lessonContentMarkdown,
              code_snippet: lessonCodeSnippet,
              code_language: lessonCodeLanguage,
              prompt_text: lessonPromptText,
              resources: lessonResources.filter((r) => r.title.trim() && r.url.trim()),
            },
            { onConflict: 'lesson_id' },
          )

        if (contentErr) throw contentErr
      }

      await reloadCurriculum(activeCourseId)
      setLessonModalOpen(false)
    } catch (err: any) {
      console.error('Error al guardar lección:', err)
      alert(err.message || 'Error al guardar la lección.')
    } finally {
      setSavingLesson(false)
    }
  }

  const handleDeleteLesson = async (lesson: Lesson) => {
    if (!confirm(`¿Eliminar la lección "${lesson.title}"?`)) return

    try {
      const { error: err } = await supabase.from('lessons').delete().eq('id', lesson.id)
      if (err) throw err
      if (activeCourseId) await reloadCurriculum(activeCourseId)
    } catch (err: any) {
      console.error('Error al eliminar lección:', err)
      alert(err.message || 'Error al eliminar la lección.')
    }
  }

  // Recursos descargables auxiliares
  const handleAddResourceRow = () => {
    setLessonResources((prev) => [...prev, { title: '', url: '' }])
  }

  const handleUpdateResourceRow = (index: number, field: 'title' | 'url', value: string) => {
    setLessonResources((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const handleRemoveResourceRow = (index: number) => {
    setLessonResources((prev) => prev.filter((_, i) => i !== index))
  }

  if (loading) {
    return (
      <div className="catalog-loading-state" style={{ minHeight: '50vh' }}>
        <Loader2 size={36} className="animate-spin text-primary" />
        <p>Cargando información del curso...</p>
      </div>
    )
  }

  return (
    <div className="course-editor-wrapper">
      {/* Barra superior de navegación */}
      <div className="editor-topbar">
        <div className="editor-topbar-left">
          <button type="button" onClick={onClose} className="btn-secondary btn-sm">
            <ArrowLeft size={16} style={{ marginRight: '6px' }} />
            Volver a la lista
          </button>
          <h2>{isEditing ? `Editando: ${courseForm.title}` : 'Crear Nuevo Curso'}</h2>
        </div>

        <div className="editor-topbar-right">
          {courseForm.is_published ? (
            <span className="badge badge-published">Publicado</span>
          ) : (
            <span className="badge badge-draft">Borrador</span>
          )}

          <button
            type="button"
            onClick={() => handleSaveCourse()}
            disabled={savingCourse}
            className="btn-primary"
          >
            {savingCourse ? (
              <Loader2 size={16} className="animate-spin" style={{ marginRight: '6px' }} />
            ) : (
              <Save size={16} style={{ marginRight: '6px' }} />
            )}
            Guardar Curso
          </button>
        </div>
      </div>

      {error && (
        <div className="auth-alert error-alert" style={{ marginBottom: '1.25rem' }}>
          <AlertCircle size={20} className="alert-icon" />
          <div>{error}</div>
        </div>
      )}

      {successMessage && (
        <div className="auth-alert success-alert" style={{ marginBottom: '1.25rem' }}>
          <CheckCircle size={20} className="alert-icon" />
          <div>{successMessage}</div>
        </div>
      )}

      {/* Pestañas: Información General / Módulos y Lecciones */}
      <div className="editor-tabs-bar">
        <button
          type="button"
          className={`editor-tab-btn ${activeTab === 'details' ? 'active' : ''}`}
          onClick={() => setActiveTab('details')}
        >
          <FileText size={16} />
          <span>Información General y Precio</span>
        </button>

        <button
          type="button"
          className={`editor-tab-btn ${activeTab === 'curriculum' ? 'active' : ''}`}
          onClick={() => {
            if (!isEditing && !activeCourseId) {
              alert('Por favor guarda los datos iniciales del curso primero.')
            } else {
              setActiveTab('curriculum')
            }
          }}
          disabled={!isEditing && !activeCourseId}
        >
          <Layers size={16} />
          <span>Estructura Educativa (Módulos y Lecciones)</span>
        </button>
      </div>

      {/* PESTAÑA 1: INFORMACIÓN GENERAL */}
      {activeTab === 'details' && (
        <form onSubmit={handleSaveCourse} className="editor-form-card">
          <div className="form-grid-2">
            <div className="form-group">
              <label htmlFor="course-title">Título del curso *</label>
              <input
                id="course-title"
                type="text"
                required
                value={courseForm.title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="Ej. Agentes de IA y Workflows Autónomos"
              />
            </div>

            <div className="form-group">
              <label htmlFor="course-slug">Slug de URL (Identificador) *</label>
              <input
                id="course-slug"
                type="text"
                required
                value={courseForm.slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder="ej. agentes-ia-workflows"
              />
              <small className="field-hint">
                Identificador único para la URL. Se genera automáticamente a partir del título o puedes personalizarlo.
              </small>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="course-desc">Descripción del curso</label>
            <textarea
              id="course-desc"
              rows={4}
              value={courseForm.description}
              onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })}
              placeholder="Explica qué aprenderán los estudiantes, requisitos y habilidades prácticas..."
              className="form-textarea"
            />
          </div>

          <div className="form-grid-3">
            <div className="form-group">
              <label htmlFor="course-level">Nivel de dificultad</label>
              <select
                id="course-level"
                value={courseForm.level}
                onChange={(e) => setCourseForm({ ...courseForm, level: e.target.value as CourseLevel })}
                className="form-select"
              >
                <option value="Principiante">Principiante</option>
                <option value="Intermedio">Intermedio</option>
                <option value="Avanzado">Avanzado</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="course-duration">Duración estimada</label>
              <input
                id="course-duration"
                type="text"
                value={courseForm.duration}
                onChange={(e) => setCourseForm({ ...courseForm, duration: e.target.value })}
                placeholder="Ej. 4 semanas / 12 horas"
              />
            </div>

            <div className="form-group">
              <label htmlFor="course-thumb">URL de la imagen (miniatura)</label>
              <input
                id="course-thumb"
                type="url"
                value={courseForm.thumbnail_url}
                onChange={(e) => setCourseForm({ ...courseForm, thumbnail_url: e.target.value })}
                placeholder="https://images.unsplash.com/..."
              />
            </div>
          </div>

          {/* Previsualización de imagen si se provee */}
          {courseForm.thumbnail_url && (
            <div className="image-preview-box">
              <span className="preview-label">Vista previa de imagen:</span>
              <img
                src={courseForm.thumbnail_url}
                alt="Miniatura del curso"
                className="thumbnail-preview-img"
                onError={(e) => {
                  ;(e.target as any).style.display = 'none'
                }}
              />
            </div>
          )}

          {/* Configuración de Precio en Soles y Publicación */}
          <div className="pricing-config-card">
            <h3>Configuración Comercial y Acceso</h3>
            <div className="pricing-grid">
              <div className="checkbox-field">
                <input
                  type="checkbox"
                  id="is_free"
                  checked={courseForm.is_free}
                  onChange={(e) =>
                    setCourseForm({
                      ...courseForm,
                      is_free: e.target.checked,
                      price_pen: e.target.checked ? 0 : courseForm.price_pen,
                    })
                  }
                />
                <label htmlFor="is_free">
                  <strong>Curso Gratuito</strong>
                  <span>Cualquier usuario autenticado podrá matricularse de forma libre.</span>
                </label>
              </div>

              {!courseForm.is_free && (
                <div className="form-group">
                  <label htmlFor="price_pen">Precio en Soles (PEN S/) *</label>
                  <input
                    id="price_pen"
                    type="number"
                    min="0"
                    step="0.5"
                    value={courseForm.price_pen}
                    onChange={(e) =>
                      setCourseForm({ ...courseForm, price_pen: parseFloat(e.target.value) || 0 })
                    }
                    placeholder="149.00"
                  />
                  <small className="field-hint">
                    Los cursos de pago solo admiten matrículas autorizadas (Yape/Plin / Admin).
                  </small>
                </div>
              )}

              <div className="checkbox-field">
                <input
                  type="checkbox"
                  id="is_published"
                  checked={courseForm.is_published}
                  onChange={(e) =>
                    setCourseForm({ ...courseForm, is_published: e.target.checked })
                  }
                />
                <label htmlFor="is_published">
                  <strong>Publicar curso en el catálogo</strong>
                  <span>
                    Si está marcado, el curso será visible para los estudiantes y el público.
                  </span>
                </label>
              </div>
            </div>
          </div>

          <div className="form-submit-row">
            <button type="submit" disabled={savingCourse} className="btn-primary">
              {savingCourse ? (
                <Loader2 size={16} className="animate-spin" style={{ marginRight: '6px' }} />
              ) : (
                <Save size={16} style={{ marginRight: '6px' }} />
              )}
              {isEditing ? 'Guardar Cambios del Curso' : 'Crear Curso y Continuar'}
            </button>
          </div>
        </form>
      )}

      {/* PESTAÑA 2: ESTRUCTURA EDUCATIVA (MÓDULOS Y LECCIONES) */}
      {activeTab === 'curriculum' && (
        <div className="curriculum-builder-container">
          <div className="curriculum-builder-header">
            <div>
              <h3>Módulos y Lecciones</h3>
              <p className="subtitle">
                Organiza el contenido formativo en módulos ordenados y lecciones con videos, prompts y recursos.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleOpenModuleModal()}
              className="btn-primary btn-sm"
            >
              <Plus size={16} style={{ marginRight: '6px' }} />
              Agregar Módulo
            </button>
          </div>

          {modules.length === 0 ? (
            <div className="placeholder-box" style={{ padding: '3rem 1.5rem' }}>
              <Layers size={40} className="text-muted" style={{ margin: '0 auto 1rem' }} />
              <h4>Aún no hay módulos en este curso</h4>
              <p>Comienza agregando el primer módulo para organizar las lecciones.</p>
              <button
                type="button"
                onClick={() => handleOpenModuleModal()}
                className="btn-secondary"
                style={{ marginTop: '1rem' }}
              >
                <Plus size={16} style={{ marginRight: '6px' }} />
                Crear Primer Módulo
              </button>
            </div>
          ) : (
            <div className="modules-builder-list">
              {modules.map((mod) => (
                <div key={mod.id} className="module-builder-card">
                  <div className="module-builder-header">
                    <div className="module-builder-title">
                      <span className="order-badge">Orden: {mod.order_index}</span>
                      <h4>{mod.title}</h4>
                      {mod.description && <span className="mod-desc-text">&bull; {mod.description}</span>}
                    </div>

                    <div className="module-builder-actions">
                      <button
                        type="button"
                        onClick={() => handleOpenLessonModal(mod.id)}
                        className="btn-secondary btn-xs"
                      >
                        <Plus size={14} style={{ marginRight: '4px' }} />
                        Agregar Lección
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenModuleModal(mod)}
                        className="btn-icon-subtle"
                        title="Editar módulo"
                      >
                        <Edit2 size={16} />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteModule(mod)}
                        className="btn-icon-danger"
                        title="Eliminar módulo"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Lista de lecciones del módulo */}
                  <div className="lessons-builder-list">
                    {(mod.lessons || []).length === 0 ? (
                      <div className="empty-lessons-notice">
                        Sin lecciones en este módulo.{' '}
                        <button
                          type="button"
                          onClick={() => handleOpenLessonModal(mod.id)}
                          className="link-btn"
                        >
                          Haz clic aquí para agregar la primera lección.
                        </button>
                      </div>
                    ) : (
                      (mod.lessons || []).map((les) => (
                        <div key={les.id} className="lesson-builder-row">
                          <div className="lesson-builder-info">
                            <span className="lesson-order-tag">#{les.order_index}</span>
                            <span className="lesson-title-text">{les.title}</span>

                            <div className="lesson-tags-inline">
                              {les.duration_minutes > 0 && (
                                <span className="mini-tag">
                                  <Clock size={11} /> {les.duration_minutes} min
                                </span>
                              )}
                              {les.is_preview ? (
                                <span className="mini-tag tag-preview">Vista Previa Libre</span>
                              ) : (
                                <span className="mini-tag tag-private">Restringida</span>
                              )}
                              {les.is_published ? (
                                <span className="mini-tag tag-pub">Publicada</span>
                              ) : (
                                <span className="mini-tag tag-draft">Borrador</span>
                              )}
                            </div>
                          </div>

                          <div className="lesson-builder-controls">
                            <button
                              type="button"
                              onClick={() => handleOpenLessonModal(mod.id, les)}
                              className="btn-secondary btn-xs"
                            >
                              <Edit2 size={13} style={{ marginRight: '4px' }} />
                              Editar Contenido
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteLesson(les)}
                              className="btn-icon-danger"
                              title="Eliminar lección"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL: CREAR / EDITAR MÓDULO */}
      {moduleModalOpen && (
        <div className="modal-backdrop" onClick={() => setModuleModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingModule ? 'Editar Módulo' : 'Nuevo Módulo'}</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setModuleModalOpen(false)}
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleSaveModule}>
              <div className="modal-body">
                <div className="form-group">
                  <label htmlFor="mod-title">Título del Módulo *</label>
                  <input
                    id="mod-title"
                    type="text"
                    required
                    value={moduleTitle}
                    onChange={(e) => setModuleTitle(e.target.value)}
                    placeholder="Ej. Fundamentos de Modelos de Lenguaje"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="mod-desc">Descripción breve (opcional)</label>
                  <input
                    id="mod-desc"
                    type="text"
                    value={moduleDescription}
                    onChange={(e) => setModuleDescription(e.target.value)}
                    placeholder="Ej. Introducción a tokens, embeddings y prompting..."
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="mod-order">Orden numérico</label>
                  <input
                    id="mod-order"
                    type="number"
                    min="1"
                    value={moduleOrder}
                    onChange={(e) => setModuleOrder(parseInt(e.target.value) || 1)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setModuleModalOpen(false)}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
                <button type="submit" disabled={savingModule} className="btn-primary">
                  {savingModule ? (
                    <Loader2 size={16} className="animate-spin" style={{ marginRight: '6px' }} />
                  ) : (
                    <Save size={16} style={{ marginRight: '6px' }} />
                  )}
                  Guardar Módulo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREAR / EDITAR LECCIÓN COMPLETA */}
      {lessonModalOpen && (
        <div className="modal-backdrop" onClick={() => setLessonModalOpen(false)}>
          <div
            className="modal-content modal-large"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }}
          >
            <div className="modal-header">
              <h3>{editingLesson ? `Editar Lección: ${lessonTitle}` : 'Nueva Lección'}</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setLessonModalOpen(false)}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveLesson}>
              <div className="editor-tabs-bar" style={{ padding: '0 1.5rem', borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}>
                <button
                  type="button"
                  className={`editor-tab-btn ${lessonActiveTab === 'config' ? 'active' : ''}`}
                  onClick={() => setLessonActiveTab('config')}
                >
                  <FileText size={16} />
                  <span>Configuración</span>
                </button>
                <button
                  type="button"
                  className={`editor-tab-btn ${lessonActiveTab === 'content' ? 'active' : ''}`}
                  onClick={() => setLessonActiveTab('content')}
                >
                  <Video size={16} />
                  <span>Video & Contenido</span>
                </button>
                <button
                  type="button"
                  className={`editor-tab-btn ${lessonActiveTab === 'resources' ? 'active' : ''}`}
                  onClick={() => setLessonActiveTab('resources')}
                >
                  <Layers size={16} />
                  <span>Recursos & Código</span>
                </button>
              </div>

              <div className="modal-body">
                {lessonActiveTab === 'config' && (
                  <>
                    <div className="form-grid-2">
                      <div className="form-group">
                    <label htmlFor="les-title">Título de la Lección *</label>
                    <input
                      id="les-title"
                      type="text"
                      required
                      value={lessonTitle}
                      onChange={(e) => setLessonTitle(e.target.value)}
                      placeholder="Ej. Configuración de API y Clientes"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="les-dur">Duración (minutos)</label>
                    <input
                      id="les-dur"
                      type="number"
                      min="0"
                      value={lessonDuration}
                      onChange={(e) => setLessonDuration(parseInt(e.target.value) || 0)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="les-desc">Descripción o resumen breve</label>
                  <input
                    id="les-desc"
                    type="text"
                    value={lessonDescription}
                    onChange={(e) => setLessonDescription(e.target.value)}
                    placeholder="Breve resumen de lo que se cubrirá en la lección..."
                  />
                </div>

                <div className="form-grid-3">
                  <div className="form-group">
                    <label htmlFor="les-order">Orden</label>
                    <input
                      id="les-order"
                      type="number"
                      min="1"
                      value={lessonOrder}
                      onChange={(e) => setLessonOrder(parseInt(e.target.value) || 1)}
                    />
                  </div>

                  <div className="checkbox-field" style={{ alignSelf: 'center', marginTop: '1.25rem' }}>
                    <input
                      type="checkbox"
                      id="les-published"
                      checked={lessonIsPublished}
                      onChange={(e) => setLessonIsPublished(e.target.checked)}
                    />
                    <label htmlFor="les-published">
                      <strong>Publicada</strong>
                    </label>
                  </div>

                  <div className="checkbox-field" style={{ alignSelf: 'center', marginTop: '1.25rem' }}>
                    <input
                      type="checkbox"
                      id="les-preview"
                      checked={lessonIsPreview}
                      onChange={(e) => setLessonIsPreview(e.target.checked)}
                    />
                    <label htmlFor="les-preview">
                      <strong>Vista Previa Libre</strong>
                    </label>
                  </div>
                </div>
                  </>
                )}

                {lessonActiveTab === 'content' && (
                  <>
                    <div className="form-group" style={{ marginTop: '1rem' }}>
                      <label htmlFor="les-video">
                        <Video size={16} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                        URL de Video (YouTube, Vimeo o archivo MP4 directo)
                      </label>
                      <input
                        id="les-video"
                        type="url"
                        value={lessonVideoUrl}
                        onChange={(e) => setLessonVideoUrl(e.target.value)}
                        placeholder="https://www.youtube.com/watch?v=... o https://vimeo.com/..."
                      />
                      <small className="field-hint">
                        Admite enlaces estándar de YouTube, shorts, Vimeo o URLs directas de video.
                      </small>
                    </div>

                    <div className="form-group">
                      <label htmlFor="les-content">
                        <FileText size={16} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                        Guía Escrita y Explicación (Soporta Markdown)
                      </label>
                      <textarea
                        id="les-content"
                        rows={8}
                        value={lessonContentMarkdown}
                        onChange={(e) => setLessonContentMarkdown(e.target.value)}
                        placeholder="Escribe el contenido educativo en formato Markdown (# Título, - Viñetas, **negrita**, etc.)..."
                        className="form-textarea"
                      />
                    </div>
                  </>
                )}

                {lessonActiveTab === 'resources' && (
                  <>
                    <div className="form-group" style={{ marginTop: '1rem' }}>
                  <label htmlFor="les-prompt">
                    <Sparkles size={16} style={{ verticalAlign: 'middle', marginRight: '6px', color: '#2563eb' }} />
                    Bloque de Prompt Copiable (Opcional)
                  </label>
                  <textarea
                    id="les-prompt"
                    rows={3}
                    value={lessonPromptText}
                    onChange={(e) => setLessonPromptText(e.target.value)}
                    placeholder="Pega aquí el prompt de IA que el estudiante podrá copiar con un clic..."
                    className="form-textarea"
                  />
                </div>

                {/* Bloque de Código Copiable */}
                <div className="form-grid-2">
                  <div className="form-group">
                    <label htmlFor="les-code-lang">Lenguaje del Código</label>
                    <select
                      id="les-code-lang"
                      value={lessonCodeLanguage}
                      onChange={(e) => setLessonCodeLanguage(e.target.value)}
                      className="form-select"
                    >
                      <option value="javascript">JavaScript</option>
                      <option value="typescript">TypeScript</option>
                      <option value="python">Python</option>
                      <option value="sql">SQL</option>
                      <option value="json">JSON</option>
                      <option value="bash">Bash / Shell</option>
                      <option value="html">HTML / CSS</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="les-code">
                    <Terminal size={16} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                    Bloque de Código Copiable (Opcional)
                  </label>
                  <textarea
                    id="les-code"
                    rows={4}
                    value={lessonCodeSnippet}
                    onChange={(e) => setLessonCodeSnippet(e.target.value)}
                    placeholder="Código fuente de muestra para la lección..."
                    className="form-textarea code-font"
                  />
                </div>

                {/* Recursos Descargables */}
                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <label>
                      <Download size={16} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                      Recursos y Enlaces Descargables
                    </label>
                    <button
                      type="button"
                      onClick={handleAddResourceRow}
                      className="btn-secondary btn-xs"
                    >
                      <Plus size={14} style={{ marginRight: '4px' }} />
                      Agregar Enlace
                    </button>
                  </div>

                  {lessonResources.length === 0 ? (
                    <small className="text-muted">Sin recursos externos adjuntos.</small>
                  ) : (
                    <div className="resources-builder-inputs">
                      {lessonResources.map((res, rIdx) => (
                        <div key={rIdx} className="resource-input-row">
                          <input
                            type="text"
                            placeholder="Nombre del recurso (ej. Guía PDF, Repositorio)"
                            value={res.title}
                            onChange={(e) => handleUpdateResourceRow(rIdx, 'title', e.target.value)}
                            style={{ flex: 1 }}
                          />
                          <input
                            type="url"
                            placeholder="https://..."
                            value={res.url}
                            onChange={(e) => handleUpdateResourceRow(rIdx, 'url', e.target.value)}
                            style={{ flex: 1.5 }}
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveResourceRow(rIdx)}
                            className="btn-icon-danger"
                            title="Eliminar recurso"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                  </>
                )}
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setLessonModalOpen(false)}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
                <button type="submit" disabled={savingLesson} className="btn-primary">
                  {savingLesson ? (
                    <Loader2 size={16} className="animate-spin" style={{ marginRight: '6px' }} />
                  ) : (
                    <Save size={16} style={{ marginRight: '6px' }} />
                  )}
                  Guardar Lección
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

-- ==============================================================================
-- VEX ACADEMY — Sprint 1: Núcleo Educativo LMS
-- Archivo: supabase/migrations/20261007000000_lms_core.sql
-- ==============================================================================
-- Compatible con el esquema base de autenticación y roles (supabase/schema.sql).
-- Provee el modelo para cursos, módulos, lecciones, contenido protegido,
-- matrículas y progreso de estudiantes con políticas RLS de alta seguridad.
-- ==============================================================================

-- 1. TABLA DE CURSOS (public.courses)
CREATE TABLE IF NOT EXISTS public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT DEFAULT '',
  thumbnail_url TEXT DEFAULT '',
  level TEXT NOT NULL DEFAULT 'Principiante' CHECK (level IN ('Principiante', 'Intermedio', 'Avanzado')),
  duration TEXT NOT NULL DEFAULT '4 semanas',
  price_pen NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  is_free BOOLEAN NOT NULL DEFAULT true,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT courses_price_free_check CHECK ((is_free = true AND price_pen = 0) OR (is_free = false AND price_pen > 0))
);

COMMENT ON TABLE public.courses IS 'Catálogo de cursos de la plataforma VEX ACADEMY.';

-- 2. TABLA DE MÓDULOS (public.modules)
CREATE TABLE IF NOT EXISTS public.modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  order_index INTEGER NOT NULL DEFAULT 1,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT modules_course_unique UNIQUE (id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_modules_course_id_order ON public.modules(course_id, order_index);
COMMENT ON TABLE public.modules IS 'Módulos o unidades temáticas de cada curso.';

-- 3. TABLA DE LECCIONES - METADATOS PÚBLICOS (public.lessons)
-- Contiene metadatos de la lección para catálogo y estructura.
CREATE TABLE IF NOT EXISTS public.lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  duration_minutes INTEGER NOT NULL DEFAULT 0 CHECK (duration_minutes >= 0),
  order_index INTEGER NOT NULL DEFAULT 1,
  is_published BOOLEAN NOT NULL DEFAULT true,
  is_preview BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT lessons_module_course_fk FOREIGN KEY (module_id, course_id) REFERENCES public.modules(id, course_id) ON DELETE CASCADE,
  CONSTRAINT lessons_course_unique UNIQUE (id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_lessons_module_id_order ON public.lessons(module_id, order_index);
CREATE INDEX IF NOT EXISTS idx_lessons_course_id ON public.lessons(course_id);
COMMENT ON TABLE public.lessons IS 'Metadatos de lecciones individuales dentro de cada módulo.';

-- 4. TABLA DE CONTENIDO PROTEGIDO DE LECCIONES (public.lesson_contents)
-- Aislado de la tabla lessons para aplicar RLS estricto sobre video_url, contenido y prompts.
CREATE TABLE IF NOT EXISTS public.lesson_contents (
  lesson_id UUID PRIMARY KEY REFERENCES public.lessons(id) ON DELETE CASCADE,
  video_url TEXT DEFAULT '',
  content_markdown TEXT DEFAULT '',
  code_snippet TEXT DEFAULT '',
  code_language TEXT DEFAULT 'javascript',
  prompt_text TEXT DEFAULT '',
  resources JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

COMMENT ON TABLE public.lesson_contents IS 'Contenido protegido de lecciones (videos, textos, prompts, código y recursos).';

-- 5. TABLA DE MATRÍCULAS (public.enrollments)
CREATE TABLE IF NOT EXISTS public.enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'cancelled')),
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT enrollments_user_course_unique UNIQUE (user_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_enrollments_user_id ON public.enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course_id ON public.enrollments(course_id);
COMMENT ON TABLE public.enrollments IS 'Matrículas de estudiantes en cursos.';

-- 6. TABLA DE PROGRESO DE LECCIONES (public.lesson_progress)
CREATE TABLE IF NOT EXISTS public.lesson_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT lesson_progress_user_lesson_unique UNIQUE (user_id, lesson_id),
  CONSTRAINT lesson_progress_lesson_course_fk FOREIGN KEY (lesson_id, course_id) REFERENCES public.lessons(id, course_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_lesson_progress_user_course ON public.lesson_progress(user_id, course_id);
COMMENT ON TABLE public.lesson_progress IS 'Estado de finalización de lecciones por estudiante.';

-- ==============================================================================
-- TRIGGERS DE ACTUALIZACIÓN AUTOMÁTICA DE updated_at
-- ==============================================================================

DROP TRIGGER IF EXISTS trigger_courses_updated_at ON public.courses;
CREATE TRIGGER trigger_courses_updated_at
  BEFORE UPDATE ON public.courses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_modules_updated_at ON public.modules;
CREATE TRIGGER trigger_modules_updated_at
  BEFORE UPDATE ON public.modules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_lessons_updated_at ON public.lessons;
CREATE TRIGGER trigger_lessons_updated_at
  BEFORE UPDATE ON public.lessons
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_lesson_contents_updated_at ON public.lesson_contents;
CREATE TRIGGER trigger_lesson_contents_updated_at
  BEFORE UPDATE ON public.lesson_contents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_enrollments_updated_at ON public.enrollments;
CREATE TRIGGER trigger_enrollments_updated_at
  BEFORE UPDATE ON public.enrollments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_lesson_progress_updated_at ON public.lesson_progress;
CREATE TRIGGER trigger_lesson_progress_updated_at
  BEFORE UPDATE ON public.lesson_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ==============================================================================
-- TRIGGER PARA INICIALIZAR lesson_contents AL CREAR UNA LECCIÓN
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_lesson()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.lesson_contents (lesson_id)
  VALUES (NEW.id)
  ON CONFLICT (lesson_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_lesson_created ON public.lessons;
CREATE TRIGGER on_lesson_created
  AFTER INSERT ON public.lessons
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_lesson();

-- ==============================================================================
-- FUNCIÓN RPC SEGURA PARA MATRICULARSE EN CURSOS GRATUITOS
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.enroll_in_free_course(p_course_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
  v_is_free BOOLEAN;
  v_is_published BOOLEAN;
  v_price NUMERIC;
  v_enrollment_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado.';
  END IF;

  SELECT is_free, is_published, price_pen
  INTO v_is_free, v_is_published, v_price
  FROM public.courses
  WHERE id = p_course_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Curso no encontrado.';
  END IF;

  IF NOT v_is_published THEN
    RAISE EXCEPTION 'El curso no está publicado actualmente.';
  END IF;

  IF NOT v_is_free THEN
    RAISE EXCEPTION 'Este curso es de pago y requiere una matrícula autorizada.';
  END IF;

  INSERT INTO public.enrollments (user_id, course_id, status)
  VALUES (v_user_id, p_course_id, 'active')
  ON CONFLICT (user_id, course_id) DO NOTHING
  RETURNING id INTO v_enrollment_id;

  IF v_enrollment_id IS NULL THEN
    SELECT id INTO v_enrollment_id 
    FROM public.enrollments 
    WHERE user_id = v_user_id AND course_id = p_course_id AND status = 'active';
    
    IF v_enrollment_id IS NULL THEN
      RAISE EXCEPTION 'Ya existe una matrícula previa que fue suspendida o cancelada. Contacta con soporte.';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'enrollment_id', v_enrollment_id,
    'course_id', p_course_id
  );
END;
$$;

COMMENT ON FUNCTION public.enroll_in_free_course(UUID) IS
  'Permite a un usuario autenticado matricularse de forma atómica y segura en cursos gratuitos publicados.';

-- ==============================================================================
-- PRIVILEGIOS DE ACCESO (REVOKE / GRANT)
-- ==============================================================================

REVOKE ALL ON TABLE public.courses FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.modules FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.lessons FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.lesson_contents FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.enrollments FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.lesson_progress FROM PUBLIC, anon, authenticated;

-- Courses: lectura pública para catálogo; escritura administrativa
GRANT SELECT ON TABLE public.courses TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.courses TO authenticated;

-- Modules: lectura pública para temario; escritura administrativa
GRANT SELECT ON TABLE public.modules TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.modules TO authenticated;

-- Lessons: lectura pública para temario; escritura administrativa
GRANT SELECT ON TABLE public.lessons TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.lessons TO authenticated;

-- Lesson Contents: lectura condicionada a RLS; escritura administrativa
GRANT SELECT ON TABLE public.lesson_contents TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.lesson_contents TO authenticated;

-- Enrollments: lectura y matriculación condicionada por RLS
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.enrollments TO authenticated;

-- Lesson Progress: gestión individual por estudiante con RLS
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.lesson_progress TO authenticated;

-- Función de matrícula gratuita
GRANT EXECUTE ON FUNCTION public.enroll_in_free_course(UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_lesson() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enroll_in_free_course(UUID) FROM PUBLIC;

-- ==============================================================================
-- POLÍTICAS ROW LEVEL SECURITY (RLS)
-- ==============================================================================

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 1. Políticas para COURSES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "courses_select_published" ON public.courses;
CREATE POLICY "courses_select_published"
  ON public.courses
  FOR SELECT
  TO anon, authenticated
  USING (is_published = true);

DROP POLICY IF EXISTS "courses_admin_all" ON public.courses;
CREATE POLICY "courses_admin_all"
  ON public.courses
  FOR ALL
  TO authenticated
  USING (app_private.has_role('admin'))
  WITH CHECK (app_private.has_role('admin'));

-- ------------------------------------------------------------------------------
-- 2. Políticas para MODULES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "modules_select_published" ON public.modules;
CREATE POLICY "modules_select_published"
  ON public.modules
  FOR SELECT
  TO anon, authenticated
  USING (
    is_published = true
    AND EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id AND c.is_published = true
    )
  );

DROP POLICY IF EXISTS "modules_admin_all" ON public.modules;
CREATE POLICY "modules_admin_all"
  ON public.modules
  FOR ALL
  TO authenticated
  USING (app_private.has_role('admin'))
  WITH CHECK (app_private.has_role('admin'));

-- ------------------------------------------------------------------------------
-- 3. Políticas para LESSONS (Metadatos)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "lessons_select_published" ON public.lessons;
CREATE POLICY "lessons_select_published"
  ON public.lessons
  FOR SELECT
  TO anon, authenticated
  USING (
    is_published = true
    AND EXISTS (
      SELECT 1 FROM public.modules m
      JOIN public.courses c ON c.id = m.course_id
      WHERE m.id = module_id
        AND m.is_published = true
        AND c.is_published = true
    )
  );

DROP POLICY IF EXISTS "lessons_admin_all" ON public.lessons;
CREATE POLICY "lessons_admin_all"
  ON public.lessons
  FOR ALL
  TO authenticated
  USING (app_private.has_role('admin'))
  WITH CHECK (app_private.has_role('admin'));

-- ------------------------------------------------------------------------------
-- 4. Políticas para LESSON_CONTENTS (Contenido Protegido)
-- Solo visible si es preview público, si el usuario tiene matrícula activa, o si es admin.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "lesson_contents_select_preview" ON public.lesson_contents;
CREATE POLICY "lesson_contents_select_preview"
  ON public.lesson_contents
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.lessons l
      JOIN public.courses c ON c.id = l.course_id
      WHERE l.id = lesson_contents.lesson_id
        AND l.is_published = true
        AND c.is_published = true
        AND l.is_preview = true
    )
  );

DROP POLICY IF EXISTS "lesson_contents_select_student" ON public.lesson_contents;
CREATE POLICY "lesson_contents_select_student"
  ON public.lesson_contents
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.lessons l
      JOIN public.courses c ON c.id = l.course_id
      WHERE l.id = lesson_contents.lesson_id
        AND l.is_published = true
        AND c.is_published = true
        AND EXISTS (
          SELECT 1 FROM public.enrollments e
          WHERE e.course_id = l.course_id
            AND e.user_id = (SELECT auth.uid())
            AND e.status = 'active'
        )
    )
  );

DROP POLICY IF EXISTS "lesson_contents_admin_all" ON public.lesson_contents;
CREATE POLICY "lesson_contents_admin_all"
  ON public.lesson_contents
  FOR ALL
  TO authenticated
  USING (app_private.has_role('admin'))
  WITH CHECK (app_private.has_role('admin'));

-- ------------------------------------------------------------------------------
-- 5. Políticas para ENROLLMENTS
-- El estudiante solo ve sus matrículas y solo puede insertar matrículas en cursos gratuitos.
-- No puede modificar matrículas para concederse accesos no autorizados.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "enrollments_select_own" ON public.enrollments;
CREATE POLICY "enrollments_select_own"
  ON public.enrollments
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "enrollments_insert_free" ON public.enrollments;
CREATE POLICY "enrollments_insert_free"
  ON public.enrollments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id
        AND c.is_published = true
        AND c.is_free = true
    )
  );

DROP POLICY IF EXISTS "enrollments_admin_all" ON public.enrollments;
CREATE POLICY "enrollments_admin_all"
  ON public.enrollments
  FOR ALL
  TO authenticated
  USING (app_private.has_role('admin'))
  WITH CHECK (app_private.has_role('admin'));

-- ------------------------------------------------------------------------------
-- 6. Políticas para LESSON_PROGRESS
-- Modificable únicamente por su propietario y con matrícula válida activa en el curso.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "progress_select_own" ON public.lesson_progress;
CREATE POLICY "progress_select_own"
  ON public.lesson_progress
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR app_private.has_role('admin')
  );

DROP POLICY IF EXISTS "progress_insert_own" ON public.lesson_progress;
CREATE POLICY "progress_insert_own"
  ON public.lesson_progress
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      user_id = (SELECT auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.enrollments e
        WHERE e.user_id = (SELECT auth.uid())
          AND e.course_id = lesson_progress.course_id
          AND e.status = 'active'
      )
    )
    OR app_private.has_role('admin')
  );

DROP POLICY IF EXISTS "progress_update_own" ON public.lesson_progress;
CREATE POLICY "progress_update_own"
  ON public.lesson_progress
  FOR UPDATE
  TO authenticated
  USING (
    (
      user_id = (SELECT auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.enrollments e
        WHERE e.user_id = (SELECT auth.uid())
          AND e.course_id = lesson_progress.course_id
          AND e.status = 'active'
      )
    )
    OR app_private.has_role('admin')
  )
  WITH CHECK (
    (
      user_id = (SELECT auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.enrollments e
        WHERE e.user_id = (SELECT auth.uid())
          AND e.course_id = lesson_progress.course_id
          AND e.status = 'active'
      )
    )
    OR app_private.has_role('admin')
  );

DROP POLICY IF EXISTS "progress_delete_own" ON public.lesson_progress;
CREATE POLICY "progress_delete_own"
  ON public.lesson_progress
  FOR DELETE
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR app_private.has_role('admin')
  );


-- ==============================================================================
-- VEX ACADEMY — Sprint 2: Pagos Manuales (Yape/Plin) y Notificaciones Telegram
-- Archivo: supabase/migrations/20261007010000_manual_payments_telegram.sql
-- ==============================================================================
-- Provee el modelo de datos para solicitudes de pago Yape/Plin, almacenamiento
-- privado de comprobantes, delegación de encargados de revisión y cola de
-- notificaciones para Telegram con funciones RPC atómicas y seguras.
-- ==============================================================================

-- 1. TABLA DE ENCARGADOS DE REVISIÓN DE PAGOS (public.payment_reviewers)
-- Tabla independiente para delegar revisión de pagos sin modificar los roles principales.
CREATE TABLE IF NOT EXISTS public.payment_reviewers (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

COMMENT ON TABLE public.payment_reviewers IS 'Usuarios autorizados para revisar y aprobar/rechazar pagos Yape/Plin.';

-- 2. TABLA DE SOLICITUDES DE PAGO (public.payment_requests)
CREATE TABLE IF NOT EXISTS public.payment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('yape', 'plin')),
  amount_pen NUMERIC(10, 2) NOT NULL CHECK (amount_pen > 0),
  proof_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT DEFAULT NULL,
  reviewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  processed_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

-- Índice único parcial para impedir solicitudes duplicadas pendientes para el mismo curso y estudiante
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_requests_pending_unique 
  ON public.payment_requests(user_id, course_id) 
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_payment_requests_user_id ON public.payment_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_status ON public.payment_requests(status);
CREATE INDEX IF NOT EXISTS idx_payment_requests_course_id ON public.payment_requests(course_id);

COMMENT ON TABLE public.payment_requests IS 'Solicitudes de pago manual Yape/Plin reportadas por estudiantes.';

-- 3. TABLA COLA DE NOTIFICACIONES TELEGRAM (public.telegram_notification_queue)
CREATE TABLE IF NOT EXISTS public.telegram_notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (event_type IN ('payment_submitted', 'payment_approved', 'payment_rejected', 'test_notification')),
  payment_request_id UUID REFERENCES public.payment_requests(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  processed_at TIMESTAMPTZ DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_telegram_queue_status ON public.telegram_notification_queue(status);
COMMENT ON TABLE public.telegram_notification_queue IS 'Cola persistente de notificaciones para enviar al grupo de Telegram.';

-- Trigger para actualizar updated_at en payment_requests
DROP TRIGGER IF EXISTS trigger_payment_requests_updated_at ON public.payment_requests;
CREATE TRIGGER trigger_payment_requests_updated_at
  BEFORE UPDATE ON public.payment_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ==============================================================================
-- FUNCIÓN PRIVADA DE VERIFICACIÓN DE PERMISOS DE REVISIÓN DE PAGOS
-- ==============================================================================

CREATE OR REPLACE FUNCTION app_private.is_payment_reviewer()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = (SELECT auth.uid()) AND role = 'admin'::public.app_role
    UNION
    SELECT 1 FROM public.payment_reviewers WHERE user_id = (SELECT auth.uid())
  );
$$;

COMMENT ON FUNCTION app_private.is_payment_reviewer() IS
  'Comprueba si el usuario actual (auth.uid()) es administrador general o encargado de pagos autorizado.';

-- ==============================================================================
-- FUNCIONES RPC ATÓMICAS Y SEGURAS PARA PAGOS YAPE/PLIN
-- ==============================================================================

-- 1. Crear solicitud de pago (Estudiante)
CREATE OR REPLACE FUNCTION public.create_payment_request(
  p_course_id UUID,
  p_payment_method TEXT,
  p_proof_url TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
  v_user_email TEXT;
  v_course_title TEXT;
  v_course_price NUMERIC(10, 2);
  v_is_free BOOLEAN;
  v_is_published BOOLEAN;
  v_request_id UUID;
  v_existing_enrollment UUID;
  v_existing_pending UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado.';
  END IF;

  IF p_payment_method NOT IN ('yape', 'plin') THEN
    RAISE EXCEPTION 'Método de pago no válido. Debe ser yape o plin.';
  END IF;

  IF p_proof_url IS NULL OR pg_catalog.btrim(p_proof_url) = '' THEN
    RAISE EXCEPTION 'Debe proporcionar la ruta del comprobante adjunto.';
  END IF;

  -- 1. Verificar información del curso desde la base de datos (NUNCA confiar en precios del cliente)
  SELECT title, price_pen, is_free, is_published
  INTO v_course_title, v_course_price, v_is_free, v_is_published
  FROM public.courses
  WHERE id = p_course_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El curso especificado no existe.';
  END IF;

  IF NOT v_is_published THEN
    RAISE EXCEPTION 'El curso no se encuentra publicado actualmente.';
  END IF;

  IF v_is_free OR v_course_price <= 0 THEN
    RAISE EXCEPTION 'Este curso es gratuito. Utiliza la función de matrícula directa.';
  END IF;

  -- 2. Verificar que no esté matriculado previamente
  SELECT id INTO v_existing_enrollment
  FROM public.enrollments
  WHERE user_id = v_user_id AND course_id = p_course_id AND status = 'active';

  IF v_existing_enrollment IS NOT NULL THEN
    RAISE EXCEPTION 'Ya te encuentras matriculado activamente en este curso.';
  END IF;

  -- 3. Verificar que no tenga ya una solicitud pendiente
  SELECT id INTO v_existing_pending
  FROM public.payment_requests
  WHERE user_id = v_user_id AND course_id = p_course_id AND status = 'pending';

  IF v_existing_pending IS NOT NULL THEN
    RAISE EXCEPTION 'Ya tienes una solicitud de pago pendiente de revisión para este curso.';
  END IF;

  -- 4. Insertar la solicitud de pago
  INSERT INTO public.payment_requests (
    user_id,
    course_id,
    payment_method,
    amount_pen,
    proof_url,
    status
  )
  VALUES (
    v_user_id,
    p_course_id,
    p_payment_method,
    v_course_price,
    p_proof_url,
    'pending'
  )
  RETURNING id INTO v_request_id;

  -- 5. Encolar notificación para Telegram (solo datos generales, sin PII ni archivos sensibles)
  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

  INSERT INTO public.telegram_notification_queue (
    event_type,
    payment_request_id,
    payload,
    status
  )
  VALUES (
    'payment_submitted',
    v_request_id,
    jsonb_build_object(
      'request_id', v_request_id,
      'course_title', v_course_title,
      'amount_pen', v_course_price,
      'payment_method', p_payment_method,
      'user_email_masked', pg_catalog.concat(pg_catalog.substr(v_user_email, 1, 3), '***@***'),
      'status', 'pending'
    ),
    'pending'
  );

  RETURN jsonb_build_object(
    'success', true,
    'request_id', v_request_id,
    'amount_pen', v_course_price,
    'status', 'pending'
  );
END;
$$;

-- 2. Aprobar solicitud de pago y matricular (Encargado / Admin)
CREATE OR REPLACE FUNCTION public.approve_payment_request(p_request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_reviewer_id UUID;
  v_request_record RECORD;
  v_course_title TEXT;
  v_enrollment_id UUID;
BEGIN
  v_reviewer_id := auth.uid();
  IF v_reviewer_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado.';
  END IF;

  -- Verificar si es encargado o admin
  IF NOT app_private.is_payment_reviewer() THEN
    RAISE EXCEPTION 'No dispones de permisos para revisar y aprobar pagos.';
  END IF;

  -- Bloquear fila para evitar condiciones de carrera/aprobaciones duplicadas
  SELECT pr.*, c.title as course_title
  INTO v_request_record
  FROM public.payment_requests pr
  JOIN public.courses c ON c.id = pr.course_id
  WHERE pr.id = p_request_id
  FOR UPDATE OF pr;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La solicitud de pago especificada no existe.';
  END IF;

  IF v_request_record.status != 'pending' THEN
    RAISE EXCEPTION 'La solicitud ya fue procesada previamente (Estado actual: %).', v_request_record.status;
  END IF;

  -- 1. Actualizar estado de la solicitud
  UPDATE public.payment_requests
  SET status = 'approved',
      reviewer_id = v_reviewer_id,
      processed_at = pg_catalog.now(),
      updated_at = pg_catalog.now()
  WHERE id = p_request_id;

  -- 2. Matricular atómicamente al estudiante
  INSERT INTO public.enrollments (user_id, course_id, status, enrolled_at)
  VALUES (v_request_record.user_id, v_request_record.course_id, 'active', pg_catalog.now())
  ON CONFLICT (user_id, course_id) DO UPDATE
  SET status = 'active',
      updated_at = pg_catalog.now()
  RETURNING id INTO v_enrollment_id;

  -- 3. Encolar aviso de aprobación para Telegram
  INSERT INTO public.telegram_notification_queue (
    event_type,
    payment_request_id,
    payload,
    status
  )
  VALUES (
    'payment_approved',
    p_request_id,
    jsonb_build_object(
      'request_id', p_request_id,
      'course_title', v_request_record.course_title,
      'amount_pen', v_request_record.amount_pen,
      'payment_method', v_request_record.payment_method,
      'reviewer_id', v_reviewer_id,
      'status', 'approved'
    ),
    'pending'
  );

  RETURN jsonb_build_object(
    'success', true,
    'request_id', p_request_id,
    'enrollment_id', v_enrollment_id,
    'status', 'approved'
  );
END;
$$;

-- 3. Rechazar solicitud de pago (Encargado / Admin)
CREATE OR REPLACE FUNCTION public.reject_payment_request(
  p_request_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_reviewer_id UUID;
  v_request_record RECORD;
BEGIN
  v_reviewer_id := auth.uid();
  IF v_reviewer_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado.';
  END IF;

  IF NOT app_private.is_payment_reviewer() THEN
    RAISE EXCEPTION 'No dispones de permisos para revisar y rechazar pagos.';
  END IF;

  IF p_reason IS NULL OR pg_catalog.btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'Debe indicar el motivo del rechazo para informar al estudiante.';
  END IF;

  SELECT pr.*, c.title as course_title
  INTO v_request_record
  FROM public.payment_requests pr
  JOIN public.courses c ON c.id = pr.course_id
  WHERE pr.id = p_request_id
  FOR UPDATE OF pr;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La solicitud de pago no existe.';
  END IF;

  IF v_request_record.status != 'pending' THEN
    RAISE EXCEPTION 'La solicitud ya fue procesada previamente.';
  END IF;

  -- 1. Actualizar a rechazado
  UPDATE public.payment_requests
  SET status = 'rejected',
      rejection_reason = pg_catalog.btrim(p_reason),
      reviewer_id = v_reviewer_id,
      processed_at = pg_catalog.now(),
      updated_at = pg_catalog.now()
  WHERE id = p_request_id;

  -- 2. Encolar aviso de rechazo en Telegram
  INSERT INTO public.telegram_notification_queue (
    event_type,
    payment_request_id,
    payload,
    status
  )
  VALUES (
    'payment_rejected',
    p_request_id,
    jsonb_build_object(
      'request_id', p_request_id,
      'course_title', v_request_record.course_title,
      'amount_pen', v_request_record.amount_pen,
      'payment_method', v_request_record.payment_method,
      'reason', pg_catalog.btrim(p_reason),
      'status', 'rejected'
    ),
    'pending'
  );

  RETURN jsonb_build_object(
    'success', true,
    'request_id', p_request_id,
    'status', 'rejected'
  );
END;
$$;

-- 4. Asignar / Revocar Encargados de Pago (Solo Administrador)
CREATE OR REPLACE FUNCTION public.manage_payment_reviewer(
  p_target_user_id UUID,
  p_action TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT app_private.has_role('admin') THEN
    RAISE EXCEPTION 'Solo los administradores principales pueden designar o revocar encargados de pago.';
  END IF;

  IF p_action = 'add' THEN
    INSERT INTO public.payment_reviewers (user_id, assigned_by)
    VALUES (p_target_user_id, auth.uid())
    ON CONFLICT (user_id) DO NOTHING;
  ELSIF p_action = 'remove' THEN
    DELETE FROM public.payment_reviewers
    WHERE user_id = p_target_user_id;
  ELSE
    RAISE EXCEPTION 'Acción inválida. Utilice "add" o "remove".';
  END IF;

  RETURN jsonb_build_object('success', true, 'target_user_id', p_target_user_id, 'action', p_action);
END;
$$;

-- 5. Encolar Notificación de Prueba para Telegram (Solo Administrador / Encargado)
CREATE OR REPLACE FUNCTION public.enqueue_telegram_test_notification()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_queue_id UUID;
BEGIN
  IF NOT app_private.is_payment_reviewer() THEN
    RAISE EXCEPTION 'No estás autorizado para enviar notificaciones de prueba.';
  END IF;

  INSERT INTO public.telegram_notification_queue (
    event_type,
    payload,
    status
  )
  VALUES (
    'test_notification',
    jsonb_build_object(
      'message', 'Notificación de prueba enviada desde el panel administrativo de VEX ACADEMY.',
      'sent_by', (SELECT auth.uid()),
      'timestamp', pg_catalog.now()
    ),
    'pending'
  )
  RETURNING id INTO v_queue_id;

  RETURN jsonb_build_object('success', true, 'queue_id', v_queue_id);
END;
$$;

-- ==============================================================================
-- BUCKET DE SUPABASE STORAGE Y POLÍTICAS RLS SEGURAS
-- ==============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', false)
ON CONFLICT (id) DO NOTHING;

-- RLS en storage.objects
-- 1. Estudiante sube comprobantes ÚNICAMENTE dentro de su carpeta aislada: payment-proofs/{auth.uid()}/*
DROP POLICY IF EXISTS "payment_proofs_insert_own" ON storage.objects;
CREATE POLICY "payment_proofs_insert_own"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'payment-proofs'
    AND (SELECT auth.uid())::text = (storage.foldername(name))[1]
  );

-- 2. Lectura aislada: El estudiante solo lee sus propios comprobantes; encargados/admins leen todos.
DROP POLICY IF EXISTS "payment_proofs_select_own_or_reviewer" ON storage.objects;
CREATE POLICY "payment_proofs_select_own_or_reviewer"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND (
      (SELECT auth.uid())::text = (storage.foldername(name))[1]
      OR app_private.is_payment_reviewer()
    )
  );

-- ==============================================================================
-- PRIVILEGIOS Y POLÍTICAS DE ROW LEVEL SECURITY (RLS)
-- ==============================================================================

REVOKE ALL ON TABLE public.payment_requests FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.payment_reviewers FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.telegram_notification_queue FROM PUBLIC, anon, authenticated;

-- Permisos en payment_requests
GRANT SELECT ON TABLE public.payment_requests TO authenticated;
GRANT INSERT ON TABLE public.payment_requests TO authenticated;

-- Permisos en payment_reviewers
GRANT SELECT ON TABLE public.payment_reviewers TO authenticated;

-- Habilitar RLS
ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_reviewers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_notification_queue ENABLE ROW LEVEL SECURITY;

-- Políticas payment_requests
DROP POLICY IF EXISTS "payment_requests_select" ON public.payment_requests;
CREATE POLICY "payment_requests_select"
  ON public.payment_requests
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR app_private.is_payment_reviewer()
  );

DROP POLICY IF EXISTS "payment_requests_insert_own" ON public.payment_requests;
CREATE POLICY "payment_requests_insert_own"
  ON public.payment_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
  );

-- Políticas payment_reviewers
DROP POLICY IF EXISTS "payment_reviewers_select" ON public.payment_reviewers;
CREATE POLICY "payment_reviewers_select"
  ON public.payment_reviewers
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR app_private.has_role('admin')
  );

-- Conceder ejecución de RPCs
GRANT EXECUTE ON FUNCTION public.create_payment_request(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_payment_request(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_payment_request(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manage_payment_reviewer(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_telegram_test_notification() TO authenticated;

REVOKE EXECUTE ON FUNCTION app_private.is_payment_reviewer() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION app_private.is_payment_reviewer() TO authenticated;


-- 20261008000000_notifications_system.sql

-- 1. Tabla de notificaciones
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('success', 'error', 'info', 'warning')),
  read BOOLEAN NOT NULL DEFAULT false,
  action_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

CREATE INDEX notifications_user_id_idx ON public.notifications(user_id);

-- 2. Habilitar RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios pueden ver sus propias notificaciones"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Usuarios pueden actualizar sus propias notificaciones"
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Opcional: restringir columnas actualizables a nivel PostgreSQL para máxima seguridad
REVOKE ALL ON public.notifications FROM PUBLIC, authenticated, anon;
GRANT SELECT ON public.notifications TO authenticated;
GRANT UPDATE (read) ON public.notifications TO authenticated;

-- (No se añaden políticas ni grants de INSERT/DELETE para frontend)

-- Habilitar Realtime para notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- 3. Modificar approve_payment_request
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

  IF NOT app_private.is_payment_reviewer() THEN
    RAISE EXCEPTION 'No dispones de permisos para revisar y aprobar pagos.';
  END IF;

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

  UPDATE public.payment_requests
  SET status = 'approved',
      reviewer_id = v_reviewer_id,
      processed_at = pg_catalog.now(),
      updated_at = pg_catalog.now()
  WHERE id = p_request_id;

  INSERT INTO public.enrollments (user_id, course_id, status, enrolled_at)
  VALUES (v_request_record.user_id, v_request_record.course_id, 'active', pg_catalog.now())
  ON CONFLICT (user_id, course_id) DO UPDATE
  SET status = 'active',
      updated_at = pg_catalog.now()
  RETURNING id INTO v_enrollment_id;

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

  -- INSERCIÓN DE NOTIFICACIÓN EN EL SISTEMA
  INSERT INTO public.notifications (
    user_id,
    title,
    message,
    type,
    action_url
  ) VALUES (
    v_request_record.user_id,
    'Pago aprobado',
    'Ya puedes acceder al curso ' || v_request_record.course_title || '.',
    'success',
    '/courses/' || v_request_record.course_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'request_id', p_request_id,
    'enrollment_id', v_enrollment_id,
    'status', 'approved'
  );
END;
$$;

-- 4. Modificar reject_payment_request
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

  UPDATE public.payment_requests
  SET status = 'rejected',
      rejection_reason = pg_catalog.btrim(p_reason),
      reviewer_id = v_reviewer_id,
      processed_at = pg_catalog.now(),
      updated_at = pg_catalog.now()
  WHERE id = p_request_id;

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

  -- INSERCIÓN DE NOTIFICACIÓN EN EL SISTEMA
  INSERT INTO public.notifications (
    user_id,
    title,
    message,
    type
  ) VALUES (
    v_request_record.user_id,
    'Pago rechazado',
    'Tu comprobante para ' || v_request_record.course_title || ' no pudo ser aprobado. Motivo: ' || pg_catalog.btrim(p_reason),
    'error'
  );

  RETURN jsonb_build_object(
    'success', true,
    'request_id', p_request_id,
    'status', 'rejected'
  );
END;
$$;


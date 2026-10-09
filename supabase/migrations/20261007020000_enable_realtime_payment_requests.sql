-- ==============================================================================
-- VEX ACADEMY — Habilitar Supabase Realtime para Solicitudes de Pago
-- Archivo: supabase/migrations/20261007020000_enable_realtime_payment_requests.sql
-- ==============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_requests;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;


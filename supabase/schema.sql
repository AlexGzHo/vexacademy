-- ==============================================================================
-- VEX ACADEMY — Esquema de Base de Datos para Autenticación y Control de Roles
-- Archivo: supabase/schema.sql
-- ==============================================================================
-- NOTA IMPORTANTE:
-- Este archivo es para revisión y versionado. NO se ejecuta automáticamente.
-- Diseñado para ejecutarse de forma limpia en el SQL Editor de Supabase Cloud.
-- ==============================================================================

-- 1. ESQUEMA PRIVADO (app_private)
-- No expuesto a la Data API (PostgREST). Aloja funciones de seguridad internas.
CREATE SCHEMA IF NOT EXISTS app_private;

-- 2. TIPO ENUM DE ROLES (public.app_role)
-- Define estrictamente los roles admitidos en la plataforma.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_type t
    JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'app_role' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.app_role AS ENUM ('student', 'admin');
  END IF;
END $$;

-- 3. TABLA DE PERFILES (public.profiles)
-- Relación 1:1 con auth.users. Contiene únicamente datos personales editables.
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  avatar_url TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

COMMENT ON TABLE public.profiles IS 'Perfiles de usuario vinculados 1:1 con auth.users.';

-- 4. TABLA DE ROLES DE USUARIO (public.user_roles)
-- Separada de profiles para evitar escalado de privilegios.
CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'student',
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

COMMENT ON TABLE public.user_roles IS 'Asignación de roles de sistema protegida y aislada del perfil editable.';

-- 5. FUNCIÓN DE ACTUALIZACIÓN AUTOMÁTICA DE updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = pg_catalog.now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_profiles_updated_at ON public.profiles;
CREATE TRIGGER trigger_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 6. TRIGGER DE CREACIÓN AUTOMÁTICA DE PERFIL Y ROL (handle_new_user)
-- Se dispara tras INSERT en auth.users.
-- SECURITY DEFINER con search_path vacío y referencias explícitas completas.
-- Asigna estrictamente el rol 'student'; no confía en metadatos para privilegios admin.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_full_name pg_catalog.text;
BEGIN
 -- Extraer nombre completo desde los metadatos
v_full_name := NULLIF(
  pg_catalog.btrim(NEW.raw_user_meta_data->>'full_name'),
  ''
);

-- Fallback si no se proporcionó nombre
IF v_full_name IS NULL THEN
  v_full_name := COALESCE(
    NULLIF(
      pg_catalog.btrim(pg_catalog.split_part(NEW.email, '@', 1)),
      ''
    ),
    'Usuario'
  );
END IF;

  -- 1. Crear el perfil de usuario en public.profiles
  INSERT INTO public.profiles (id, full_name, avatar_url, created_at, updated_at)
  VALUES (NEW.id, v_full_name, NULL, pg_catalog.now(), pg_catalog.now())
  ON CONFLICT (id) DO UPDATE
  SET full_name = EXCLUDED.full_name,
      updated_at = pg_catalog.now();

  -- 2. Asignar exclusivamente rol 'student' (nunca aceptar rol del cliente)
  INSERT INTO public.user_roles (user_id, role, created_at)
  VALUES (NEW.id, 'student'::public.app_role, pg_catalog.now())
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Vincular trigger al evento AFTER INSERT de auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 7. FUNCIÓN PRIVADA DE SEGURIDAD has_role()
-- Ubicada en app_private para que no esté expuesta en la Data API (PostgREST).
-- Comprueba EXCLUSIVAMENTE el rol del usuario autenticado mediante auth.uid().
-- Evita inspeccionar roles de terceros y previene recursión RLS sobre user_roles.
CREATE OR REPLACE FUNCTION app_private.has_role(_role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = (SELECT auth.uid())
      AND role = _role
  );
$$;

COMMENT ON FUNCTION app_private.has_role(public.app_role) IS
  'Comprueba de forma segura si el usuario de la sesión actual (auth.uid()) tiene el rol solicitado.';

-- 8. GESTIÓN EXPLÍCITA DE PRIVILEGIOS (REVOKE / GRANT)

-- Revocar privilegios innecesarios de PUBLIC, anon y authenticated en el esquema privado
REVOKE ALL ON SCHEMA app_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA app_private TO authenticated;

-- Revocar ejecución pública en funciones
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.has_role(public.app_role) FROM PUBLIC, anon, authenticated;

-- Permitir ejecución de has_role únicamente a usuarios autenticados
GRANT EXECUTE ON FUNCTION app_private.has_role(public.app_role) TO authenticated;

-- Revocar todos los privilegios sobre las tablas antes de conceder mínimos requeridos
REVOKE ALL ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.user_roles FROM PUBLIC, anon, authenticated;

-- Concesión de privilegios mínimos en public.profiles:
-- SELECT permitido a usuarios autenticados (restringido por RLS a su propia fila).
GRANT SELECT ON TABLE public.profiles TO authenticated;

-- UPDATE permitido a authenticated ÚNICAMENTE sobre full_name y avatar_url.
-- No se puede modificar id, created_at ni updated_at desde el cliente.
GRANT UPDATE (full_name, avatar_url) ON TABLE public.profiles TO authenticated;

-- Concesión de privilegios mínimos en public.user_roles:
-- SELECT permitido a usuarios autenticados (restringido por RLS a su propio registro).
-- No se otorga INSERT, UPDATE ni DELETE a ningún rol del cliente.
GRANT SELECT ON TABLE public.user_roles TO authenticated;

-- 9. POLÍTICAS DE ROW LEVEL SECURITY (RLS)

-- Habilitar RLS en ambas tablas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Políticas para public.profiles
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Políticas para public.user_roles
-- Cada usuario autenticado consulta únicamente su propio rol (sin recursión)
DROP POLICY IF EXISTS "user_roles_select_own" ON public.user_roles;
CREATE POLICY "user_roles_select_own"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ==============================================================================
-- 10. PROCEDIMIENTO MANUAL PARA ASIGNAR ADMINISTRADORES
-- Para convertir un usuario en administrador, ejecutar manualmente en el
-- SQL Editor de Supabase (reemplazando por el correo correspondiente):
--
-- UPDATE public.user_roles
-- SET role = 'admin'
-- WHERE user_id = (SELECT id FROM auth.users WHERE email = 'tu_correo_admin@dominio.com');
-- ==============================================================================

-- ═══════════════════════════════════════════════════════════════════
-- ANMA — Tabla admin_alerts + trigger desde workspaces + RLS + realtime
-- ═══════════════════════════════════════════════════════════════════
-- Objetivo:
--   Persistir todas las alertas críticas para el admin (Ana):
--   nuevos signups, pagos, errores, expiraciones. Independiente del
--   canal (email/toast) — la tabla es la fuente de verdad.
--
-- Consume:
--   - useAdminAlerts hook (React) con realtime subscription
--   - Badge en NotificationBell del Topbar (visible en TODA la app,
--     no solo en /admin — resuelve el Bug #3 del audit Fase A)
--
-- Idempotente: seguro correr múltiples veces.
-- Aplica en el Supabase compartido de las 2 apps (Hub + Regalos).
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Tabla admin_alerts ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_alerts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type          text NOT NULL,                -- 'signup' | 'payment' | 'trial_expired' | 'error'
  title         text NOT NULL,
  body          text,
  workspace_id  uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
  meta          jsonb DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  read_at       timestamptz,
  dismissed_at  timestamptz
);

COMMENT ON TABLE public.admin_alerts IS
  'Alertas persistentes para el admin (Ana). Fuente de verdad para el badge del Topbar.';

CREATE INDEX IF NOT EXISTS idx_admin_alerts_unread
  ON public.admin_alerts (created_at DESC)
  WHERE read_at IS NULL AND dismissed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_admin_alerts_type
  ON public.admin_alerts (type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_alerts_workspace
  ON public.admin_alerts (workspace_id)
  WHERE workspace_id IS NOT NULL;

-- ── 2. RLS: solo Ana (email hardcoded) o global admin en metadata ─
ALTER TABLE public.admin_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_alerts_read ON public.admin_alerts;
CREATE POLICY admin_alerts_read ON public.admin_alerts
  FOR SELECT TO authenticated
  USING (
    (auth.jwt() ->> 'email') = 'ana.mbperalta@gmail.com'
    OR COALESCE(((auth.jwt() -> 'user_metadata') ->> 'is_global_admin')::boolean, false) = true
  );

DROP POLICY IF EXISTS admin_alerts_update ON public.admin_alerts;
CREATE POLICY admin_alerts_update ON public.admin_alerts
  FOR UPDATE TO authenticated
  USING (
    (auth.jwt() ->> 'email') = 'ana.mbperalta@gmail.com'
    OR COALESCE(((auth.jwt() -> 'user_metadata') ->> 'is_global_admin')::boolean, false) = true
  )
  WITH CHECK (
    (auth.jwt() ->> 'email') = 'ana.mbperalta@gmail.com'
    OR COALESCE(((auth.jwt() -> 'user_metadata') ->> 'is_global_admin')::boolean, false) = true
  );

-- INSERT solo se hace desde triggers SECURITY DEFINER (no desde clientes).
-- No hay policy de INSERT para authenticated → nadie desde el frontend inserta directo.

-- ── 3. Trigger: workspace nuevo → admin_alert 'signup' ────────────
CREATE OR REPLACE FUNCTION public.log_workspace_signup_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_wsname text;
BEGIN
  BEGIN
    -- Best-effort: sacar email del auth.users correspondiente
    SELECT u.email INTO v_email
    FROM auth.users u
    WHERE u.id = NEW.id
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_email := NULL;
  END;

  v_wsname := COALESCE(NULLIF(NEW.name, ''), v_email, 'sin nombre');

  INSERT INTO public.admin_alerts (type, title, body, workspace_id, meta)
  VALUES (
    'signup',
    'Nuevo signup: ' || v_wsname,
    'Se registró un nuevo workspace en ANMA. Contactalos para acompañar el onboarding.',
    NEW.id,
    jsonb_build_object(
      'plan',   NEW.plan,
      'name',   v_wsname,
      'email',  v_email,
      'seats',  NEW.seats_allowed
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- nunca bloquear la creación del workspace por culpa del logging
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_workspace_created_alert ON public.workspaces;
CREATE TRIGGER on_workspace_created_alert
  AFTER INSERT ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.log_workspace_signup_alert();

-- ── 4. Realtime: habilitar publication ────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'admin_alerts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_alerts;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════
-- ✓ DONE. Verificaciones (todas deben devolver > 0):
--
--   -- 1. La tabla existe:
--   SELECT count(*) FROM information_schema.tables
--   WHERE table_schema = 'public' AND table_name = 'admin_alerts';
--
--   -- 2. El trigger está armado:
--   SELECT tgname FROM pg_trigger WHERE tgname = 'on_workspace_created_alert';
--
--   -- 3. Realtime habilitado:
--   SELECT count(*) FROM pg_publication_tables
--   WHERE pubname = 'supabase_realtime' AND tablename = 'admin_alerts';
--
--   -- 4. RLS activo:
--   SELECT relrowsecurity FROM pg_class WHERE relname = 'admin_alerts';
--   -- Debe devolver 't' (true).
-- ═══════════════════════════════════════════════════════════════════

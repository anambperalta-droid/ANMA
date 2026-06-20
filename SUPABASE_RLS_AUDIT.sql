-- ═══════════════════════════════════════════════════════════════════
-- ANMA Hub — RLS Audit & Hardening
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════
--
-- Este script:
--  1. Habilita RLS en workspaces y memberships (si no está activo)
--  2. Crea políticas mínimas correctas
--  3. Verifica el estado actual
--
-- IDEMPOTENTE: se puede correr más de una vez sin romper nada.
-- ═══════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────
-- PASO 0 — Verificar estado actual de RLS
-- ─────────────────────────────────────────────────────────────────
-- Correlo primero SIN hacer cambios para ver qué hay:

SELECT
  schemaname,
  tablename,
  rowsecurity   AS rls_enabled,
  forcerowsecurity AS rls_forced
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('workspaces', 'memberships', 'workspace_payments')
ORDER BY tablename;

-- También ver las políticas existentes:
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('workspaces', 'memberships', 'workspace_payments')
ORDER BY tablename, policyname;


-- ─────────────────────────────────────────────────────────────────
-- PASO 1 — TABLA: workspaces
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

-- Admin global: acceso total
DROP POLICY IF EXISTS workspaces_admin_all ON workspaces;
CREATE POLICY workspaces_admin_all ON workspaces
  FOR ALL TO authenticated
  USING  (auth.jwt() ->> 'email' = 'ana.mbperalta@gmail.com')
  WITH CHECK (auth.jwt() ->> 'email' = 'ana.mbperalta@gmail.com');

-- Owner del workspace: lee y edita SU workspace
DROP POLICY IF EXISTS workspaces_owner_rw ON workspaces;
CREATE POLICY workspaces_owner_rw ON workspaces
  FOR ALL TO authenticated
  USING (
    id IN (
      SELECT workspace_id FROM memberships
      WHERE user_id = auth.uid()
        AND role = 'owner'
        AND status = 'active'
    )
  )
  WITH CHECK (
    id IN (
      SELECT workspace_id FROM memberships
      WHERE user_id = auth.uid()
        AND role = 'owner'
        AND status = 'active'
    )
  );

-- Operator/Viewer: solo lectura de su workspace
DROP POLICY IF EXISTS workspaces_member_read ON workspaces;
CREATE POLICY workspaces_member_read ON workspaces
  FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT workspace_id FROM memberships
      WHERE user_id = auth.uid()
        AND status = 'active'
    )
  );

-- Inserción al registrarse: un user puede crear UN workspace (el suyo)
-- La constraint de business logic (un owner = un workspace) se maneja en
-- la Edge Function invite-user y en Bienvenida.jsx, no solo en RLS.
DROP POLICY IF EXISTS workspaces_insert_own ON workspaces;
CREATE POLICY workspaces_insert_own ON workspaces
  FOR INSERT TO authenticated
  WITH CHECK (
    -- El workspace que se está insertando debe tener al user como owner
    -- en memberships. Como memberships se inserta en el mismo momento,
    -- usamos el id del workspace nuevo = auth.uid() (patrón ANMA actual).
    id = auth.uid()
    OR auth.jwt() ->> 'email' = 'ana.mbperalta@gmail.com'
  );


-- ─────────────────────────────────────────────────────────────────
-- PASO 2 — TABLA: memberships
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;

-- Admin global: acceso total
DROP POLICY IF EXISTS memberships_admin_all ON memberships;
CREATE POLICY memberships_admin_all ON memberships
  FOR ALL TO authenticated
  USING  (auth.jwt() ->> 'email' = 'ana.mbperalta@gmail.com')
  WITH CHECK (auth.jwt() ->> 'email' = 'ana.mbperalta@gmail.com');

-- Cualquier miembro activo puede leer las memberships de SU workspace
-- (necesario para que Config → Equipo muestre la lista de miembros)
DROP POLICY IF EXISTS memberships_workspace_read ON memberships;
CREATE POLICY memberships_workspace_read ON memberships
  FOR SELECT TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id FROM memberships m2
      WHERE m2.user_id = auth.uid()
        AND m2.status = 'active'
    )
  );

-- Solo el owner puede insertar nuevas memberships (invitar miembros)
DROP POLICY IF EXISTS memberships_owner_insert ON memberships;
CREATE POLICY memberships_owner_insert ON memberships
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM memberships m2
      WHERE m2.user_id = auth.uid()
        AND m2.role = 'owner'
        AND m2.status = 'active'
    )
    OR auth.jwt() ->> 'email' = 'ana.mbperalta@gmail.com'
  );

-- Solo el owner puede actualizar memberships (cambiar rol, desactivar)
DROP POLICY IF EXISTS memberships_owner_update ON memberships;
CREATE POLICY memberships_owner_update ON memberships
  FOR UPDATE TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id FROM memberships m2
      WHERE m2.user_id = auth.uid()
        AND m2.role = 'owner'
        AND m2.status = 'active'
    )
    OR auth.jwt() ->> 'email' = 'ana.mbperalta@gmail.com'
  );

-- Un user puede "salir" del workspace (actualizar su propia membership)
DROP POLICY IF EXISTS memberships_self_leave ON memberships;
CREATE POLICY memberships_self_leave ON memberships
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- ─────────────────────────────────────────────────────────────────
-- PASO 3 — workspace_payments (ya en SUPABASE_MP_MIGRATION.sql)
-- ─────────────────────────────────────────────────────────────────
-- Solo verificación — ya tiene RLS habilitado y las dos políticas:
--   payments_admin_all   → admin puede todo
--   payments_owner_read  → owner puede leer sus propios pagos

-- Confirmar que está habilitado:
SELECT rowsecurity FROM pg_tables WHERE tablename = 'workspace_payments';


-- ─────────────────────────────────────────────────────────────────
-- PASO 4 — Verificación final (correr al terminar)
-- ─────────────────────────────────────────────────────────────────
SELECT
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('workspaces', 'memberships', 'workspace_payments')
ORDER BY tablename, cmd;

-- Resultado esperado: cada tabla debe tener políticas para SELECT, INSERT,
-- UPDATE — y admin con ALL. Si una tabla aparece vacía, RLS fue habilitado
-- pero sin políticas: NADIE puede acceder (incluidos usuarios legítimos).
-- ═══════════════════════════════════════════════════════════════════

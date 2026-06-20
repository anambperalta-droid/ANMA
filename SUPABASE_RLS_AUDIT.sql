-- ═══════════════════════════════════════════════════════════════════
-- ANMA — VERIFICACIÓN de RLS (READ-ONLY)
-- ═══════════════════════════════════════════════════════════════════
--
-- ⚠️ ESTE ARCHIVO YA NO CREA POLÍTICAS.
--
-- El RLS real de ANMA vive en las migraciones (fuente de verdad):
--   supabase/migrations/20260424_workspaces_rbac.sql
--     → workspaces, memberships, audit_log, anma_user_data + helpers + trigger
--   supabase/migrations/20260523_normalized_schema.sql
--     → business_profiles + 11 tablas pro_*/regalos_* con RLS por workspace+rol
--   supabase/migrations/20260602_onboarding_rubro_tipo_venta.sql
--
-- La versión anterior de este archivo era incompleta (le faltaba anma_user_data
-- y las tablas normalizadas) y usaba un patrón owner_id que no coincide con el
-- esquema real (workspaces.id = auth.users.id). NO la uses.
--
-- Este script SOLO LEE el estado actual. Pegá todo en el SQL Editor → Run.
-- Compará el resultado con lo "esperado" que está al pie.
-- ═══════════════════════════════════════════════════════════════════


-- ── 1. ¿RLS habilitado en cada tabla con datos de inquilinos? ──────
SELECT
  tablename,
  CASE WHEN rowsecurity THEN 'ON' ELSE '*** OFF — REVISAR ***' END AS rls
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'workspaces','memberships','audit_log','anma_user_data','business_profiles',
    'workspace_payments',
    'pro_clients','pro_suppliers','pro_products','pro_insumos','pro_stock_moves','pro_budgets',
    'regalos_clients','regalos_products','regalos_budgets','regalos_assignments'
  )
ORDER BY rls, tablename;


-- ── 2. ¿Existen las funciones helper que usan las políticas? ───────
SELECT proname AS funcion_helper
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN ('my_workspace_ids','my_workspace_ids_text','is_global_admin','my_role')
ORDER BY proname;


-- ── 3. ¿Cuántas políticas tiene cada tabla? ───────────────────────
SELECT tablename, COUNT(*) AS politicas
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'workspaces','memberships','audit_log','anma_user_data','business_profiles',
    'workspace_payments',
    'pro_clients','pro_suppliers','pro_products','pro_insumos','pro_stock_moves','pro_budgets',
    'regalos_clients','regalos_products','regalos_budgets','regalos_assignments'
  )
GROUP BY tablename
ORDER BY tablename;


-- ── 4. ¿El trigger de auto-creación de workspace está activo? ──────
SELECT tgname AS trigger_name
FROM pg_trigger
WHERE tgname = 'on_auth_user_created_ws';


-- ═══════════════════════════════════════════════════════════════════
-- RESULTADO ESPERADO
-- ═══════════════════════════════════════════════════════════════════
-- Query 1: las 16 tablas con rls = 'ON'. Si alguna dice OFF → falta
--          aplicar la migración correspondiente.
-- Query 2: las 4 funciones helper presentes.
-- Query 3: cada tabla con 1+ políticas (la mayoría 3-4: select/insert/update/delete).
-- Query 4: una fila con on_auth_user_created_ws.
--
-- SI HAY GAPS (alguna tabla OFF, función faltante, 0 políticas):
--   Re-correr las migraciones en orden — son idempotentes (IF NOT EXISTS +
--   drop-policy-if-exists), no rompen nada al re-ejecutarse:
--     1) 20260424_workspaces_rbac.sql
--     2) 20260523_normalized_schema.sql
--     3) 20260602_onboarding_rubro_tipo_venta.sql
-- ═══════════════════════════════════════════════════════════════════

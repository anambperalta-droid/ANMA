-- ═══════════════════════════════════════════════════════════════════
-- ANMA — Fix: trigger copy_acquisition_from_user_metadata bloqueaba signups
-- ═══════════════════════════════════════════════════════════════════
-- BUG (detectado 27/06/2026):
--   La función copy_acquisition_from_user_metadata() (creada manualmente en
--   Supabase, NUNCA estuvo versionada en el repo) referenciaba NEW.owner_id,
--   un campo que NO existe en public.workspaces (la tabla usa `id` como
--   referencia al usuario/owner).
--
--   Como es un trigger BEFORE INSERT en workspaces, CADA creación de workspace
--   fallaba con: ERROR 42703 record "new" has no field "owner_id".
--   El trigger blindado de signup (ensure_workspace_for_new_user) atrapaba la
--   excepción con RAISE NOTICE → el signup "funcionaba" pero el workspace NUNCA
--   se creaba → usuarios quedaban en auth.users pero invisibles en el Admin
--   (que consulta public.workspaces).
--
-- FIX:
--   1. Reescribir la función con NEW.id (el campo correcto).
--   2. Blindarla con EXCEPTION → nunca más puede bloquear la creación del workspace.
--   3. Reparar workspaces/memberships huérfanos ya existentes.
--
-- Idempotente: seguro de correr múltiples veces. Cubre las 2 apps (Supabase
-- compartido paxsvjdimqlfxnlipplx: anma-pro + anma-regalos).
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Función corregida + blindada ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.copy_acquisition_from_user_metadata()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  meta jsonb;
BEGIN
  BEGIN
    SELECT raw_user_meta_data INTO meta
    FROM auth.users WHERE id = NEW.id LIMIT 1;

    NEW.acquisition_channel := COALESCE(NEW.acquisition_channel, meta ->> 'acquisition_channel');
    NEW.acquisition_source  := COALESCE(NEW.acquisition_source,  meta ->> 'acquisition_source');
  EXCEPTION WHEN OTHERS THEN
    NULL;  -- nunca bloquear la creación del workspace por culpa del tracking
  END;
  RETURN NEW;
END;
$$;

-- ── 2. Reparar workspaces huérfanos (usuarios sin workspace) ─────────
INSERT INTO public.workspaces (id, name, plan, seats_allowed)
SELECT u.id, coalesce(nullif(u.raw_user_meta_data ->> 'full_name',''), u.email), 'solo', 0
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = u.id)
ON CONFLICT (id) DO NOTHING;

-- ── 3. Reparar memberships owner huérfanas ───────────────────────────
INSERT INTO public.memberships (workspace_id, user_id, role, status)
SELECT u.id, u.id, 'owner', 'active'
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.memberships m
  WHERE m.workspace_id = u.id AND m.user_id = u.id
)
ON CONFLICT (workspace_id, user_id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════
-- ✓ DONE. Verificación (debe dar 0):
--   SELECT count(*) FROM auth.users u
--   WHERE NOT EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = u.id);
-- ═══════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────
-- ANMA — Channel tracking migration (Fase 2 del dashboard de métricas)
--
-- AGREGA columnas a workspaces para saber de dónde vinieron los signups.
-- Captura UTM params + referrer + landing page al momento del registro.
--
-- USO:
--   1. Abrí Supabase Dashboard → SQL Editor
--   2. Pegá todo este archivo y dale RUN
--   3. Deploy del frontend (commit `feat(tracking): capture acquisition data`)
--   4. A partir de ahí, los nuevos signups tendrán los datos. Los viejos
--      quedan con NULL — no se puede inferir retroactivamente.
--
-- COLUMNAS NUEVAS:
--   acquisition_channel  — categorización inferida: 'instagram', 'whatsapp',
--                          'google', 'directo', 'referido', 'desconocido'
--   acquisition_source   — texto exacto del utm_source (si vino)
--   utm_medium           — bio, story, post, paid_ad, organic, etc.
--   utm_campaign         — nombre de la campaña (ej. 'lanzamiento_junio')
--   utm_content          — variante del anuncio (A/B testing)
--   referrer             — document.referrer en el momento del signup
--   landing_page         — primera URL que vio el user (con query string)
--   acquired_at          — timestamp de cuando se capturó (= created_at del WS)
-- ───────────────────────────────────────────────────────────────────────

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS acquisition_channel TEXT,
  ADD COLUMN IF NOT EXISTS acquisition_source  TEXT,
  ADD COLUMN IF NOT EXISTS utm_medium          TEXT,
  ADD COLUMN IF NOT EXISTS utm_campaign        TEXT,
  ADD COLUMN IF NOT EXISTS utm_content         TEXT,
  ADD COLUMN IF NOT EXISTS referrer            TEXT,
  ADD COLUMN IF NOT EXISTS landing_page        TEXT,
  ADD COLUMN IF NOT EXISTS acquired_at         TIMESTAMPTZ DEFAULT NOW();

-- Index para queries de breakdown rápidas
CREATE INDEX IF NOT EXISTS idx_ws_acquisition_channel ON workspaces(acquisition_channel);
CREATE INDEX IF NOT EXISTS idx_ws_utm_campaign        ON workspaces(utm_campaign);

-- ───────────────────────────────────────────────────────────────────────
-- TRIGGER: cuando se crea un workspace nuevo, copiar acquisition_* del
-- user_metadata del owner (el frontend los pasa al signUp).
-- ───────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION copy_acquisition_from_user_metadata()
RETURNS TRIGGER AS $$
DECLARE
  user_meta JSONB;
BEGIN
  -- Buscar el user_metadata del owner del workspace (sin asumir owner_id)
  SELECT raw_user_meta_data INTO user_meta
  FROM auth.users
  WHERE id = NEW.owner_id
  LIMIT 1;

  IF user_meta IS NULL THEN RETURN NEW; END IF;

  NEW.acquisition_channel := COALESCE(NEW.acquisition_channel, user_meta->>'acquisition_channel');
  NEW.acquisition_source  := COALESCE(NEW.acquisition_source,  user_meta->>'acquisition_source');
  NEW.utm_medium          := COALESCE(NEW.utm_medium,          user_meta->>'utm_medium');
  NEW.utm_campaign        := COALESCE(NEW.utm_campaign,        user_meta->>'utm_campaign');
  NEW.utm_content         := COALESCE(NEW.utm_content,         user_meta->>'utm_content');
  NEW.referrer            := COALESCE(NEW.referrer,            user_meta->>'referrer');
  NEW.landing_page        := COALESCE(NEW.landing_page,        user_meta->>'landing_page');
  NEW.acquired_at         := COALESCE(NEW.acquired_at,         NOW());

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_workspace_acquisition ON workspaces;
CREATE TRIGGER trg_workspace_acquisition
  BEFORE INSERT ON workspaces
  FOR EACH ROW
  EXECUTE FUNCTION copy_acquisition_from_user_metadata();

-- ───────────────────────────────────────────────────────────────────────
-- VERIFICACIÓN — ejecutá esto después de crear un nuevo workspace de prueba
-- para confirmar que se llenan las columnas:
--
-- SELECT name, acquisition_channel, acquisition_source, utm_campaign, referrer
-- FROM workspaces ORDER BY created_at DESC LIMIT 5;
-- ───────────────────────────────────────────────────────────────────────

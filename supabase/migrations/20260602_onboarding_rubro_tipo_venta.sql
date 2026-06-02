-- =============================================================================
-- ANMA Pro — Onboarding Paso 1
-- Agrega columnas tipadas para Rubro y Tipo de Venta capturadas en el primer
-- contacto del usuario. Permite condicionar el comportamiento de la UI según
-- el modelo comercial.
-- Tabla afectada: public.business_profiles (representa la "tienda" del workspace)
-- Compatibilidad: nullable + check de valores permitidos, no rompe filas existentes.
-- Re-ejecutable: usa IF NOT EXISTS + DROP CONSTRAINT IF EXISTS.
-- =============================================================================

-- ── Rubro principal del negocio ─────────────────────────────────────────────
alter table public.business_profiles
  add column if not exists rubro text;

alter table public.business_profiles
  drop constraint if exists business_profiles_rubro_check;

alter table public.business_profiles
  add constraint business_profiles_rubro_check
  check (rubro is null or rubro in (
    'indumentaria',
    'tecnologia',
    'decoracion',
    'almacen'
  ));

-- ── Tipo de venta (modelo comercial / canal) ────────────────────────────────
alter table public.business_profiles
  add column if not exists tipo_venta text;

alter table public.business_profiles
  drop constraint if exists business_profiles_tipo_venta_check;

alter table public.business_profiles
  add constraint business_profiles_tipo_venta_check
  check (tipo_venta is null or tipo_venta in (
    'minorista',
    'mayorista',
    'ambos'
  ));

-- ── Flag de onboarding completo (para redirección condicional en el front) ──
alter table public.business_profiles
  add column if not exists onboarding_completed boolean not null default false;

-- ── Indices para queries de segmentación/analytics (rubro/tipo_venta) ───────
create index if not exists idx_business_profiles_rubro
  on public.business_profiles (rubro)
  where rubro is not null;

create index if not exists idx_business_profiles_tipo_venta
  on public.business_profiles (tipo_venta)
  where tipo_venta is not null;

-- Notas:
-- - Para identidad del negocio se usa el campo existente business_name.
-- - El front guarda los valores en cfg localStorage y sync.js los pushea al
--   blob anma_user_data; un ETL separado puede migrarlos a estas columnas
--   tipadas cuando se quiera correr analytics sobre rubros.

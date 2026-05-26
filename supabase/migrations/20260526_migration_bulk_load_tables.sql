-- ═══════════════════════════════════════════════════════════════════
-- ANMA — Migración Bulk Load v1
-- Paso 1: Columnas extra para migración masiva desde localStorage
--
-- Qué hace este archivo:
--   · Agrega external_id a todas las tablas principales (ancla de upsert
--     idempotente usando el id integer de localStorage).
--   · Agrega supplier_id, sku, image_url a pro_products (faltan en v1).
--   · Agrega supplier_id, sku, price_b2b a regalos_products (faltan en v1).
--   · Crea índices UNIQUE PARCIALES (WHERE external_id IS NOT NULL) para
--     ON CONFLICT (workspace_id, external_id) usado en el upsert JS.
--
-- Segura para re-ejecutar: IF NOT EXISTS / IF NOT EXISTS en índices,
-- ADD COLUMN IF NOT EXISTS en ALTER TABLE.
--
-- Requiere migración previa: 20260523_normalized_schema.sql
-- ═══════════════════════════════════════════════════════════════════


-- ── 1. pro_clients — external_id ────────────────────────────────────
alter table public.pro_clients
  add column if not exists external_id integer;

drop index if exists uidx_pro_clients_ext;
create unique index uidx_pro_clients_ext
  on public.pro_clients (workspace_id, external_id)
  where external_id is not null;


-- ── 2. pro_suppliers — external_id ──────────────────────────────────
alter table public.pro_suppliers
  add column if not exists external_id integer;

drop index if exists uidx_pro_suppliers_ext;
create unique index uidx_pro_suppliers_ext
  on public.pro_suppliers (workspace_id, external_id)
  where external_id is not null;


-- ── 3. pro_products — external_id + columnas faltantes ───────────────
-- supplier_id: referencia débil al proveedor (SET NULL si se elimina)
-- sku:         código de producto (texto libre)
-- image_url:   URL de imagen almacenada (no base64 — ver migracion.js)
alter table public.pro_products
  add column if not exists external_id  integer,
  add column if not exists supplier_id  uuid references public.pro_suppliers(id) on delete set null,
  add column if not exists sku          text,
  add column if not exists image_url    text;

drop index if exists uidx_pro_products_ext;
create unique index uidx_pro_products_ext
  on public.pro_products (workspace_id, external_id)
  where external_id is not null;

create index if not exists idx_pro_products_supplier
  on public.pro_products (supplier_id)
  where supplier_id is not null;


-- ── 4. pro_insumos — external_id ─────────────────────────────────────
-- supplier_id ya existe en v1; solo falta external_id
alter table public.pro_insumos
  add column if not exists external_id integer;

drop index if exists uidx_pro_insumos_ext;
create unique index uidx_pro_insumos_ext
  on public.pro_insumos (workspace_id, external_id)
  where external_id is not null;


-- ── 5. regalos_clients — external_id ────────────────────────────────
alter table public.regalos_clients
  add column if not exists external_id integer;

drop index if exists uidx_regalos_clients_ext;
create unique index uidx_regalos_clients_ext
  on public.regalos_clients (workspace_id, external_id)
  where external_id is not null;


-- ── 6. regalos_products — external_id + columnas faltantes ───────────
-- supplier_id: referencia a pro_suppliers (tabla compartida)
-- sku:         código de producto
-- price_b2b:   precio mayorista (opcional)
alter table public.regalos_products
  add column if not exists external_id  integer,
  add column if not exists supplier_id  uuid references public.pro_suppliers(id) on delete set null,
  add column if not exists sku          text,
  add column if not exists price_b2b    numeric(12,2);

drop index if exists uidx_regalos_products_ext;
create unique index uidx_regalos_products_ext
  on public.regalos_products (workspace_id, external_id)
  where external_id is not null;

create index if not exists idx_regalos_products_supplier
  on public.regalos_products (supplier_id)
  where supplier_id is not null;


-- ═══════════════════════════════════════════════════════════════════
-- FIN MIGRACIÓN 20260526_migration_bulk_load_tables.sql
-- Tablas modificadas: 6
--   pro_clients (+external_id)
--   pro_suppliers (+external_id)
--   pro_products (+external_id, +supplier_id, +sku, +image_url)
--   pro_insumos (+external_id)
--   regalos_clients (+external_id)
--   regalos_products (+external_id, +supplier_id, +sku, +price_b2b)
-- ═══════════════════════════════════════════════════════════════════

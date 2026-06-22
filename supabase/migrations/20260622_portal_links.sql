-- ═══════════════════════════════════════════════════════════════════
-- ANMA — Short-links del Portal de Proveedor
-- Reemplaza el payload gigante en la URL (?d=base64) por un id corto
-- (?id=ABC). El contenido se guarda acá. Cubre Hub y Regalos (mismo
-- proyecto Supabase). Correr en SQL Editor.
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.portal_links (
  id          text primary key,
  payload     jsonb not null,
  expires_at  timestamptz not null,
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now()
);

create index if not exists idx_portal_links_expires on public.portal_links (expires_at);

alter table public.portal_links enable row level security;

-- INSERT: cualquier usuario autenticado (dueño/operador) puede crear un link.
drop policy if exists portal_links_insert on public.portal_links;
create policy portal_links_insert on public.portal_links
  for insert to authenticated with check (true);

-- Sin policy de SELECT → ni anon ni authenticated pueden escanear la tabla.
-- La lectura pública es SOLO por id, vía esta función security definer.
create or replace function public.get_portal_link(link_id text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select payload from public.portal_links
  where id = link_id and expires_at > now()
$$;

grant execute on function public.get_portal_link(text) to anon, authenticated;

-- (Opcional) limpieza de links vencidos — correr cada tanto o desde el cron:
-- delete from public.portal_links where expires_at < now() - interval '7 days';

-- =============================================================================
-- Fog of the Dragon — homebrew content (monsters, NPCs, spells, magic items, feats, other rules)
--
-- One row per homebrew entry, private to its author. The entry's fields are structured JSON in `data`
-- ({"schema": 1, ...}; the app's homebrew model defines and validates the fields per kind). Never HTML.
-- Saving uses the same optimistic concurrency as adventures: the database bumps `version` on every update and the
-- editor saves "where version = <the version I loaded>".
-- =============================================================================

create table public.homebrew (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind        text not null check (kind in ('monster', 'npc', 'spell', 'magic-item', 'feat', 'other')),
  name        text not null check (char_length(btrim(name)) between 1 and 100),
  summary     text not null default '' check (char_length(summary) <= 300),
  data        jsonb not null default '{"schema": 1}'::jsonb,
  version     integer not null default 1,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- coalesce: a missing "schema" key must fail the check (a NULL result would let it pass)
  constraint homebrew_data_shape check (jsonb_typeof(data) = 'object' and coalesce(data ->> 'schema', '') = '1'),
  constraint homebrew_data_size check (octet_length(data::text) <= 100000)
);

create index homebrew_owner_updated_idx on public.homebrew (owner_id, updated_at desc);

comment on table public.homebrew is 'Homebrew rules content. Private to owner_id. data = {"schema":1, ...fields of the kind}.';
comment on column public.homebrew.version is 'Bumped by the database on every update; clients save with "where version = <loaded version>".';

create or replace function private.homebrew_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.version := old.version + 1;
    new.updated_at := now();
    new.created_at := old.created_at;
  else
    if (select count(*) from public.homebrew h where h.owner_id = new.owner_id) >= 2000 then
      raise exception 'You have reached the limit of 2000 homebrew entries.' using errcode = '23514';
    end if;
    new.version := 1;
  end if;
  return new;
end;
$$;

create trigger homebrew_before_write
  before insert or update on public.homebrew
  for each row execute function private.homebrew_before_write();

-- owner_id, kind, version and timestamps are never client-updatable.
revoke all on public.homebrew from anon, authenticated;
grant select, delete on public.homebrew to authenticated;
grant insert (owner_id, kind, name, summary, data) on public.homebrew to authenticated;
grant update (name, summary, data) on public.homebrew to authenticated;

alter table public.homebrew enable row level security;

create policy "Homebrew: owners read"
  on public.homebrew for select
  to authenticated
  using (owner_id = (select auth.uid()));

create policy "Homebrew: users create entries they own"
  on public.homebrew for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

create policy "Homebrew: owners update"
  on public.homebrew for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "Homebrew: owners delete"
  on public.homebrew for delete
  to authenticated
  using (owner_id = (select auth.uid()));

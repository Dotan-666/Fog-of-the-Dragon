-- =============================================================================
-- Fog of the Dragon — adventures (written adventure content)
--
-- An adventure is content a DM writes: details plus a structured outline
-- (chapters → sections) stored as validated JSON in `content`. It is private to
-- its author. Campaigns (actual games) stay separate; a campaign can optionally
-- point to one of its DM's adventures (campaigns.adventure_id). Nothing is copied.
--
-- Saving uses optimistic concurrency: the database bumps `version` on every
-- update, and clients update "where id = … and version = <the version I loaded>",
-- so a stale tab or device can never silently overwrite newer work.
-- =============================================================================

create table public.adventures (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title          text not null check (char_length(btrim(title)) between 1 and 100),
  description    text not null default '' check (char_length(description) <= 1000),
  cover_image    text check (cover_image is null or (cover_image like 'data:image/jpeg;base64,%' and char_length(cover_image) <= 200000)),
  genre          text not null default '' check (char_length(genre) <= 40),
  theme          text not null default '' check (char_length(theme) <= 80),
  level_min      smallint check (level_min between 1 and 20),
  level_max      smallint check (level_max between 1 and 20),
  playtime       text not null default '' check (char_length(playtime) <= 40),
  status         text not null default 'draft' check (status in ('draft', 'ready', 'archived')),
  notes          text not null default '' check (char_length(notes) <= 20000),
  content        jsonb not null default '{"schema": 1, "chapters": []}'::jsonb,
  chapter_count  integer not null default 0,
  section_count  integer not null default 0,
  version        integer not null default 1,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint adventures_level_range check (level_min is null or level_max is null or level_min <= level_max),
  constraint adventures_content_shape check (
    jsonb_typeof(content) = 'object'
    and jsonb_typeof(content -> 'chapters') = 'array'
    and (content ->> 'schema') = '1'
  ),
  constraint adventures_content_size check (octet_length(content::text) <= 2000000)
);

create index adventures_owner_updated_idx on public.adventures (owner_id, updated_at desc);

comment on table public.adventures is 'Written adventures. Private to owner_id. content = {"schema":1,"chapters":[{id,title,summary,dmNotes,sections:[{id,kind,title,playerText,dmNotes,fields}]}]}.';
comment on column public.adventures.version is 'Bumped by the database on every update; clients save with "where version = <loaded version>".';

-- Summary counts, version and timestamps are maintained by the database.
create or replace function private.adventures_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  ch jsonb;
  sections int := 0;
begin
  if jsonb_typeof(new.content) <> 'object' or jsonb_typeof(new.content -> 'chapters') is distinct from 'array' then
    -- Not an outline at all: leave it to the adventures_content_shape check to reject it.
    new.chapter_count := 0;
    new.section_count := 0;
    return new;
  end if;
  if jsonb_array_length(new.content -> 'chapters') > 100 then
    raise exception 'An adventure can have at most 100 chapters.' using errcode = '23514';
  end if;
  for ch in select * from jsonb_array_elements(new.content -> 'chapters') loop
    if jsonb_typeof(ch) <> 'object' or jsonb_typeof(ch -> 'sections') is distinct from 'array' then
      raise exception 'Each chapter must have a sections list.' using errcode = '23514';
    end if;
    if jsonb_array_length(ch -> 'sections') > 200 then
      raise exception 'A chapter can have at most 200 sections.' using errcode = '23514';
    end if;
    sections := sections + jsonb_array_length(ch -> 'sections');
  end loop;
  new.chapter_count := jsonb_array_length(new.content -> 'chapters');
  new.section_count := sections;
  if tg_op = 'UPDATE' then
    new.version := old.version + 1;
    new.updated_at := now();
    new.created_at := old.created_at;
  else
    new.version := 1;
  end if;
  return new;
end;
$$;

create trigger adventures_before_write
  before insert or update on public.adventures
  for each row execute function private.adventures_before_write();

-- -----------------------------------------------------------------------------
-- Privileges: owner_id, counts, version and timestamps are never client-writable.
-- -----------------------------------------------------------------------------
revoke all on public.adventures from anon, authenticated;
grant select, delete on public.adventures to authenticated;
grant insert (owner_id, title, description, cover_image, genre, theme, level_min, level_max, playtime, status, notes, content)
  on public.adventures to authenticated;
grant update (title, description, cover_image, genre, theme, level_min, level_max, playtime, status, notes, content)
  on public.adventures to authenticated;

alter table public.adventures enable row level security;

create policy "Adventures: owners read"
  on public.adventures for select
  to authenticated
  using (owner_id = (select auth.uid()));

create policy "Adventures: users create adventures they own"
  on public.adventures for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

create policy "Adventures: owners update"
  on public.adventures for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "Adventures: owners delete"
  on public.adventures for delete
  to authenticated
  using (owner_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- Optional link: a campaign can use one of its DM's adventures as its content.
-- -----------------------------------------------------------------------------
alter table public.campaigns
  add column adventure_id uuid references public.adventures (id) on delete set null;

create index campaigns_adventure_id_idx on public.campaigns (adventure_id) where adventure_id is not null;

comment on column public.campaigns.adventure_id is 'Optional: the DM''s adventure this campaign runs. Must belong to the campaign owner. Players cannot read the adventure.';

create or replace function private.campaigns_check_adventure()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.adventure_id is not null
     and not exists (select 1 from public.adventures a where a.id = new.adventure_id and a.owner_id = new.owner_id) then
    raise exception 'You can only link one of your own adventures.' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function private.campaigns_check_adventure() from public, anon, authenticated;

create trigger campaigns_check_adventure
  before insert or update of adventure_id on public.campaigns
  for each row execute function private.campaigns_check_adventure();

grant insert (adventure_id), update (adventure_id) on public.campaigns to authenticated;

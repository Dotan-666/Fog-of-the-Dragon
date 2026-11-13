-- =============================================================================
-- Minimal stand-in for the parts of a Supabase database the migrations rely on,
-- so they can be tested on a plain local Postgres (tests/db/rls.test.mjs).
-- Mirrors Supabase behaviour that matters for security:
--   * roles anon / authenticated / service_role
--   * auth.uid() read from the request's JWT claims
--   * Supabase's default grants: anon and authenticated get ALL on new public tables
-- This file is for tests only. Never run it against a real Supabase project.
-- =============================================================================

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
create table auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);

create function auth.uid() returns uuid
language sql stable
as $$
  select nullif(
    coalesce(
      current_setting('request.jwt.claim.sub', true),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    ),
    ''
  )::uuid;
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- Supabase grants broad table privileges by default; the migrations must narrow them.
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

-- Storage: just enough to evaluate the avatar policies.
create schema storage;
create table storage.buckets (
  id                 text primary key,
  name               text not null,
  public             boolean default false,
  file_size_limit    bigint,
  allowed_mime_types text[]
);
create table storage.objects (
  id        uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name      text not null,
  owner     uuid default auth.uid()
);
create function storage.foldername(name text) returns text[]
language plpgsql immutable
as $$
declare
  parts text[];
begin
  select string_to_array(name, '/') into parts;
  return parts[1:array_length(parts, 1) - 1];
end;
$$;
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated, service_role;
grant all on storage.objects, storage.buckets to anon, authenticated, service_role;
grant execute on function storage.foldername(text) to anon, authenticated, service_role;

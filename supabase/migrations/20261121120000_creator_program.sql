-- Creator Program: verified creator flag and application table.
-- Requires user approval (CLAUDE.md 5.4).

-- 1. Add verified-creator flag to profiles
alter table public.profiles
  add column if not exists is_verified_creator boolean not null default false;

comment on column public.profiles.is_verified_creator is
  'Set to true by an admin after reviewing a creator application. Allows paid marketplace listings.';

-- 2. Creator applications table
create table if not exists public.creator_applications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  full_name   text not null,
  email       text not null,
  portfolio_url text,
  content_types text[] not null default '{}',
  sample_pitch text not null,
  agreed_to_terms boolean not null default false,
  status      text not null default 'pending'
                check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  reviewer_note text,
  created_at  timestamptz not null default now()
);

comment on table public.creator_applications is
  'Applications from users who want to become verified creators on the marketplace.';

-- 3. RLS policies
alter table public.creator_applications enable row level security;

-- Users can insert their own applications
drop policy if exists "Users can submit creator applications" on public.creator_applications;
create policy "Users can submit creator applications"
  on public.creator_applications for insert
  to authenticated
  with check (
    user_id = auth.uid() or user_id is null
  );

-- Users can view their own applications
drop policy if exists "Users can view own creator applications" on public.creator_applications;
create policy "Users can view own creator applications"
  on public.creator_applications for select
  to authenticated
  using (user_id = auth.uid());

-- Anon users can submit (application from the public creators page)
drop policy if exists "Anon can submit creator applications" on public.creator_applications;
create policy "Anon can submit creator applications"
  on public.creator_applications for insert
  to anon
  with check (user_id is null);

-- Index for admin queries
create index if not exists idx_creator_applications_status
  on public.creator_applications(status);

create index if not exists idx_creator_applications_user
  on public.creator_applications(user_id)
  where user_id is not null;

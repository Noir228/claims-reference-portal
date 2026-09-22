-- CLAIMS REFERENCE PORTAL / SUPABASE SETUP
-- Run this entire file in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  notes text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Add Notes / Instructions to existing installations.
alter table public.entries
add column if not exists notes text not null default '';

create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.entries(id) on delete cascade,
  label text not null,
  type text,
  url text not null,
  kind text not null default 'pdf',
  file_name text,
  storage_path text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.entries enable row level security;
alter table public.attachments enable row level security;

-- Public visitors can read the reference database.
create policy "Public can read entries"
on public.entries for select using (true);

create policy "Public can read attachments"
on public.attachments for select using (true);

-- Helper: only authenticated users marked as administrators can modify data.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_admin = true
  );
$$;

create policy "Admins can insert entries"
on public.entries for insert to authenticated
with check (public.is_admin());

create policy "Admins can update entries"
on public.entries for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Admins can delete entries"
on public.entries for delete to authenticated
using (public.is_admin());

create policy "Admins can insert attachments"
on public.attachments for insert to authenticated
with check (public.is_admin());

create policy "Admins can update attachments"
on public.attachments for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Admins can delete attachments"
on public.attachments for delete to authenticated
using (public.is_admin());

-- Public document bucket. The database still controls who can add/delete files.
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', true)
on conflict (id) do update set public = true;

create policy "Public can view attachment files"
on storage.objects for select
using (bucket_id = 'attachments');

create policy "Admins can upload attachment files"
on storage.objects for insert to authenticated
with check (bucket_id = 'attachments' and public.is_admin());

create policy "Admins can update attachment files"
on storage.objects for update to authenticated
using (bucket_id = 'attachments' and public.is_admin())
with check (bucket_id = 'attachments' and public.is_admin());

create policy "Admins can delete attachment files"
on storage.objects for delete to authenticated
using (bucket_id = 'attachments' and public.is_admin());

-- After creating your admin user in Supabase Authentication,
-- run this with that user's UUID:
-- insert into public.profiles (id, is_admin) values ('YOUR-USER-UUID-HERE', true);


-- Video Tutorials
create table if not exists public.tutorial_videos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  storage_path text not null,
  url text not null,
  file_name text,
  created_at timestamptz not null default now()
);

alter table public.tutorial_videos enable row level security;

create policy "Public can read tutorial videos"
on public.tutorial_videos for select using (true);

create policy "Admins can insert tutorial videos"
on public.tutorial_videos for insert to authenticated
with check (public.is_admin());

create policy "Admins can update tutorial videos"
on public.tutorial_videos for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Admins can delete tutorial videos"
on public.tutorial_videos for delete to authenticated
using (public.is_admin());

insert into storage.buckets (id, name, public)
values ('tutorial-videos', 'tutorial-videos', true)
on conflict (id) do update set public = true;

create policy "Public can view tutorial video files"
on storage.objects for select
using (bucket_id = 'tutorial-videos');

create policy "Admins can upload tutorial video files"
on storage.objects for insert to authenticated
with check (bucket_id = 'tutorial-videos' and public.is_admin());

create policy "Admins can update tutorial video files"
on storage.objects for update to authenticated
using (bucket_id = 'tutorial-videos' and public.is_admin())
with check (bucket_id = 'tutorial-videos' and public.is_admin());

create policy "Admins can delete tutorial video files"
on storage.objects for delete to authenticated
using (bucket_id = 'tutorial-videos' and public.is_admin());

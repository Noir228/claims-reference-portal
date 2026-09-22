-- Claims Reference Portal: PDx, SDx and Submission Type migration
-- Run this once in the Supabase SQL Editor for an existing database.

alter table public.entries
add column if not exists pdx text not null default '';

alter table public.entries
add column if not exists sdx text not null default '';

alter table public.entries
add column if not exists submission_type text not null default '';

alter table public.entries alter column submission_type set default '';


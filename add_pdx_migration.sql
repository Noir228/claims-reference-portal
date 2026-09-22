-- Claims Reference Portal: PDx migration
-- Run this once in the Supabase SQL Editor for an existing database.

alter table public.entries
add column if not exists pdx text not null default '';

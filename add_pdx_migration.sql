-- Claims Reference Portal: PDx, SDx and Submission Type migration
-- Run this once in the Supabase SQL Editor for an existing database.

alter table public.entries
add column if not exists pdx text not null default '';

alter table public.entries
add column if not exists sdx text not null default '';

alter table public.entries
add column if not exists submission_type text not null default 'Direct Submit';

update public.entries
set submission_type = 'Direct Submit'
where submission_type is null or trim(submission_type) = '';

alter table public.attachments
add column if not exists important boolean not null default false;

update public.attachments
set important = false
where important is null;

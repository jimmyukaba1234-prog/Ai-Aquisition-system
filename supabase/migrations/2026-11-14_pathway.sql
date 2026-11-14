-- Adds the "Just visiting" / "Not ready yet" option to guests. Safe to run more than once.
alter table public.guests add column if not exists pathway text check (pathway in ('visitor', 'not_ready'));
alter table public.guests add column if not exists pathway_at timestamptz;
notify pgrst, 'reload schema';

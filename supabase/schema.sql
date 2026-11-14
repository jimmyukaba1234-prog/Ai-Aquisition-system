-- =====================================================================
-- Elevation Church Lekki: Guest Journey & Follow-up System
-- Run this once in Supabase: Dashboard -> SQL Editor -> New query -> Run.
-- Safe to re-run: it only creates what does not exist yet.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- roles ----------
do $$ begin
  create type public.app_role as enum ('pending', 'viewer', 'followup', 'acquisition', 'admin');
exception when duplicate_object then null; end $$;

-- ---------- team members (one row per login) ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  email       text,
  role        public.app_role not null default 'pending',
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------- app settings (single row) ----------
create table if not exists public.settings (
  id              int primary key default 1 check (id = 1),
  church_name     text not null default 'The Elevation Church, Lekki',
  followup_days   int  not null default 3,      -- Sunday + 3 days = Wednesday
  gt_stall_weeks  int  not null default 8,      -- Greatness Track "stalled" after this many weeks
  departments     text[] not null default array['Choir','Media','Ushering','Protocol','Children Church','Hospitality','Sanctuary Keepers','Prayer','Technical','Evangelism'],
  updated_at      timestamptz not null default now()
);
insert into public.settings (id) values (1) on conflict (id) do nothing;

-- ---------- Excel uploads ----------
create table if not exists public.uploads (
  id          uuid primary key default gen_random_uuid(),
  file_name   text,
  service_date date,
  row_count   int not null default 0,
  created_by  uuid references public.profiles (id) on delete set null,
  is_demo     boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ---------- guests (one row per person, fields mirror the Guest Information Card) ----------
create table if not exists public.guests (
  id                    uuid primary key default gen_random_uuid(),
  first_visit           date not null,
  last_visit            date,
  visit_count           int  not null default 1,
  surname               text not null,
  other_names           text,
  gender                text,
  age_range             text,
  marital_status        text,
  phone                 text,
  email                 text,
  town                  text,
  lga                   text,
  area                  text,
  bus_stop              text,
  house_no              text,
  street                text,
  sector                text,
  occupation            text,
  interests             text[] not null default '{}',
  would_join            text,
  prayer_request        text,
  needs                 text,
  heard_via             text[] not null default '{}',
  -- journey
  assigned_to           uuid references public.profiles (id) on delete set null,
  followed_up_at        timestamptz,
  gt_started_at         date,
  gt_completed_at       date,
  department            text,
  department_joined_at  date,
  community_joined_at   date,
  pathway               text check (pathway in ('visitor', 'not_ready')),  -- stopped after the welcome call by choice
  pathway_at            timestamptz,
  notes                 text,
  upload_id             uuid references public.uploads (id) on delete set null,
  is_demo               boolean not null default false,
  created_by            uuid references public.profiles (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
-- for databases created before the pathway option existed
alter table public.guests add column if not exists pathway text check (pathway in ('visitor', 'not_ready'));
alter table public.guests add column if not exists pathway_at timestamptz;

create index if not exists guests_first_visit_idx on public.guests (first_visit desc);
create index if not exists guests_phone_idx on public.guests (phone);
create index if not exists guests_assigned_idx on public.guests (assigned_to);

-- ---------- follow-up log (calls, WhatsApp, visits) ----------
create table if not exists public.followups (
  id              uuid primary key default gen_random_uuid(),
  guest_id        uuid not null references public.guests (id) on delete cascade,
  by_user         uuid references public.profiles (id) on delete set null,
  channel         text not null default 'Call',
  outcome         text not null,
  notes           text,
  next_step_date  date,
  is_demo         boolean not null default false,
  created_at      timestamptz not null default now()
);
create index if not exists followups_guest_idx on public.followups (guest_id, created_at desc);

-- ---------- helpers ----------
create or replace function public.my_role() returns public.app_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and active
$$;

create or replace function public.has_role(roles public.app_role[]) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() = any (roles), false)
$$;

-- keep updated_at fresh
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists guests_touch on public.guests;
create trigger guests_touch before update on public.guests for each row execute function public.touch_updated_at();

-- a "Reached" follow-up marks the guest as followed up
create or replace function public.mark_followed_up() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.outcome = 'Reached' then
    update public.guests set followed_up_at = coalesce(followed_up_at, new.created_at) where id = new.guest_id;
  end if;
  return new;
end $$;
drop trigger if exists followups_mark on public.followups;
create trigger followups_mark after insert on public.followups for each row execute function public.mark_followed_up();

-- every new login gets a profile; the very first one becomes admin, everyone else waits for approval
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id, new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    case when exists (select 1 from public.profiles) then 'pending'::public.app_role else 'admin'::public.app_role end
  )
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- admins can wipe the sample data before going live
create or replace function public.clear_demo_data() returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(array['admin']::public.app_role[]) then
    raise exception 'Only admins can clear demo data';
  end if;
  delete from public.followups where is_demo;
  delete from public.guests where is_demo;
  delete from public.uploads where is_demo;
end $$;

-- ---------- row level security ----------
alter table public.profiles  enable row level security;
alter table public.settings  enable row level security;
alter table public.uploads   enable row level security;
alter table public.guests    enable row level security;
alter table public.followups enable row level security;

-- profiles
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_role(array['viewer','followup','acquisition','admin']::public.app_role[]));
drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles for update to authenticated
  using (public.has_role(array['admin']::public.app_role[]));
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid() and role = public.my_role());

-- settings
drop policy if exists settings_read on public.settings;
create policy settings_read on public.settings for select to authenticated
  using (public.has_role(array['viewer','followup','acquisition','admin']::public.app_role[]));
drop policy if exists settings_admin on public.settings;
create policy settings_admin on public.settings for update to authenticated
  using (public.has_role(array['admin']::public.app_role[]));

-- uploads
drop policy if exists uploads_read on public.uploads;
create policy uploads_read on public.uploads for select to authenticated
  using (public.has_role(array['viewer','followup','acquisition','admin']::public.app_role[]));
drop policy if exists uploads_write on public.uploads;
create policy uploads_write on public.uploads for insert to authenticated
  with check (public.has_role(array['acquisition','admin']::public.app_role[]));

-- guests
drop policy if exists guests_read on public.guests;
create policy guests_read on public.guests for select to authenticated
  using (public.has_role(array['viewer','followup','acquisition','admin']::public.app_role[]));
drop policy if exists guests_insert on public.guests;
create policy guests_insert on public.guests for insert to authenticated
  with check (public.has_role(array['acquisition','admin']::public.app_role[]));
drop policy if exists guests_update on public.guests;
create policy guests_update on public.guests for update to authenticated
  using (public.has_role(array['followup','acquisition','admin']::public.app_role[]));
drop policy if exists guests_delete on public.guests;
create policy guests_delete on public.guests for delete to authenticated
  using (public.has_role(array['admin']::public.app_role[]));

-- follow-ups
drop policy if exists followups_read on public.followups;
create policy followups_read on public.followups for select to authenticated
  using (public.has_role(array['viewer','followup','acquisition','admin']::public.app_role[]));
drop policy if exists followups_insert on public.followups;
create policy followups_insert on public.followups for insert to authenticated
  with check (public.has_role(array['followup','acquisition','admin']::public.app_role[]) and by_user = auth.uid());
drop policy if exists followups_delete on public.followups;
create policy followups_delete on public.followups for delete to authenticated
  using (by_user = auth.uid() or public.has_role(array['admin']::public.app_role[]));

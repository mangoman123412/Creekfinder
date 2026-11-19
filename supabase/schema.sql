-- CreekFinder backend schema (Supabase / PostgreSQL + PostGIS-free, uses plain lat/lng + indexes)
-- Run this whole file once in Supabase Dashboard -> SQL Editor.
-- Safe to re-run: uses IF NOT EXISTS / OR REPLACE where possible.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Explorer',
  avatar_path text,
  is_premium boolean not null default false,   -- written ONLY by server (RevenueCat webhook / service role)
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(split_part(new.email, '@', 1), ''), 'Explorer'))
  on conflict do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- folders
create table if not exists public.folders (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  name text not null,
  icon text not null default 'folder',
  sort int not null default 0,
  system_key text,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, id)
);

-- ---------------------------------------------------------------- places
create table if not exists public.places (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  kind text not null default 'creek' check (kind in ('creek','river','stream','waterfall','swimming_hole','pond_lake','spring','other')),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  accuracy_m real,
  altitude_m real,
  description text,
  water_notes text,
  depth_notes text,
  surroundings text,
  notes text,
  folder_id text,
  visibility text not null default 'private' check (visibility in ('private','public')),
  verified boolean not null default false,       -- only moderators (service role) may set this
  hidden boolean not null default false,         -- moderators can hide reported content
  source_place_id uuid references public.places(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists places_user_idx on public.places(user_id, updated_at);
create index if not exists places_public_geo_idx on public.places(lat, lng)
  where visibility = 'public' and deleted_at is null and hidden = false;

-- ---------------------------------------------------------------- photos
create table if not exists public.photos (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  place_id uuid references public.places(id) on delete cascade,
  adventure_id uuid,
  storage_path text not null,                      -- '<user_id>/<photo_id>.jpg' in bucket 'photos'
  caption text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists photos_place_idx on public.photos(place_id);

-- ---------------------------------------------------------------- adventures (GPS tracks)
create table if not exists public.adventures (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  notes text,
  started_at timestamptz not null,
  ended_at timestamptz,
  distance_m double precision not null default 0,
  duration_s int not null default 0,
  elevation_gain_m real not null default 0,
  track jsonb not null default '[]'::jsonb,        -- [[lat,lng,alt,epoch_ms], ...]
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists adventures_user_idx on public.adventures(user_id, updated_at);

-- ---------------------------------------------------------------- community
create table if not exists public.ratings (
  place_id uuid not null references public.places(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  stars smallint not null check (stars between 1 and 5),
  updated_at timestamptz not null default now(),
  primary key (place_id, user_id)
);
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists comments_place_idx on public.comments(place_id, created_at);
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  place_id uuid references public.places(id) on delete cascade,
  comment_id uuid references public.comments(id) on delete cascade,
  reason text not null check (reason in ('incorrect','dangerous','private_property','inappropriate','spam','other')),
  details text,
  status text not null default 'open',
  created_at timestamptz not null default now()
);
create table if not exists public.user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

-- ---------------------------------------------------------------- triggers
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

do $$ declare t text; begin
  foreach t in array array['folders','places','photos','adventures','ratings'] loop
    execute format('drop trigger if exists touch_%1$s on public.%1$s', t);
    execute format('create trigger touch_%1$s before insert or update on public.%1$s for each row execute function public.touch_updated_at()', t);
  end loop; end $$;

-- Users may never set moderator-only / billing-only fields.
create or replace function public.protect_place_fields() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    if tg_op = 'INSERT' then
      new.verified := false; new.hidden := false;
    else
      new.verified := old.verified; new.hidden := old.hidden;
      new.user_id := old.user_id;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists protect_place_fields on public.places;
create trigger protect_place_fields before insert or update on public.places
  for each row execute function public.protect_place_fields();

-- Free tier: 25 active saved places (server-side enforcement; premium flag is set by the server only).
create or replace function public.enforce_place_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int; prem boolean;
begin
  if new.deleted_at is not null then return new; end if;
  select is_premium into prem from public.profiles where id = new.user_id;
  if coalesce(prem, false) then return new; end if;
  select count(*) into n from public.places
    where user_id = new.user_id and deleted_at is null and id <> new.id;
  if n >= 25 then
    raise exception 'FREE_LIMIT_REACHED' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists enforce_place_limit on public.places;
create trigger enforce_place_limit before insert or update on public.places
  for each row execute function public.enforce_place_limit();

create or replace function public.protect_profile_fields() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then new.is_premium := old.is_premium; end if;
  return new;
end $$;
drop trigger if exists protect_profile_fields on public.profiles;
create trigger protect_profile_fields before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- ---------------------------------------------------------------- row level security
alter table public.profiles   enable row level security;
alter table public.folders    enable row level security;
alter table public.places     enable row level security;
alter table public.photos     enable row level security;
alter table public.adventures enable row level security;
alter table public.ratings    enable row level security;
alter table public.comments   enable row level security;
alter table public.reports    enable row level security;
alter table public.user_blocks enable row level security;

-- profiles: anyone signed-in can read display names; you edit only yours.
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using (true);
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- folders / adventures: strictly private to the owner.
drop policy if exists folders_owner on public.folders;
create policy folders_owner on public.folders for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists adventures_owner on public.adventures;
create policy adventures_owner on public.adventures for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- places: owner sees all of theirs; everyone signed-in sees PUBLIC, non-hidden, non-deleted ones (minus blocked users).
-- PRIVATE places are never visible to anyone else.
drop policy if exists places_owner on public.places;
create policy places_owner on public.places for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists places_public_read on public.places;
create policy places_public_read on public.places for select to authenticated using (
  visibility = 'public' and deleted_at is null and hidden = false
  and not exists (select 1 from public.user_blocks b where b.blocker_id = auth.uid() and b.blocked_id = places.user_id)
);

-- photos: owner full access; public photos readable if their place is public.
drop policy if exists photos_owner on public.photos;
create policy photos_owner on public.photos for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists photos_public_read on public.photos;
create policy photos_public_read on public.photos for select to authenticated using (
  deleted_at is null and exists (select 1 from public.places p where p.id = photos.place_id
    and p.visibility = 'public' and p.deleted_at is null and p.hidden = false)
);

-- ratings / comments: only on public places (or your own).
drop policy if exists ratings_read on public.ratings;
create policy ratings_read on public.ratings for select to authenticated using (true);
drop policy if exists ratings_write on public.ratings;
create policy ratings_write on public.ratings for all to authenticated using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (select 1 from public.places p where p.id = place_id and p.visibility = 'public' and p.deleted_at is null));
drop policy if exists comments_read on public.comments;
create policy comments_read on public.comments for select to authenticated using (
  hidden = false and not exists (select 1 from public.user_blocks b where b.blocker_id = auth.uid() and b.blocked_id = comments.user_id));
drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.places p where p.id = place_id and p.visibility = 'public' and p.deleted_at is null));
drop policy if exists comments_delete on public.comments;
create policy comments_delete on public.comments for delete to authenticated using (user_id = auth.uid());

-- reports / blocks
drop policy if exists reports_insert on public.reports;
create policy reports_insert on public.reports for insert to authenticated with check (reporter_id = auth.uid());
drop policy if exists reports_read_own on public.reports;
create policy reports_read_own on public.reports for select to authenticated using (reporter_id = auth.uid());
drop policy if exists blocks_owner on public.user_blocks;
create policy blocks_owner on public.user_blocks for all to authenticated using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());

-- ---------------------------------------------------------------- RPCs
-- Public places inside a map bounding box, with rating summary. Never returns private places.
create or replace function public.public_places_in_bounds(
  west double precision, south double precision, east double precision, north double precision,
  max_rows int default 300)
returns table (id uuid, name text, kind text, lat double precision, lng double precision, description text,
               verified boolean, user_id uuid, author text, avg_rating numeric, rating_count bigint, created_at timestamptz)
language sql stable security invoker set search_path = public as $$
  select p.id, p.name, p.kind, p.lat, p.lng, p.description, p.verified, p.user_id, pr.display_name,
         (select round(avg(stars)::numeric, 1) from ratings r where r.place_id = p.id),
         (select count(*) from ratings r where r.place_id = p.id),
         p.created_at
  from places p join profiles pr on pr.id = p.user_id
  where p.visibility = 'public' and p.deleted_at is null and p.hidden = false
    and p.lat between south and north
    and (case when west <= east then p.lng between west and east else (p.lng >= west or p.lng <= east) end)
  order by p.verified desc, p.created_at desc
  limit least(max_rows, 500)
$$;

-- Account deletion (Apple 5.1.1(v) / Google Play requirement). Client removes storage files first, then calls this.
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  delete from auth.users where id = auth.uid();   -- cascades to every table above
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ---------------------------------------------------------------- storage
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 6291456, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 6291456;

-- Files live at '<user_id>/<name>'. Owner has full access.
drop policy if exists photos_obj_owner on storage.objects;
create policy photos_obj_owner on storage.objects for all to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
-- Others can read a file only if it belongs to a photo of a PUBLIC place.
drop policy if exists photos_obj_public_read on storage.objects;
create policy photos_obj_public_read on storage.objects for select to authenticated using (
  bucket_id = 'photos' and exists (
    select 1 from public.photos ph join public.places p on p.id = ph.place_id
    where ph.storage_path = storage.objects.name and ph.deleted_at is null
      and p.visibility = 'public' and p.deleted_at is null and p.hidden = false));

-- WhoIsFree — core schema (lives next to THE UNKNOWN in the same Supabase project; every object is prefixed wif_).
-- Privacy model: clients never read other people's rows directly. Cross-user data only comes from
-- SECURITY DEFINER functions that return approximate distance bands, never coordinates.

create extension if not exists postgis with schema extensions;

-- ===================================================================== helpers
create or replace function public.wif_snap(p_lat double precision, p_lng double precision)
returns extensions.geography language sql immutable set search_path = public, extensions as $$
  -- ~2 km grid: the exact position is never stored
  select extensions.st_setsrid(extensions.st_makepoint(
    round((p_lng / (0.018 / greatest(cos(radians(p_lat)), 0.2)))::numeric) * (0.018 / greatest(cos(radians(p_lat)), 0.2)),
    round((p_lat / 0.018)::numeric) * 0.018), 4326)::extensions.geography;
$$;

create or replace function public.wif_band(d double precision) returns text language sql immutable as $$
  select case when d is null then null when d < 3000 then 'under_3' when d < 5000 then '3_5' when d < 10000 then '5_10'
    when d < 25000 then '10_25' when d < 50000 then '25_50' when d < 100000 then '50_100' else '100_plus' end;
$$;

create or replace function public.wif_age(b date) returns int language sql stable as $$
  select extract(year from age(current_date, b))::int;
$$;

-- ===================================================================== profiles
create table if not exists public.wif_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(trim(display_name)) between 1 and 30),
  birth_date date,
  gender text check (gender in ('woman','man','nonbinary','other')),
  bio text check (char_length(bio) <= 300),
  interests text[] not null default '{}',
  languages text[] not null default '{}',
  country_code text check (char_length(country_code) = 2),
  city text check (char_length(city) <= 80),
  photo_path text,
  gallery text[] not null default '{}' check (cardinality(gallery) <= 5),
  show_age boolean not null default true,
  discoverable boolean not null default true,
  is_verified boolean not null default false,
  is_admin boolean not null default false,
  status text not null default 'active' check (status in ('active','suspended','banned')),
  tier text not null default 'free' check (tier in ('free','plus','elite')),
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  last_active_at timestamptz not null default now()
);
alter table public.wif_profiles enable row level security;
create policy wif_profiles_own_read on public.wif_profiles for select to authenticated using (id = auth.uid());
create policy wif_profiles_own_update on public.wif_profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.wif_profiles from authenticated, anon;
grant update (display_name, birth_date, gender, bio, interests, languages, country_code, city, photo_path, gallery, show_age, discoverable, onboarded)
  on public.wif_profiles to authenticated;

-- adults only + photos must live in the member's own folder
create or replace function public.wif_profiles_guard() returns trigger language plpgsql set search_path = public as $$
begin
  if new.birth_date is not null and new.birth_date > (current_date - interval '18 years')::date then raise exception 'under_18'; end if;
  if new.birth_date is not null and new.birth_date < date '1900-01-01' then raise exception 'invalid_birth_date'; end if;
  if new.photo_path is not null and split_part(new.photo_path, '/', 1) <> new.id::text then raise exception 'invalid_photo'; end if;
  if exists (select 1 from unnest(new.gallery) g where split_part(g, '/', 1) <> new.id::text) then raise exception 'invalid_photo'; end if;
  if new.onboarded and (new.display_name is null or new.birth_date is null) then raise exception 'profile_incomplete'; end if;
  return new;
end $$;
drop trigger if exists wif_profiles_guard on public.wif_profiles;
create trigger wif_profiles_guard before insert or update on public.wif_profiles for each row execute function public.wif_profiles_guard();

-- ===================================================================== categories (admin-editable)
create table if not exists public.wif_categories (
  id text primary key,
  emoji text not null,
  name_en text not null, name_fr text not null, name_ar text not null,
  color text not null default '#FFD600',
  sort int not null default 0,
  active boolean not null default true
);
alter table public.wif_categories enable row level security;
create policy wif_categories_read on public.wif_categories for select to authenticated, anon using (active);
insert into public.wif_categories (id, emoji, name_en, name_fr, name_ar, color, sort) values
  ('coffee','☕','Coffee','Café','قهوة','#C08552',1),
  ('food','🍽️','Restaurants','Restaurants','مطاعم','#F97316',2),
  ('football','⚽','Football','Football','كرة القدم','#22C55E',3),
  ('basketball','🏀','Basketball','Basket','كرة السلة','#F97316',4),
  ('tennis','🎾','Tennis','Tennis','تنس','#84CC16',5),
  ('padel','🏓','Padel','Padel','بادل','#06B6D4',6),
  ('gym','🏋️','Gym','Salle de sport','نادي رياضي','#EF4444',7),
  ('walking','🚶','Walking','Balade','مشي','#10B981',8),
  ('running','🏃','Running','Course','جري','#F43F5E',9),
  ('cinema','🎬','Cinema','Cinéma','سينما','#8B5CF6',10),
  ('gaming','🎮','Gaming','Jeux vidéo','ألعاب','#6366F1',11),
  ('shopping','🛍️','Shopping','Shopping','تسوق','#EC4899',12),
  ('photography','📷','Photography','Photographie','تصوير','#0EA5E9',13),
  ('beach','🏖️','Beach','Plage','شاطئ','#38BDF8',14),
  ('travel','✈️','Travel','Voyage','سفر','#4263EB',15),
  ('roadtrip','🚗','Road trips','Road trip','رحلة بالسيارة','#F59E0B',16),
  ('hiking','🥾','Hiking','Randonnée','مشي جبلي','#65A30D',17),
  ('networking','💼','Business networking','Networking','تواصل مهني','#334155',18),
  ('language','🗣️','Language exchange','Échange linguistique','تبادل لغوي','#14B8A6',19),
  ('cooking','🍳','Cooking','Cuisine','طبخ','#EA580C',20),
  ('music','🎵','Music','Musique','موسيقى','#A855F7',21),
  ('creative','🎨','Creative','Créatif','إبداع','#DB2777',22),
  ('study','📚','Study together','Étudier ensemble','دراسة','#2563EB',23),
  ('talk','💬','Just talk','Juste discuter','دردشة','#64748B',24),
  ('surprise','✨','Surprise me','Surprends-moi','فاجئني','#FFD600',25)
on conflict (id) do nothing;

-- ===================================================================== approximate location
create table if not exists public.wif_zones (
  user_id uuid primary key references public.wif_profiles(id) on delete cascade,
  enabled boolean not null default true,
  cell extensions.geography(point, 4326),
  city text, country_code text,
  updated_at timestamptz not null default now(),
  updates_today int not null default 0,
  updates_day date not null default current_date
);
create index if not exists wif_zones_cell_idx on public.wif_zones using gist (cell);
alter table public.wif_zones enable row level security;  -- no client policies

-- ===================================================================== availability ("I'm free now")
create table if not exists public.wif_availability (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.wif_profiles(id) on delete cascade,
  categories text[] not null default '{}',
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  max_km int not null default 10 check (max_km between 1 and 100),
  group_pref text not null default 'any' check (group_pref in ('one','group','any')),
  budget text not null default 'any' check (budget in ('free','low','medium','any')),
  note text check (char_length(note) <= 140),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at and ends_at <= starts_at + interval '24 hours')
);
create index if not exists wif_availability_active_idx on public.wif_availability (user_id, ends_at desc);
alter table public.wif_availability enable row level security;
create policy wif_availability_own on public.wif_availability for select to authenticated using (user_id = auth.uid());

-- ===================================================================== social graph & safety
create table if not exists public.wif_blocks (
  blocker uuid not null references public.wif_profiles(id) on delete cascade,
  blocked uuid not null references public.wif_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked)
);
alter table public.wif_blocks enable row level security;
create policy wif_blocks_own on public.wif_blocks for select to authenticated using (blocker = auth.uid());

create or replace function public.wif_blocked(a uuid, b uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from wif_blocks where (blocker = a and blocked = b) or (blocker = b and blocked = a));
$$;

create table if not exists public.wif_reports (
  id uuid primary key default gen_random_uuid(),
  reporter uuid references public.wif_profiles(id) on delete set null,
  target_user uuid references public.wif_profiles(id) on delete cascade,
  target_activity uuid,
  target_post uuid,
  reason text not null check (reason in ('spam','harassment','fake','inappropriate','underage','safety','other')),
  details text check (char_length(details) <= 500),
  status text not null default 'open' check (status in ('open','dismissed','actioned')),
  created_at timestamptz not null default now()
);
alter table public.wif_reports enable row level security;

create table if not exists public.wif_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.wif_profiles(id) on delete cascade,
  type text not null,
  data jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists wif_notifications_user_idx on public.wif_notifications (user_id, created_at desc);
alter table public.wif_notifications enable row level security;
create policy wif_notifications_own on public.wif_notifications for select to authenticated using (user_id = auth.uid());
create policy wif_notifications_read on public.wif_notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke update on public.wif_notifications from authenticated; grant update (read_at) on public.wif_notifications to authenticated;

create table if not exists public.wif_audit (
  id bigserial primary key, actor uuid, action text not null, target uuid, data jsonb, created_at timestamptz not null default now()
);
alter table public.wif_audit enable row level security;

-- ===================================================================== conversations
create table if not exists public.wif_conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('direct','group')),
  activity_id uuid,
  title text,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);
create table if not exists public.wif_members (
  conversation_id uuid not null references public.wif_conversations(id) on delete cascade,
  user_id uuid not null references public.wif_profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index if not exists wif_members_user_idx on public.wif_members (user_id);
create table if not exists public.wif_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.wif_conversations(id) on delete cascade,
  sender_id uuid references public.wif_profiles(id) on delete set null,
  kind text not null default 'text' check (kind in ('text','image','system','invite')),
  body text check (char_length(body) <= 2000),
  media_path text,
  created_at timestamptz not null default now()
);
create index if not exists wif_messages_conv_idx on public.wif_messages (conversation_id, created_at desc);

create or replace function public.wif_is_member(c uuid, u uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from wif_members where conversation_id = c and user_id = u);
$$;

alter table public.wif_conversations enable row level security;
alter table public.wif_members enable row level security;
alter table public.wif_messages enable row level security;
create policy wif_conversations_member on public.wif_conversations for select to authenticated using (wif_is_member(id, auth.uid()));
create policy wif_members_member on public.wif_members for select to authenticated using (wif_is_member(conversation_id, auth.uid()));
create policy wif_members_read_mark on public.wif_members for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke update on public.wif_members from authenticated; grant update (last_read_at) on public.wif_members to authenticated;
create policy wif_messages_member_read on public.wif_messages for select to authenticated using (wif_is_member(conversation_id, auth.uid()));
create policy wif_messages_member_send on public.wif_messages for insert to authenticated
  with check (sender_id = auth.uid() and kind in ('text','image') and wif_is_member(conversation_id, auth.uid()));

create or replace function public.wif_messages_before() returns trigger language plpgsql security definer set search_path = public as $$
declare n int; other uuid; c wif_conversations;
begin
  if new.kind in ('text','image') then
    if (new.body is null or btrim(new.body) = '') and new.media_path is null then raise exception 'empty_message'; end if;
    select count(*) into n from wif_messages where sender_id = new.sender_id and created_at > now() - interval '1 minute';
    if n >= 30 then raise exception 'rate_limited'; end if;
    select * into c from wif_conversations where id = new.conversation_id;
    if c.kind = 'direct' then
      select user_id into other from wif_members where conversation_id = new.conversation_id and user_id <> new.sender_id limit 1;
      if other is not null and wif_blocked(new.sender_id, other) then raise exception 'blocked'; end if;
    end if;
    if new.media_path is not null and split_part(new.media_path, '/', 1) <> new.conversation_id::text then raise exception 'invalid_media'; end if;
  end if;
  return new;
end $$;
drop trigger if exists wif_messages_before on public.wif_messages;
create trigger wif_messages_before before insert on public.wif_messages for each row execute function public.wif_messages_before();

create or replace function public.wif_messages_after() returns trigger language plpgsql security definer set search_path = public as $$
begin
  update wif_conversations set last_message_at = new.created_at where id = new.conversation_id;
  if new.sender_id is not null then
    update wif_members set last_read_at = new.created_at where conversation_id = new.conversation_id and user_id = new.sender_id;
  end if;
  return null;
end $$;
drop trigger if exists wif_messages_after on public.wif_messages;
create trigger wif_messages_after after insert on public.wif_messages for each row execute function public.wif_messages_after();

do $$ begin
  begin alter publication supabase_realtime add table public.wif_messages; exception when others then null; end;
  begin alter publication supabase_realtime add table public.wif_notifications; exception when others then null; end;
end $$;

-- ===================================================================== connection requests
create table if not exists public.wif_requests (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null references public.wif_profiles(id) on delete cascade,
  to_id uuid not null references public.wif_profiles(id) on delete cascade,
  message text check (char_length(message) <= 200),
  category text,
  status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled')),
  conversation_id uuid references public.wif_conversations(id) on delete set null,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (from_id <> to_id)
);
create unique index if not exists wif_requests_pending_uq on public.wif_requests (from_id, to_id) where status = 'pending';
alter table public.wif_requests enable row level security;
create policy wif_requests_parties on public.wif_requests for select to authenticated using (from_id = auth.uid() or to_id = auth.uid());

-- ===================================================================== activities & groups
create table if not exists public.wif_activities (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.wif_profiles(id) on delete cascade,
  category_id text not null references public.wif_categories(id),
  title text not null check (char_length(trim(title)) between 3 and 80),
  description text check (char_length(description) <= 1000),
  cover_path text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  place_name text not null check (char_length(trim(place_name)) between 2 and 120),
  city text,
  cell extensions.geography(point, 4326),
  max_participants int not null default 4 check (max_participants between 2 and 50),
  price_text text check (char_length(price_text) <= 40),
  status text not null default 'open' check (status in ('open','cancelled')),
  conversation_id uuid references public.wif_conversations(id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);
create index if not exists wif_activities_cell_idx on public.wif_activities using gist (cell);
create index if not exists wif_activities_starts_idx on public.wif_activities (starts_at);
alter table public.wif_activities enable row level security;  -- read through functions

create table if not exists public.wif_participants (
  activity_id uuid not null references public.wif_activities(id) on delete cascade,
  user_id uuid not null references public.wif_profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','declined','left')),
  message text check (char_length(message) <= 200),
  created_at timestamptz not null default now(),
  primary key (activity_id, user_id)
);
alter table public.wif_participants enable row level security;
create policy wif_participants_own on public.wif_participants for select to authenticated using (user_id = auth.uid());

-- ===================================================================== moments (feed)
create table if not exists public.wif_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.wif_profiles(id) on delete cascade,
  body text check (char_length(body) <= 1000),
  media_path text,
  activity_id uuid references public.wif_activities(id) on delete set null,
  status text not null default 'visible' check (status in ('visible','removed')),
  created_at timestamptz not null default now(),
  check (body is not null or media_path is not null)
);
create index if not exists wif_posts_created_idx on public.wif_posts (created_at desc);
alter table public.wif_posts enable row level security;
create table if not exists public.wif_post_likes (
  post_id uuid not null references public.wif_posts(id) on delete cascade,
  user_id uuid not null references public.wif_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.wif_post_likes enable row level security;

-- ===================================================================== storage
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('wif-photos', 'wif-photos', true, 5242880, array['image/jpeg','image/png','image/webp']),
  ('wif-chat', 'wif-chat', false, 8388608, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
create policy "wif photos own write" on storage.objects for insert to authenticated
  with check (bucket_id = 'wif-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "wif photos own delete" on storage.objects for delete to authenticated
  using (bucket_id = 'wif-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "wif chat member write" on storage.objects for insert to authenticated
  with check (bucket_id = 'wif-chat' and public.wif_is_member(((storage.foldername(name))[1])::uuid, auth.uid()));
create policy "wif chat member read" on storage.objects for select to authenticated
  using (bucket_id = 'wif-chat' and public.wif_is_member(((storage.foldername(name))[1])::uuid, auth.uid()));

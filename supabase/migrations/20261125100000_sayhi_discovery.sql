-- THE UNKNOWN — Nearby social discovery (phase 1)
-- * real profile fields (display name, bio, looking for, gender preference, verification flag)
-- * one discovery function for Nearby / Worldwide with basic + advanced (VIP) filters
-- * swipes with server-confirmed mutual matches, favorites, profile visitors (VIP)
-- Location rules are unchanged: positions are snapped to a ~2 km grid, never returned,
-- only distance bands leave the server, and stale positions (> 14 days) expire.

-- ---------- profile fields -------------------------------------------
alter table public.profiles add column if not exists display_name text check (char_length(trim(display_name)) between 1 and 30);
alter table public.profiles add column if not exists bio text check (char_length(bio) <= 500);
alter table public.profiles add column if not exists looking_for text check (looking_for in ('friendship','conversation','relationship'));
alter table public.profiles add column if not exists interested_in text[] not null default '{}'
  check (interested_in <@ array['woman','man','nonbinary','other']::text[]);
alter table public.profiles add column if not exists is_verified boolean not null default false;   -- set by moderators only
alter table public.profiles add column if not exists hide_visits boolean not null default false;
grant update (display_name, bio, looking_for, interested_in, hide_visits) on public.profiles to authenticated;

create or replace function public.distance_band(d double precision) returns text language sql immutable as $$
  select case when d is null then null when d < 5000 then 'Under 5 km' when d < 10000 then '5–10 km' when d < 25000 then '10–25 km'
              when d < 50000 then '25–50 km' when d < 100000 then '50–100 km' else '100+ km' end;
$$;

-- ---------- swipes / favorites / visits --------------------------------
create table if not exists public.swipes (
  swiper uuid not null references public.profiles(id) on delete cascade,
  target uuid not null references public.profiles(id) on delete cascade,
  action text not null check (action in ('like','skip','super')),
  created_at timestamptz not null default now(),
  primary key (swiper, target)
);
create index if not exists swipes_target_idx on public.swipes (target, action);
alter table public.swipes enable row level security;          -- RPC only

create table if not exists public.favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  target_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, target_id)
);
create index if not exists favorites_target_idx on public.favorites (target_id);
alter table public.favorites enable row level security;       -- RPC only

create table if not exists public.profile_visits (
  visitor uuid not null references public.profiles(id) on delete cascade,
  visited uuid not null references public.profiles(id) on delete cascade,
  visit_day date not null default current_date,
  visited_at timestamptz not null default now(),
  primary key (visitor, visited, visit_day)
);
create index if not exists profile_visits_visited_idx on public.profile_visits (visited, visited_at desc);
alter table public.profile_visits enable row level security;  -- RPC only

-- ---------- one public "person" shape ---------------------------------
-- Everything another member may see. No ids, no coordinates, no birth date.
create or replace function public.person_json(o public.profiles, me public.profiles, d double precision)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'unknown_number', o.unknown_number,
    'display_name', o.display_name,
    'avatar_seed', o.avatar_seed,
    'age', case when o.show_age then age_of(o.birth_date) end,
    'gender', o.gender,
    'bio', coalesce(o.bio, o.tagline),
    'looking_for', o.looking_for,
    'languages', o.languages,
    'interests', o.interests,
    'shared_interests', (select coalesce(jsonb_agg(x), '[]') from unnest(o.interests) x where x = any(me.interests)),
    'country_code', case when o.show_country then o.country_code end,
    'city', (select n.city from nearby_locations n where n.user_id = o.id and n.enabled),
    'distance_band', distance_band(d),
    'online', o.show_online and o.last_active_at > now() - interval '3 minutes',
    'recently_active', o.show_online and o.last_active_at > now() - interval '24 hours',
    'is_new', o.created_at > now() - interval '14 days',
    'is_verified', o.is_verified,
    'tier', o.tier,
    'has_photo', o.photo_visibility = 'public' and exists (select 1 from profile_private pp where pp.id = o.id and pp.photo_path is not null),
    'is_favorite', exists (select 1 from favorites f where f.user_id = me.id and f.target_id = o.id),
    'i_liked', exists (select 1 from swipes s where s.swiper = me.id and s.target = o.id and s.action in ('like','super'))
  );
$$;
revoke execute on function public.person_json(public.profiles, public.profiles, double precision) from public, anon, authenticated;

-- ---------- discovery --------------------------------------------------
-- p_scope: 'nearby' (needs Nearby on, radius 5–100 km) | 'world'
-- p_sort:  'distance' | 'active' | 'new' | 'trending' | 'suggested'
-- p_filters (jsonb): min_age, max_age, genders[], online, recent, new, interests[], language, country, city
--   basic (free): min_age, max_age, genders, online · advanced (VIP+): recent, new, interests, language, country, city
create or replace function public.discover_people(p_scope text default 'nearby', p_radius_km int default 25,
  p_filters jsonb default '{}', p_sort text default 'distance', p_exclude_swiped boolean default false,
  p_offset int default 0, p_limit int default 30)
returns setof jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  me profiles; mine nearby_locations; r int; recent int; adv boolean;
  f_min int := nullif(p_filters->>'min_age', '')::int;
  f_max int := nullif(p_filters->>'max_age', '')::int;
  f_genders text[] := coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(p_filters->'genders', '[]')) x), '{}');
  f_online boolean := coalesce((p_filters->>'online')::boolean, false);
  f_recent boolean := coalesce((p_filters->>'recent')::boolean, false);
  f_new boolean := coalesce((p_filters->>'new')::boolean, false);
  f_interests text[] := coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(p_filters->'interests', '[]')) x), '{}');
  f_lang text := nullif(p_filters->>'language', '');
  f_country text := nullif(upper(p_filters->>'country'), '');
  f_city text := nullif(trim(p_filters->>'city'), '');
begin
  select * into me from profiles where id = auth.uid();
  if me.id is null then raise exception 'not_authenticated'; end if;
  adv := me.tier <> 'free';
  if not adv then f_recent := false; f_new := false; f_interests := '{}'; f_lang := null; f_country := null; f_city := null; end if;
  if cardinality(f_genders) = 0 then f_genders := me.interested_in; end if;   -- default: my stated preference

  if p_scope = 'nearby' then
    select * into mine from nearby_locations where user_id = me.id;
    if mine.user_id is null or not mine.enabled or mine.cell is null then raise exception 'nearby_disabled'; end if;
    if mine.updated_at < now() - interval '14 days' then raise exception 'nearby_expired'; end if;
    select count(*) into recent from nearby_queries where user_id = me.id and created_at > now() - interval '1 hour';
    if recent >= 60 then raise exception 'rate_limited'; end if;
    insert into nearby_queries (user_id) values (me.id);
    r := least(greatest(coalesce(p_radius_km, 25), 5), case when adv then 100 else 50 end);
  end if;

  return query
  select person_json(o, me, dd.d)
  from profiles o
  left join nearby_locations n on n.user_id = o.id and n.enabled and n.cell is not null and n.updated_at > now() - interval '14 days'
  cross join lateral (select case when mine.cell is not null and n.cell is not null then st_distance(n.cell, mine.cell) end as d) dd
  where o.id <> me.id and o.status = 'active' and o.who_can_message <> 'nobody'
    and not is_blocked(o.id, me.id)
    and o.last_active_at > now() - interval '60 days'
    and (p_scope <> 'nearby' or (n.user_id is not null and st_dwithin(n.cell, mine.cell, r * 1000)))
    and (not p_exclude_swiped or not exists (select 1 from swipes s where s.swiper = me.id and s.target = o.id))
    and (f_min is null or (o.show_age and age_of(o.birth_date) >= f_min))
    and (f_max is null or (o.show_age and age_of(o.birth_date) <= f_max))
    and (cardinality(f_genders) = 0 or o.gender = any(f_genders))
    and (not f_online or (o.show_online and o.last_active_at > now() - interval '3 minutes'))
    and (not f_recent or (o.show_online and o.last_active_at > now() - interval '24 hours'))
    and (not f_new or o.created_at > now() - interval '14 days')
    and (cardinality(f_interests) = 0 or o.interests && f_interests)
    and (f_lang is null or f_lang = any(o.languages))
    and (f_country is null or (o.show_country and o.country_code = f_country))
    and (f_city is null or n.city ilike f_city)
  order by
    (o.tier = 'vip') desc,                                    -- Super VIP priority discovery
    case when p_sort = 'distance' then dd.d end asc nulls last,
    case when p_sort = 'new' then o.created_at end desc,
    case when p_sort = 'trending' then (select count(*) from swipes s where s.target = o.id and s.action <> 'skip' and s.created_at > now() - interval '7 days') end desc,
    case when p_sort = 'suggested' then (select count(*) from unnest(o.interests) x where x = any(me.interests)) end desc,
    (o.photo_visibility = 'public') desc,
    o.last_active_at desc
  offset greatest(p_offset, 0) limit least(greatest(p_limit, 1), 50);
end $$;

-- one person's public profile (records a visit unless the visitor hides visits)
create or replace function public.get_person(p_number int) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare me profiles; o profiles; mine nearby_locations; theirs nearby_locations; d double precision;
begin
  select * into me from profiles where id = auth.uid();
  if me.id is null then raise exception 'not_authenticated'; end if;
  select * into o from profiles where unknown_number = p_number and status = 'active';
  if o.id is null or is_blocked(o.id, me.id) then raise exception 'not_found'; end if;
  select * into mine from nearby_locations where user_id = me.id and enabled and cell is not null;
  select * into theirs from nearby_locations where user_id = o.id and enabled and cell is not null and updated_at > now() - interval '14 days';
  if mine.cell is not null and theirs.cell is not null then d := st_distance(mine.cell, theirs.cell); end if;
  if o.id <> me.id and not me.hide_visits then
    insert into profile_visits (visitor, visited) values (me.id, o.id)
      on conflict (visitor, visited, visit_day) do update set visited_at = now();
  end if;
  return person_json(o, me, d) || jsonb_build_object(
    'post_count', (select count(*) from posts p where p.author_id = o.id and p.status = 'visible'),
    'member_since', o.created_at,
    'personality_tags', o.personality_tags,
    'is_me', o.id = me.id);
end $$;

-- ---------- swipes & mutual matches ------------------------------------
create or replace function public.swipe(p_number int, p_action text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me profiles; o profiles; used int; lim int; conv uuid; theirs text;
begin
  select * into me from profiles where id = auth.uid();
  if me.id is null or me.status <> 'active' then raise exception 'not_allowed'; end if;
  if p_action not in ('like','skip','super') then raise exception 'invalid_action'; end if;
  select * into o from profiles where unknown_number = p_number and status = 'active';
  if o.id is null or o.id = me.id or is_blocked(o.id, me.id) then raise exception 'not_available'; end if;
  if p_action <> 'skip' then
    lim := case me.tier when 'vip' then 1000 when 'plus' then 300 else 60 end;
    select count(*) into used from swipes where swiper = me.id and action <> 'skip' and created_at > now() - interval '24 hours';
    if used >= lim then raise exception 'like_limit_reached'; end if;
    if p_action = 'super' then
      if me.tier = 'free' then raise exception 'vip_required'; end if;
      select count(*) into used from swipes where swiper = me.id and action = 'super' and created_at > now() - interval '24 hours';
      if used >= (case when me.tier = 'vip' then 5 else 1 end) then raise exception 'super_limit_reached'; end if;
    end if;
  end if;
  insert into swipes (swiper, target, action) values (me.id, o.id, p_action)
    on conflict (swiper, target) do update set action = excluded.action, created_at = now();
  if p_action = 'skip' then return jsonb_build_object('matched', false); end if;

  select action into theirs from swipes where swiper = o.id and target = me.id;
  if theirs in ('like','super') and o.who_can_message <> 'nobody' then
    -- mutual: both people chose each other → open the chat once
    select c.conversation_id into conv from connections c where c.user_id = me.id and c.other_id = o.id and c.conversation_id is not null;
    if conv is null then
      insert into conversations (kind) values ('direct') returning id into conv;
      insert into conversation_participants (conversation_id, user_id) values (conv, me.id), (conv, o.id);
      insert into messages (conversation_id, sender_id, kind, body) values (conv, null, 'system', 'It’s a match — you both liked each other.');
      perform create_connection_pair(me.id, o.id, conv, 'match');
      insert into notifications (user_id, type, data) values (o.id, 'swipe_match', jsonb_build_object('conversation_id', conv));
    end if;
    return jsonb_build_object('matched', true, 'conversation_id', conv);
  end if;
  insert into notifications (user_id, type, data) values (o.id, case when p_action = 'super' then 'super_like' else 'like_received' end, '{}');
  return jsonb_build_object('matched', false);
end $$;

-- who liked me: VIP members see them; everyone sees the count
create or replace function public.get_my_likes() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me profiles; n int;
begin
  select * into me from profiles where id = auth.uid();
  if me.id is null then raise exception 'not_authenticated'; end if;
  select count(*) into n from swipes s join profiles o on o.id = s.swiper
    where s.target = me.id and s.action <> 'skip' and o.status = 'active' and not is_blocked(o.id, me.id)
      and not exists (select 1 from swipes x where x.swiper = me.id and x.target = o.id);
  if me.tier = 'free' then return jsonb_build_object('count', n, 'people', '[]'::jsonb, 'locked', true); end if;
  return jsonb_build_object('count', n, 'locked', false, 'people', coalesce((
    select jsonb_agg(person_json(o, me, null) || jsonb_build_object('super', s.action = 'super') order by s.created_at desc)
    from swipes s join profiles o on o.id = s.swiper
    where s.target = me.id and s.action <> 'skip' and o.status = 'active' and not is_blocked(o.id, me.id)
      and not exists (select 1 from swipes x where x.swiper = me.id and x.target = o.id)), '[]'));
end $$;

-- ---------- favorites ---------------------------------------------------
create or replace function public.toggle_favorite(p_number int) returns boolean
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); o uuid;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  select id into o from profiles where unknown_number = p_number and status = 'active';
  if o is null or o = me or is_blocked(o, me) then raise exception 'not_available'; end if;
  if exists (select 1 from favorites where user_id = me and target_id = o) then
    delete from favorites where user_id = me and target_id = o; return false;
  end if;
  if (select count(*) from favorites where user_id = me) >= 500 then raise exception 'favorites_full'; end if;
  insert into favorites (user_id, target_id) values (me, o); return true;
end $$;

create or replace function public.get_favorites() returns setof jsonb
language sql stable security definer set search_path = public as $$
  select person_json(o, me, null) from favorites f
  join profiles me on me.id = auth.uid()
  join profiles o on o.id = f.target_id
  where f.user_id = auth.uid() and o.status = 'active' and not is_blocked(o.id, me.id)
  order by f.created_at desc limit 200;
$$;

-- ---------- profile visitors (VIP; visitors who hide visits are never recorded) ----
create or replace function public.get_my_visitors() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me profiles; n int;
begin
  select * into me from profiles where id = auth.uid();
  if me.id is null then raise exception 'not_authenticated'; end if;
  select count(distinct visitor) into n from profile_visits v where v.visited = me.id and v.visited_at > now() - interval '30 days';
  if me.tier = 'free' then return jsonb_build_object('count', n, 'people', '[]'::jsonb, 'locked', true); end if;
  return jsonb_build_object('count', n, 'locked', false, 'people', coalesce((
    select jsonb_agg(person_json(o, me, null) || jsonb_build_object('visited_at', last_visit) order by last_visit desc)
    from (select visitor, max(visited_at) as last_visit from profile_visits where visited = me.id and visited_at > now() - interval '30 days' group by visitor) v
    join profiles o on o.id = v.visitor
    where o.status = 'active' and not is_blocked(o.id, me.id)), '[]'));
end $$;

-- Nearby status for the app (no coordinates)
create or replace function public.get_my_nearby() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('enabled', coalesce(n.enabled and n.cell is not null, false), 'city', n.city, 'country_code', n.country_code,
    'updated_at', n.updated_at, 'expired', coalesce(n.updated_at < now() - interval '14 days', false))
  from (select 1) x left join nearby_locations n on n.user_id = auth.uid();
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'discover_people(text,int,jsonb,text,boolean,int,int)','get_person(int)','swipe(int,text)','get_my_likes()',
    'toggle_favorite(int)','get_favorites()','get_my_visitors()','get_my_nearby()']
  loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
revoke execute on function public.distance_band(double precision) from public, anon;

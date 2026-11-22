-- THE UNKNOWN — premium redesign backend
-- * real photos with visibility (public / after mutual reveal / hidden) + gallery
-- * membership tiers FREE / PLUS / VIP (granted only by the store webhook)
-- * saved favorites (PLUS+), advanced match filters (PLUS+), VIP feed priority,
--   Super Connect (VIP), exclusive profile themes (VIP), people discovery

-- ---------- tiers ----------------------------------------------------
alter table public.profiles add column if not exists tier text not null default 'free' check (tier in ('free','plus','vip'));
update public.profiles set tier = 'plus' where is_premium and tier = 'free';
alter table public.profiles add column if not exists photo_visibility text not null default 'revealed'
  check (photo_visibility in ('public','revealed','hidden'));
alter table public.profiles add column if not exists profile_theme text not null default 'rose'
  check (profile_theme in ('rose','plum','gold','ocean','sunset'));
grant update (photo_visibility, profile_theme) on public.profiles to authenticated;

create or replace function public.profiles_theme_guard() returns trigger language plpgsql set search_path = public as $$
begin
  if new.profile_theme <> 'rose' and new.tier <> 'vip' and new.profile_theme is distinct from old.profile_theme then
    raise exception 'vip_required';
  end if;
  return new;
end $$;
drop trigger if exists profiles_theme_guard on public.profiles;
create trigger profiles_theme_guard before update of profile_theme on public.profiles for each row execute function public.profiles_theme_guard();
revoke execute on function public.profiles_theme_guard() from public, anon, authenticated;

create or replace function public.tier_match_limit(p_tier text) returns int language sql immutable set search_path = public as $$
  select case p_tier when 'vip' then 25 when 'plus' then 10 else 1 end;
$$;

alter table public.matches add column if not exists super boolean not null default false;

-- ---------- photos ---------------------------------------------------
alter table public.profile_private add column if not exists gallery text[] not null default '{}'
  check (cardinality(gallery) <= 6);

create or replace function public.can_see_photo(p_owner uuid, p_viewer uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_owner = p_viewer or exists (
    select 1 from profiles o
    where o.id = p_owner and o.status = 'active' and not is_blocked(p_owner, p_viewer) and (
      o.photo_visibility = 'public'
      or (o.photo_visibility = 'revealed' and exists (
        select 1 from conversation_participants a
        join conversation_participants b on b.conversation_id = a.conversation_id
        where a.user_id = p_owner and b.user_id = p_viewer
          and a.reveal_consent and b.reveal_consent and 'photo' = any(a.reveal_fields)))));
$$;
revoke execute on function public.can_see_photo(uuid, uuid) from public, anon;
grant execute on function public.can_see_photo(uuid, uuid) to authenticated;

drop policy if exists "avatar read allowed" on storage.objects;
create policy "avatar read allowed" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and public.can_see_photo(((storage.foldername(name))[1])::uuid, auth.uid()));

-- photo / tier / theme for a set of anonymous numbers (photos only where the owner allows it)
create or replace function public.get_people_meta(p_numbers int[])
returns table (unknown_number int, photo_path text, gallery text[], tier text, profile_theme text)
language sql stable security definer set search_path = public as $$
  select o.unknown_number,
    case when can_see_photo(o.id, auth.uid()) then pp.photo_path end,
    case when can_see_photo(o.id, auth.uid()) then pp.gallery else '{}'::text[] end,
    o.tier, o.profile_theme
  from profiles o join profile_private pp on pp.id = o.id
  where o.unknown_number = any(p_numbers[1:100]) and o.status = 'active' and not is_blocked(o.id, auth.uid());
$$;

-- people discovery: real members only; PLUS+ filters; VIP first
create or replace function public.get_people(p_country text default null, p_min_age int default null, p_max_age int default null,
  p_offset int default 0, p_limit int default 20)
returns table (unknown_number int, avatar_seed text, country_code text, age int, interests text[], tagline text,
  tier text, online boolean, has_photo boolean)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare me profiles;
begin
  select * into me from profiles where id = auth.uid();
  if me.id is null then raise exception 'not_authenticated'; end if;
  if me.tier = 'free' then p_country := null; p_min_age := null; p_max_age := null; end if;
  return query
  select o.unknown_number, o.avatar_seed, case when o.show_country then o.country_code end,
    case when o.show_age then age_of(o.birth_date) end, o.interests, o.tagline, o.tier,
    o.show_online and o.last_active_at > now() - interval '3 minutes',
    o.photo_visibility = 'public' and pp.photo_path is not null
  from profiles o join profile_private pp on pp.id = o.id
  where o.id <> me.id and o.status = 'active' and o.who_can_message <> 'nobody'
    and not is_blocked(o.id, me.id)
    and o.last_active_at > now() - interval '30 days'
    and (p_country is null or o.country_code = p_country)
    and (p_min_age is null or age_of(o.birth_date) >= p_min_age)
    and (p_max_age is null or age_of(o.birth_date) <= p_max_age)
  order by (o.tier = 'vip') desc, (o.photo_visibility = 'public' and pp.photo_path is not null) desc, o.last_active_at desc
  offset greatest(p_offset, 0) limit least(greatest(p_limit, 1), 50);
end $$;

-- ---------- plan status ----------------------------------------------
create or replace function public.get_my_plan()
returns table (tier text, matches_today int, match_limit int, supers_today int, super_limit int, renews_at timestamptz, sub_status text)
language sql stable security definer set search_path = public as $$
  select p.tier,
    (select count(*)::int from matches m where m.user_a = p.id and m.match_date = current_date),
    tier_match_limit(p.tier),
    (select count(*)::int from matches m where m.super and ((m.user_a = p.id and m.a_accepted) or (m.user_b = p.id and m.b_accepted)) and m.match_date = current_date),
    case when p.tier = 'vip' then 3 else 0 end,
    s.current_period_end, s.status
  from profiles p left join subscriptions s on s.user_id = p.id
  where p.id = auth.uid();
$$;

-- ---------- matching -------------------------------------------------
drop function if exists public.find_mystery_match(text);
create or replace function public.find_mystery_match(p_mode text default 'random', p_country text default null, p_min_age int default null, p_max_age int default null)
returns table (match_id uuid, mode text, compatibility int, shared_interests text[], i_accepted boolean, they_accepted boolean,
  conversation_id uuid, other_number int, other_country text, other_age int, other_avatar_seed text, other_tagline text,
  other_tags text[], other_languages text[], is_incoming boolean)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare me profiles; today_count int; daily_limit int; cand record; new_match matches;
begin
  select * into me from profiles where id = auth.uid();
  if me.id is null or me.status <> 'active' then raise exception 'not_allowed'; end if;
  daily_limit := tier_match_limit(me.tier);
  -- advanced filters are a PLUS / VIP feature (ignored for free members)
  if me.tier = 'free' then p_country := null; p_min_age := null; p_max_age := null; end if;
  select count(*) into today_count from matches where user_a = me.id and match_date = current_date;
  if today_count >= daily_limit then raise exception 'daily_limit_reached'; end if;

  select o.id,
    (select coalesce(array_agg(x), '{}') from unnest(o.interests) x where x = any(me.interests)) as shared,
    (select count(*) from unnest(o.interests) x where x = any(me.interests)) as shared_n,
    (select count(*) from unnest(o.languages) x where x = any(me.languages)) as lang_n,
    (select count(*) from unnest(o.conversation_prefs) x where x = any(me.conversation_prefs)) as pref_n
  into cand
  from profiles o
  where o.id <> me.id and o.status = 'active' and o.who_can_message <> 'nobody'
    and not is_blocked(o.id, me.id)
    and not exists (select 1 from matches m where (m.user_a = me.id and m.user_b = o.id) or (m.user_a = o.id and m.user_b = me.id))
    and (p_mode <> 'world' or o.country_code is distinct from me.country_code)
    and (p_mode <> 'language' or ('language' = any(o.conversation_prefs)))
    and (p_mode <> 'deep' or ('deep' = any(o.conversation_prefs)))
    and (p_mode <> 'dream' or ('dreams' = any(o.interests)))
    and (p_mode <> 'interest' or o.interests && me.interests)
    and (p_country is null or o.country_code = p_country)
    and (p_min_age is null or age_of(o.birth_date) >= p_min_age)
    and (p_max_age is null or age_of(o.birth_date) <= p_max_age)
  order by
    (select count(*) from unnest(o.interests) x where x = any(me.interests)) * 3
    + (select count(*) from unnest(o.languages) x where x = any(me.languages)) * 2
    + (select count(*) from unnest(o.conversation_prefs) x where x = any(me.conversation_prefs))
    + case when o.last_active_at > now() - interval '1 day' then 2 else 0 end
    + random() * (case when p_mode = 'random' then 6 else 1.5 end) desc
  limit 1;

  if not found then return; end if;
  insert into matches (user_a, user_b, mode, compatibility, shared_interests)
  values (me.id, cand.id, p_mode,
    least(99, 42 + cand.shared_n * 11 + cand.lang_n * 7 + cand.pref_n * 5 + (random() * 6)::int), cand.shared)
  returning * into new_match;
  insert into notifications (user_id, type, data) values (cand.id, 'match', jsonb_build_object('match_id', new_match.id));
  return query select * from match_row(new_match);
end $$;

-- connect with a specific member from People (counts toward the daily limit)
create or replace function public.connect_with(p_number int)
returns table (match_id uuid, mode text, compatibility int, shared_interests text[], i_accepted boolean, they_accepted boolean,
  conversation_id uuid, other_number int, other_country text, other_age int, other_avatar_seed text, other_tagline text,
  other_tags text[], other_languages text[], is_incoming boolean)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare me profiles; o profiles; today_count int; existing matches; new_match matches;
begin
  select * into me from profiles where id = auth.uid();
  if me.id is null or me.status <> 'active' then raise exception 'not_allowed'; end if;
  select * into o from profiles where unknown_number = p_number and status = 'active';
  if o.id is null or o.id = me.id or o.who_can_message = 'nobody' or is_blocked(o.id, me.id) then raise exception 'not_available'; end if;
  select * into existing from matches m where (m.user_a = me.id and m.user_b = o.id) or (m.user_a = o.id and m.user_b = me.id)
    order by created_at desc limit 1;
  if existing.id is not null then return query select * from match_row(existing); return; end if;
  select count(*) into today_count from matches where user_a = me.id and match_date = current_date;
  if today_count >= tier_match_limit(me.tier) then raise exception 'daily_limit_reached'; end if;
  insert into matches (user_a, user_b, mode, compatibility, shared_interests, a_accepted)
  values (me.id, o.id, 'people',
    least(99, 42 + (select count(*) from unnest(o.interests) x where x = any(me.interests))::int * 11),
    (select coalesce(array_agg(x), '{}') from unnest(o.interests) x where x = any(me.interests)), true)
  returning * into new_match;
  insert into notifications (user_id, type, data) values (o.id, 'match', jsonb_build_object('match_id', new_match.id));
  return query select * from match_row(new_match);
end $$;

-- Super Connect (VIP, 3 a day): accept with a highlight the other person sees
create or replace function public.super_connect(p_match uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare me profiles; m matches; used int;
begin
  select * into me from profiles where id = auth.uid();
  if me.tier <> 'vip' then raise exception 'vip_required'; end if;
  select * into m from matches where id = p_match;
  if m.id is null or (m.user_a <> me.id and m.user_b <> me.id) then raise exception 'not_found'; end if;
  select count(*) into used from matches x where x.super and x.match_date = current_date
    and ((x.user_a = me.id and x.a_accepted) or (x.user_b = me.id and x.b_accepted));
  if used >= 3 then raise exception 'super_limit_reached'; end if;
  update matches set super = true where id = m.id;
  insert into notifications (user_id, type, data)
    values (case when m.user_a = me.id then m.user_b else m.user_a end, 'super_connect', jsonb_build_object('match_id', m.id));
  return respond_match(p_match, true);
end $$;

create or replace function public.get_my_super_match_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from matches where super and (user_a = auth.uid() or user_b = auth.uid()) and match_date > current_date - 7;
$$;

-- ---------- feed priority (VIP) --------------------------------------
create or replace function public.get_feed(p_category text default 'for_you', p_offset int default 0, p_limit int default 20)
returns table (
  id uuid, type public.post_type, category text, content text, image_path text, voice_path text, audience public.post_audience,
  created_at timestamptz, like_count int, comment_count int, interested_count int,
  author_number int, author_country text, author_age int, author_avatar_seed text,
  is_mine boolean, liked_by_me boolean, my_interest public.interest_status
) language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare me profiles; lim int := least(greatest(p_limit, 1), 50);
begin
  select * into me from profiles where profiles.id = auth.uid();
  if me.id is null then raise exception 'not_authenticated'; end if;
  return query
  with candidates as (
    select p.*,
      -- relevance score: interests + languages + engagement + freshness + daily jitter (diversity)
      (case when p.category = any(me.interests) or p.category = any(me.discover_topics) then 3 else 0 end)
      + (case when p.language is null or p.language = any(me.languages) then 1 else 0 end)
      + ln(1 + p.like_count + 2 * p.comment_count + 3 * p.interested_count)
      - extract(epoch from (now() - p.created_at)) / 86400.0 * 0.6
      + (('x' || substr(md5(p.id::text || me.id::text || current_date::text), 1, 6))::bit(24)::int / 16777215.0)
      -- VIP members get priority placement in discovery
      + (case when exists (select 1 from profiles a where a.id = p.author_id and a.tier = 'vip') then 1.5 else 0 end) as score
    from posts p
    where p.status = 'visible'
      and p.created_at > now() - interval '60 days'
      and can_view_post(p, me.id)
      and (p_category in ('for_you','worldwide','trending')
           or (p_category = 'my_country' and p.author_country = me.country_code)
           or (p_category = p.type::text)
           or (p_category = p.category))
      and (p_category <> 'trending' or p.created_at > now() - interval '72 hours')
      and (p_category <> 'worldwide' or p.author_country is distinct from me.country_code or p.author_id = me.id)
  ), ranked as (
    select c.*, row_number() over (partition by c.author_id order by c.score desc) as author_rank from candidates c
  )
  select r.* from ranked rk
  join posts pp on pp.id = rk.id
  cross join lateral post_row(pp, me.id) r
  where rk.author_rank <= 3 or p_category not in ('for_you','trending')
  order by
    case when p_category = 'trending' then (rk.like_count + 2*rk.comment_count + 3*rk.interested_count)::float8 end desc nulls last,
    case when p_category = 'for_you' then rk.score end desc nulls last,
    rk.created_at desc
  offset greatest(p_offset, 0) limit lim;
end $$;

-- ---------- saved favorites (PLUS+) ----------------------------------
create table if not exists public.saved_posts (
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
create index if not exists saved_posts_post_idx on public.saved_posts (post_id);
alter table public.saved_posts enable row level security;
drop policy if exists saved_own_read on public.saved_posts;
create policy saved_own_read on public.saved_posts for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists saved_own_delete on public.saved_posts;
create policy saved_own_delete on public.saved_posts for delete to authenticated using (user_id = (select auth.uid()));

create or replace function public.toggle_saved_post(p_post uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare me profiles;
begin
  select * into me from profiles where id = auth.uid();
  if me.id is null then raise exception 'not_authenticated'; end if;
  if exists (select 1 from saved_posts where user_id = me.id and post_id = p_post) then
    delete from saved_posts where user_id = me.id and post_id = p_post; return false;
  end if;
  if me.tier = 'free' then raise exception 'plus_required'; end if;
  insert into saved_posts (user_id, post_id) values (me.id, p_post); return true;
end $$;

create or replace function public.get_saved_posts(p_offset int default 0, p_limit int default 20)
returns table (
  id uuid, type public.post_type, category text, content text, image_path text, voice_path text, audience public.post_audience,
  created_at timestamptz, like_count int, comment_count int, interested_count int,
  author_number int, author_country text, author_age int, author_avatar_seed text,
  is_mine boolean, liked_by_me boolean, my_interest public.interest_status
) language sql stable security definer set search_path = public as $$
  select r.* from saved_posts s
  join posts pp on pp.id = s.post_id
  cross join lateral post_row(pp, auth.uid()) r
  where s.user_id = auth.uid() and pp.status = 'visible' and can_view_post(pp, auth.uid())
  order by s.created_at desc
  offset greatest(p_offset, 0) limit least(greatest(p_limit, 1), 50);
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'get_people_meta(int[])','get_people(text,int,int,int,int)','get_my_plan()',
    'find_mystery_match(text,text,int,int)','connect_with(int)','super_connect(uuid)','get_my_super_match_ids()',
    'get_feed(text,int,int)','toggle_saved_post(uuid)','get_saved_posts(int,int)']
  loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
revoke execute on function public.tier_match_limit(text) from public, anon;

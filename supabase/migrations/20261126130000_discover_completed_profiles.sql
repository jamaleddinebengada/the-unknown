-- Discovery only lists members who completed their profile (date of birth = 18+ check).
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
  if not adv then f_recent := false; f_new := false; f_interests := '{}'; f_lang := null; f_city := null; end if;
  if cardinality(f_genders) = 0 then f_genders := me.interested_in; end if;

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
  select person_json(o, me, dd.d) || jsonb_build_object('boosted', coalesce(o.boosted_until > now(), false))
  from profiles o
  left join nearby_locations n on n.user_id = o.id and n.enabled and n.cell is not null and n.updated_at > now() - interval '14 days'
  cross join lateral (select case when mine.cell is not null and n.cell is not null then st_distance(n.cell, mine.cell) end as d) dd
  where o.id <> me.id and o.status = 'active' and o.who_can_message <> 'nobody'
    and o.birth_date is not null                                  -- only members who finished the 18+ profile
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
    coalesce(o.boosted_until > now(), false) desc,           -- active boost
    (o.tier = 'vip') desc,                                    -- Super VIP priority discovery
    case when p_sort = 'distance' then dd.d end asc nulls last,
    case when p_sort = 'new' then o.created_at end desc,
    case when p_sort = 'trending' then (select count(*) from swipes s where s.target = o.id and s.action <> 'skip' and s.created_at > now() - interval '7 days') end desc,
    case when p_sort = 'suggested' then (select count(*) from unnest(o.interests) x where x = any(me.interests)) end desc,
    (o.photo_visibility = 'public') desc,
    o.last_active_at desc
  offset greatest(p_offset, 0) limit least(greatest(p_limit, 1), 50);
end $$;

-- Documented, deterministic compatibility (0–99):
-- 42 base + 11 per shared interest + 7 per shared language + 5 per shared conversation preference
-- + 4 if both live in the same country (only when both show it), capped at 99.

create or replace function public.compat_score(a public.profiles, b public.profiles) returns int
language sql stable set search_path = public as $$
  select least(99, 42
    + 11 * (select count(*) from unnest(b.interests) x where x = any(a.interests))::int
    + 7 * (select count(*) from unnest(b.languages) x where x = any(a.languages))::int
    + 5 * (select count(*) from unnest(b.conversation_prefs) x where x = any(a.conversation_prefs))::int
    + case when a.country_code is not null and a.country_code = b.country_code and a.show_country and b.show_country then 4 else 0 end);
$$;
revoke execute on function public.compat_score(public.profiles, public.profiles) from public, anon, authenticated;

create or replace function public.find_mystery_match(p_mode text default 'random', p_country text default null, p_min_age int default null, p_max_age int default null)
returns table (match_id uuid, mode text, compatibility int, shared_interests text[], i_accepted boolean, they_accepted boolean,
  conversation_id uuid, other_number int, other_country text, other_age int, other_avatar_seed text, other_tagline text,
  other_tags text[], other_languages text[], is_incoming boolean)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare me profiles; today_count int; daily_limit int; cand profiles; new_match matches;
begin
  select * into me from profiles where id = auth.uid();
  if me.id is null or me.status <> 'active' then raise exception 'not_allowed'; end if;
  daily_limit := tier_match_limit(me.tier);
  if me.tier = 'free' then p_country := null; p_min_age := null; p_max_age := null; end if;
  select count(*) into today_count from matches where user_a = me.id and match_date = current_date;
  if today_count >= daily_limit then raise exception 'daily_limit_reached'; end if;

  select o.* into cand
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
  -- ranking: compatibility, recent activity; random only breaks ties / powers "Random" mode
  order by compat_score(me, o) * (case when p_mode = 'random' then 0.2 else 1 end)
    + case when o.last_active_at > now() - interval '1 day' then 6 else 0 end
    + random() * (case when p_mode = 'random' then 40 else 3 end) desc
  limit 1;

  if cand.id is null then return; end if;
  insert into matches (user_a, user_b, mode, compatibility, shared_interests)
  values (me.id, cand.id, p_mode, compat_score(me, cand),
    (select coalesce(array_agg(x), '{}') from unnest(cand.interests) x where x = any(me.interests)))
  returning * into new_match;
  insert into notifications (user_id, type, data) values (cand.id, 'match', jsonb_build_object('match_id', new_match.id));
  return query select * from match_row(new_match);
end $$;

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
  values (me.id, o.id, 'people', compat_score(me, o),
    (select coalesce(array_agg(x), '{}') from unnest(o.interests) x where x = any(me.interests)), true)
  returning * into new_match;
  insert into notifications (user_id, type, data) values (o.id, 'match', jsonb_build_object('match_id', new_match.id));
  return query select * from match_row(new_match);
end $$;
revoke execute on function public.find_mystery_match(text,text,int,int) from public, anon;
grant execute on function public.find_mystery_match(text,text,int,int) to authenticated;
revoke execute on function public.connect_with(int) from public, anon;
grant execute on function public.connect_with(int) to authenticated;

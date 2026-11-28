-- WhoIsFree — server API (SECURITY DEFINER functions; grants to authenticated only).

-- public card of a member as seen by `me` (never coordinates)
create or replace function public.wif_person(o public.wif_profiles, me public.wif_profiles, d double precision)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', o.id,
    'name', o.display_name,
    'age', case when o.show_age then wif_age(o.birth_date) end,
    'gender', o.gender,
    'bio', o.bio,
    'photo_path', o.photo_path,
    'gallery', o.gallery,
    'city', coalesce((select z.city from wif_zones z where z.user_id = o.id and z.enabled), o.city),
    'country_code', o.country_code,
    'distance', wif_band(d),
    'online', o.last_active_at > now() - interval '5 minutes',
    'verified', o.is_verified,
    'tier', o.tier,
    'interests', o.interests,
    'languages', o.languages,
    'shared_interests', (select coalesce(jsonb_agg(x), '[]') from unnest(o.interests) x where x = any(me.interests)),
    'shared_languages', (select coalesce(jsonb_agg(x), '[]') from unnest(o.languages) x where x = any(me.languages)),
    'free', (select jsonb_build_object('until', a.ends_at, 'starts_at', a.starts_at, 'categories', a.categories, 'group_pref', a.group_pref,
               'budget', a.budget, 'note', a.note, 'max_km', a.max_km,
               'shared_categories', (select coalesce(jsonb_agg(c), '[]') from unnest(a.categories) c where c = any(me.interests)
                                    or c = any(coalesce((select m.categories from wif_availability m where m.user_id = me.id and m.ends_at > now() order by m.created_at desc limit 1), '{}'))))
             from wif_availability a where a.user_id = o.id and a.ends_at > now() order by a.created_at desc limit 1)
  );
$$;

create or replace function public.wif_me() returns public.wif_profiles language plpgsql security definer set search_path = public as $$
declare p wif_profiles;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into p from wif_profiles where id = auth.uid();
  if p.id is null then raise exception 'no_profile'; end if;
  if p.status <> 'active' then raise exception 'account_suspended'; end if;
  return p;
end $$;
revoke execute on function public.wif_me() from public, anon, authenticated;

-- creates the profile on first sign-in; returns profile + location + current availability
create or replace function public.wif_bootstrap() returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid(); p wif_profiles; z wif_zones; a wif_availability;
begin
  if u is null then raise exception 'not_authenticated'; end if;
  insert into wif_profiles (id) values (u) on conflict (id) do nothing;
  update wif_profiles set last_active_at = now() where id = u returning * into p;
  select * into z from wif_zones where user_id = u;
  select * into a from wif_availability where user_id = u and ends_at > now() order by created_at desc limit 1;
  return jsonb_build_object('profile', to_jsonb(p),
    'zone', case when z.user_id is null then null else jsonb_build_object('enabled', z.enabled, 'city', z.city, 'country_code', z.country_code,
      'updated_at', z.updated_at, 'expired', z.updated_at < now() - interval '14 days') end,
    'availability', case when a.id is null then null else to_jsonb(a) end,
    'unread', (select count(*) from wif_notifications where user_id = u and read_at is null));
end $$;

create or replace function public.wif_touch() returns void language sql security definer set search_path = public as $$
  update wif_profiles set last_active_at = now() where id = auth.uid();
$$;

-- ----------------------------------------------------------------- location
create or replace function public.wif_set_location(p_lat double precision, p_lng double precision, p_city text, p_country text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare me wif_profiles := wif_me(); cur wif_zones;
begin
  if p_lat is null or p_lng is null or abs(p_lat) > 85 or abs(p_lng) > 180 then raise exception 'invalid_location'; end if;
  select * into cur from wif_zones where user_id = me.id;
  if cur.user_id is not null and cur.updates_day = current_date and cur.updates_today >= 12 then raise exception 'location_update_limit'; end if;
  insert into wif_zones (user_id, enabled, cell, city, country_code, updated_at, updates_today, updates_day)
  values (me.id, true, wif_snap(p_lat, p_lng), left(nullif(trim(p_city), ''), 80), upper(left(nullif(p_country, ''), 2)), now(), 1, current_date)
  on conflict (user_id) do update set enabled = true, cell = excluded.cell, city = excluded.city, country_code = excluded.country_code, updated_at = now(),
    updates_today = case when wif_zones.updates_day = current_date then wif_zones.updates_today + 1 else 1 end, updates_day = current_date;
  update wif_profiles set city = coalesce(left(nullif(trim(p_city), ''), 80), city), country_code = coalesce(upper(left(nullif(p_country, ''), 2)), country_code) where id = me.id;
end $$;

create or replace function public.wif_disable_location() returns void language plpgsql security definer set search_path = public as $$
begin
  delete from wif_zones where user_id = auth.uid();          -- erased, not just hidden
  update wif_availability set ends_at = greatest(starts_at + interval '1 second', now()) where user_id = auth.uid() and ends_at > now();
end $$;

-- ----------------------------------------------------------------- availability
create or replace function public.wif_go_free(p_categories text[], p_until timestamptz, p_max_km int default 10,
  p_group text default 'any', p_budget text default 'any', p_note text default null, p_starts_at timestamptz default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare me wif_profiles := wif_me(); a wif_availability; st timestamptz := greatest(coalesce(p_starts_at, now()), now()); n int;
begin
  if not me.onboarded then raise exception 'profile_incomplete'; end if;
  if p_until is null or p_until <= st + interval '10 minutes' or p_until > st + interval '24 hours' then raise exception 'invalid_duration'; end if;
  if st > now() + interval '7 days' then raise exception 'invalid_duration'; end if;
  if cardinality(coalesce(p_categories, '{}')) = 0 then raise exception 'pick_activity'; end if;
  if exists (select 1 from unnest(p_categories) c where not exists (select 1 from wif_categories k where k.id = c and k.active)) then raise exception 'invalid_category'; end if;
  select count(*) into n from wif_availability where user_id = me.id and created_at > now() - interval '1 day';
  if n >= 20 then raise exception 'rate_limited'; end if;
  -- one live availability at a time: end the previous one
  update wif_availability set ends_at = greatest(starts_at + interval '1 second', now()) where user_id = me.id and ends_at > now() and starts_at <= now();
  insert into wif_availability (user_id, categories, starts_at, ends_at, max_km, group_pref, budget, note)
  values (me.id, p_categories[1:5], st, p_until, least(greatest(coalesce(p_max_km, 10), 1), 100), coalesce(p_group, 'any'), coalesce(p_budget, 'any'), nullif(trim(p_note), ''))
  returning * into a;
  return to_jsonb(a);
end $$;

create or replace function public.wif_stop_free() returns void language sql security definer set search_path = public as $$
  update wif_availability set ends_at = greatest(starts_at + interval '1 second', now()) where user_id = auth.uid() and ends_at > now();
$$;

-- ----------------------------------------------------------------- discovery
-- p_mode: 'free_now' (available right now) | 'tonight' (available this evening, local time) | 'nearby' (everyone with location on)
create or replace function public.wif_discover(p_mode text default 'free_now', p_radius_km int default 10, p_category text default null,
  p_min_age int default null, p_max_age int default null, p_language text default null, p_group text default null,
  p_tz text default 'UTC', p_offset int default 0, p_limit int default 30)
returns setof jsonb language plpgsql security definer set search_path = public, extensions as $$
declare me wif_profiles := wif_me(); mine wif_zones; r int; tz text := coalesce(nullif(p_tz, ''), 'UTC'); eve_start timestamptz; eve_end timestamptz;
begin
  select * into mine from wif_zones where user_id = me.id and enabled;
  if mine.user_id is null then raise exception 'location_off'; end if;
  r := least(greatest(coalesce(p_radius_km, 10), 1), case when me.tier = 'free' then 50 else 200 end);
  begin
    eve_start := ((now() at time zone tz)::date + time '17:00') at time zone tz;
  exception when others then tz := 'UTC'; eve_start := ((now() at time zone tz)::date + time '17:00') at time zone tz; end;
  eve_end := eve_start + interval '9 hours';
  return query
  select wif_person(o, me, st_distance(z.cell, mine.cell))
  from wif_profiles o
  join wif_zones z on z.user_id = o.id and z.enabled and z.updated_at > now() - interval '14 days'
  left join lateral (select * from wif_availability a where a.user_id = o.id and a.ends_at > now() order by a.created_at desc limit 1) av on true
  where o.id <> me.id and o.status = 'active' and o.onboarded and o.discoverable
    and not wif_blocked(o.id, me.id)
    and st_dwithin(z.cell, mine.cell, r * 1000)
    and (p_mode = 'nearby' or av.id is not null)
    and (p_mode <> 'free_now' or av.starts_at <= now())
    and (p_mode <> 'tonight' or (av.ends_at > eve_start and av.starts_at < eve_end))
    and (p_category is null or p_category = any(av.categories) or (p_mode = 'nearby' and p_category = any(o.interests)))
    and (p_min_age is null or (o.show_age and wif_age(o.birth_date) >= p_min_age))
    and (p_max_age is null or (o.show_age and wif_age(o.birth_date) <= p_max_age))
    and (p_language is null or p_language = any(o.languages))
    and (p_group is null or av.group_pref in (p_group, 'any'))
  order by (av.id is not null and av.starts_at <= now()) desc,
    st_distance(z.cell, mine.cell) asc,
    (select count(*) from unnest(o.interests) x where x = any(me.interests)) desc,
    o.last_active_at desc
  offset greatest(p_offset, 0) limit least(greatest(p_limit, 1), 50);
end $$;

create or replace function public.wif_get_person(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare me wif_profiles := wif_me(); o wif_profiles; d double precision; req wif_requests; conv uuid;
begin
  select * into o from wif_profiles where id = p_id and status = 'active';
  if o.id is null or (o.id <> me.id and wif_blocked(o.id, me.id)) then raise exception 'not_available'; end if;
  select st_distance(a.cell, b.cell) into d from wif_zones a, wif_zones b where a.user_id = o.id and a.enabled and b.user_id = me.id and b.enabled;
  select * into req from wif_requests where ((from_id = me.id and to_id = o.id) or (from_id = o.id and to_id = me.id)) order by created_at desc limit 1;
  select m1.conversation_id into conv from wif_members m1 join wif_members m2 on m2.conversation_id = m1.conversation_id
    join wif_conversations c on c.id = m1.conversation_id and c.kind = 'direct' where m1.user_id = me.id and m2.user_id = o.id limit 1;
  return wif_person(o, me, d) || jsonb_build_object(
    'is_me', o.id = me.id,
    'member_since', o.created_at,
    'request', case when req.id is null then null else jsonb_build_object('id', req.id, 'status', req.status, 'incoming', req.to_id = me.id) end,
    'conversation_id', conv,
    'hosting', (select count(*) from wif_activities a where a.host_id = o.id and a.status = 'open' and a.starts_at > now()));
end $$;

-- ----------------------------------------------------------------- requests & matches
create or replace function public.wif_notify(p_user uuid, p_type text, p_data jsonb) returns void
language sql security definer set search_path = public as $$
  insert into wif_notifications (user_id, type, data) values (p_user, p_type, coalesce(p_data, '{}'));
$$;
revoke execute on function public.wif_notify(uuid, text, jsonb) from public, anon, authenticated;

create or replace function public.wif_open_direct(a uuid, b uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare c uuid;
begin
  select m1.conversation_id into c from wif_members m1 join wif_members m2 on m2.conversation_id = m1.conversation_id
    join wif_conversations k on k.id = m1.conversation_id and k.kind = 'direct' where m1.user_id = a and m2.user_id = b limit 1;
  if c is null then
    insert into wif_conversations (kind) values ('direct') returning id into c;
    insert into wif_members (conversation_id, user_id) values (c, a), (c, b);
    insert into wif_messages (conversation_id, kind, body) values (c, 'system', 'match');
  end if;
  return c;
end $$;
revoke execute on function public.wif_open_direct(uuid, uuid) from public, anon, authenticated;

create or replace function public.wif_send_request(p_to uuid, p_message text default null, p_category text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me wif_profiles := wif_me(); o wif_profiles; rev wif_requests; n int; c uuid; rid uuid;
begin
  if not me.onboarded then raise exception 'profile_incomplete'; end if;
  select * into o from wif_profiles where id = p_to and status = 'active' and onboarded;
  if o.id is null or o.id = me.id or wif_blocked(o.id, me.id) then raise exception 'not_available'; end if;
  select count(*) into n from wif_requests where from_id = me.id and created_at > now() - interval '1 day';
  if n >= (case me.tier when 'free' then 30 else 100 end) then raise exception 'request_limit'; end if;
  if exists (select 1 from wif_requests where from_id = me.id and to_id = o.id and status = 'declined' and responded_at > now() - interval '30 days') then raise exception 'not_available'; end if;
  -- they already asked me: that is a mutual match
  select * into rev from wif_requests where from_id = o.id and to_id = me.id and status = 'pending';
  if rev.id is not null then
    c := wif_open_direct(me.id, o.id);
    update wif_requests set status = 'accepted', responded_at = now(), conversation_id = c where id = rev.id;
    perform wif_notify(o.id, 'match', jsonb_build_object('user', me.id, 'name', me.display_name, 'conversation_id', c));
    return jsonb_build_object('status', 'accepted', 'conversation_id', c);
  end if;
  if exists (select 1 from wif_requests where from_id = me.id and to_id = o.id and status = 'pending') then return jsonb_build_object('status', 'pending'); end if;
  insert into wif_requests (from_id, to_id, message, category) values (me.id, o.id, nullif(trim(p_message), ''), p_category) returning id into rid;
  perform wif_notify(o.id, 'request', jsonb_build_object('request', rid, 'user', me.id, 'name', me.display_name));
  return jsonb_build_object('status', 'pending', 'id', rid);
end $$;

create or replace function public.wif_respond_request(p_id uuid, p_accept boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me wif_profiles := wif_me(); r wif_requests; c uuid;
begin
  select * into r from wif_requests where id = p_id and to_id = me.id and status = 'pending' for update;
  if r.id is null then raise exception 'not_found'; end if;
  if not p_accept then
    update wif_requests set status = 'declined', responded_at = now() where id = r.id;
    return jsonb_build_object('status', 'declined');
  end if;
  if wif_blocked(r.from_id, me.id) then raise exception 'not_available'; end if;
  c := wif_open_direct(me.id, r.from_id);
  update wif_requests set status = 'accepted', responded_at = now(), conversation_id = c where id = r.id;
  perform wif_notify(r.from_id, 'match', jsonb_build_object('user', me.id, 'name', me.display_name, 'conversation_id', c));
  return jsonb_build_object('status', 'accepted', 'conversation_id', c);
end $$;

create or replace function public.wif_cancel_request(p_id uuid) returns void language sql security definer set search_path = public as $$
  update wif_requests set status = 'cancelled', responded_at = now() where id = p_id and from_id = auth.uid() and status = 'pending';
$$;

-- inbox: incoming requests, conversations with last message & unread count
create or replace function public.wif_inbox() returns jsonb
language plpgsql security definer set search_path = public as $$
declare me wif_profiles := wif_me();
begin
  return jsonb_build_object(
    'requests', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'message', r.message, 'category', r.category, 'created_at', r.created_at,
        'person', wif_person(p, me, null)) order by r.created_at desc)
      from wif_requests r join wif_profiles p on p.id = r.from_id
      where r.to_id = me.id and r.status = 'pending' and p.status = 'active' and not wif_blocked(p.id, me.id)), '[]'),
    'sent', (select count(*) from wif_requests where from_id = me.id and status = 'pending'),
    'conversations', coalesce((select jsonb_agg(x order by (x->>'last_at') desc) from (
      select jsonb_build_object('id', c.id, 'kind', c.kind, 'title', coalesce(c.title, a.title), 'activity_id', c.activity_id,
        'last_at', c.last_message_at,
        'last', (select jsonb_build_object('body', m.body, 'kind', m.kind, 'mine', m.sender_id = me.id) from wif_messages m where m.conversation_id = c.id order by m.created_at desc limit 1),
        'unread', (select count(*) from wif_messages m where m.conversation_id = c.id and m.created_at > mm.last_read_at and m.sender_id is distinct from me.id),
        'members', (select count(*) from wif_members x where x.conversation_id = c.id),
        'other', case when c.kind = 'direct' then (select wif_person(p, me, null) from wif_members o2 join wif_profiles p on p.id = o2.user_id
                    where o2.conversation_id = c.id and o2.user_id <> me.id limit 1) end) as x
      from wif_members mm join wif_conversations c on c.id = mm.conversation_id
      left join wif_activities a on a.id = c.activity_id
      where mm.user_id = me.id
        and not exists (select 1 from wif_members o3 where o3.conversation_id = c.id and o3.user_id <> me.id and c.kind = 'direct' and wif_blocked(o3.user_id, me.id))
      limit 200) q), '[]'));
end $$;

create or replace function public.wif_conversation(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me wif_profiles := wif_me(); c wif_conversations;
begin
  select * into c from wif_conversations where id = p_id;
  if c.id is null or not wif_is_member(c.id, me.id) then raise exception 'not_found'; end if;
  return jsonb_build_object('id', c.id, 'kind', c.kind, 'activity_id', c.activity_id,
    'title', coalesce(c.title, (select title from wif_activities where id = c.activity_id)),
    'members', (select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.display_name, 'photo_path', p.photo_path))
                from wif_members m join wif_profiles p on p.id = m.user_id where m.conversation_id = c.id),
    'other', case when c.kind = 'direct' then (select wif_person(p, me, null) from wif_members o join wif_profiles p on p.id = o.user_id
                where o.conversation_id = c.id and o.user_id <> me.id limit 1) end);
end $$;

-- ----------------------------------------------------------------- activities
create or replace function public.wif_activity_json(a public.wif_activities, me public.wif_profiles, d double precision)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', a.id, 'title', a.title, 'description', a.description, 'category', a.category_id, 'cover_path', a.cover_path,
    'starts_at', a.starts_at, 'ends_at', a.ends_at, 'place_name', a.place_name, 'city', a.city, 'distance', wif_band(d),
    'max', a.max_participants, 'price', a.price_text, 'status', a.status,
    'going', 1 + (select count(*) from wif_participants p where p.activity_id = a.id and p.status = 'approved'),
    'host', (select jsonb_build_object('id', h.id, 'name', h.display_name, 'photo_path', h.photo_path, 'verified', h.is_verified) from wif_profiles h where h.id = a.host_id),
    'is_host', a.host_id = me.id,
    'my_status', (select p.status from wif_participants p where p.activity_id = a.id and p.user_id = me.id));
$$;

create or replace function public.wif_create_activity(p_category text, p_title text, p_description text, p_starts_at timestamptz, p_ends_at timestamptz,
  p_place text, p_lat double precision default null, p_lng double precision default null, p_max int default 4, p_price text default null, p_cover text default null)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare me wif_profiles := wif_me(); z wif_zones; a wif_activities; c uuid; n int; cell geography;
begin
  if not me.onboarded then raise exception 'profile_incomplete'; end if;
  if p_starts_at < now() - interval '10 minutes' or p_starts_at > now() + interval '60 days' then raise exception 'invalid_date'; end if;
  select count(*) into n from wif_activities where host_id = me.id and created_at > now() - interval '1 day';
  if n >= 10 then raise exception 'rate_limited'; end if;
  if p_cover is not null and split_part(p_cover, '/', 1) <> me.id::text then raise exception 'invalid_photo'; end if;
  select * into z from wif_zones where user_id = me.id and enabled;
  cell := case when p_lat is not null and p_lng is not null then wif_snap(p_lat, p_lng) else z.cell end;
  if cell is null then raise exception 'location_off'; end if;
  insert into wif_conversations (kind) values ('group') returning id into c;
  insert into wif_activities (host_id, category_id, title, description, starts_at, ends_at, place_name, city, cell, max_participants, price_text, cover_path, conversation_id)
  values (me.id, p_category, trim(p_title), nullif(trim(p_description), ''), p_starts_at, p_ends_at, trim(p_place), coalesce(z.city, me.city), cell,
          least(greatest(coalesce(p_max, 4), 2), 50), nullif(trim(p_price), ''), p_cover, c) returning * into a;
  update wif_conversations set activity_id = a.id where id = c;
  insert into wif_members (conversation_id, user_id) values (c, me.id);
  insert into wif_messages (conversation_id, kind, body) values (c, 'system', 'activity_created');
  return wif_activity_json(a, me, 0);
end $$;

-- p_mode: 'nearby' | 'tonight' | 'mine' (hosting) | 'joined'
create or replace function public.wif_activities(p_mode text default 'nearby', p_category text default null, p_radius_km int default 25,
  p_tz text default 'UTC', p_offset int default 0, p_limit int default 30)
returns setof jsonb language plpgsql security definer set search_path = public, extensions as $$
declare me wif_profiles := wif_me(); mine wif_zones; tz text := coalesce(nullif(p_tz, ''), 'UTC'); eve_start timestamptz; r int;
begin
  select * into mine from wif_zones where user_id = me.id and enabled;
  r := least(greatest(coalesce(p_radius_km, 25), 1), 200);
  begin eve_start := ((now() at time zone tz)::date + time '17:00') at time zone tz;
  exception when others then eve_start := (current_date + time '17:00') at time zone 'UTC'; end;
  return query
  select wif_activity_json(a, me, case when mine.cell is not null then st_distance(a.cell, mine.cell) end)
  from wif_activities a
  where a.status = 'open' and coalesce(a.ends_at, a.starts_at + interval '3 hours') > now()
    and not wif_blocked(a.host_id, me.id)
    and (p_category is null or a.category_id = p_category)
    and case p_mode
      when 'mine' then a.host_id = me.id
      when 'joined' then exists (select 1 from wif_participants p where p.activity_id = a.id and p.user_id = me.id and p.status in ('pending','approved'))
      when 'tonight' then mine.cell is not null and st_dwithin(a.cell, mine.cell, r * 1000) and a.starts_at < eve_start + interval '9 hours' and coalesce(a.ends_at, a.starts_at + interval '3 hours') > eve_start
      else mine.cell is not null and st_dwithin(a.cell, mine.cell, r * 1000) end
  order by a.starts_at asc
  offset greatest(p_offset, 0) limit least(greatest(p_limit, 1), 50);
end $$;

create or replace function public.wif_get_activity(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare me wif_profiles := wif_me(); a wif_activities; d double precision;
begin
  select * into a from wif_activities where id = p_id;
  if a.id is null or wif_blocked(a.host_id, me.id) then raise exception 'not_found'; end if;
  select st_distance(a.cell, z.cell) into d from wif_zones z where z.user_id = me.id and z.enabled;
  return wif_activity_json(a, me, d) || jsonb_build_object(
    'conversation_id', case when a.host_id = me.id or exists (select 1 from wif_participants p where p.activity_id = a.id and p.user_id = me.id and p.status = 'approved') then a.conversation_id end,
    'participants', coalesce((select jsonb_agg(jsonb_build_object('id', u.id, 'name', u.display_name, 'photo_path', u.photo_path, 'status', p.status, 'message', case when a.host_id = me.id then p.message end) order by p.created_at)
      from wif_participants p join wif_profiles u on u.id = p.user_id
      where p.activity_id = a.id and (p.status = 'approved' or (a.host_id = me.id and p.status = 'pending'))), '[]'));
end $$;

create or replace function public.wif_join_activity(p_id uuid, p_message text default null) returns text
language plpgsql security definer set search_path = public as $$
declare me wif_profiles := wif_me(); a wif_activities; going int;
begin
  if not me.onboarded then raise exception 'profile_incomplete'; end if;
  select * into a from wif_activities where id = p_id and status = 'open' for update;
  if a.id is null or wif_blocked(a.host_id, me.id) then raise exception 'not_found'; end if;
  if a.host_id = me.id then raise exception 'already_host'; end if;
  if coalesce(a.ends_at, a.starts_at + interval '3 hours') < now() then raise exception 'activity_over'; end if;
  select count(*) into going from wif_participants where activity_id = a.id and status = 'approved';
  if going + 1 >= a.max_participants then raise exception 'activity_full'; end if;
  insert into wif_participants (activity_id, user_id, status, message) values (a.id, me.id, 'pending', nullif(trim(p_message), ''))
  on conflict (activity_id, user_id) do update set status = case when wif_participants.status = 'declined' then 'declined' else 'pending' end, message = excluded.message, created_at = now()
    where wif_participants.status in ('left','pending');
  perform wif_notify(a.host_id, 'join_request', jsonb_build_object('activity', a.id, 'title', a.title, 'user', me.id, 'name', me.display_name));
  return (select status from wif_participants where activity_id = a.id and user_id = me.id);
end $$;

create or replace function public.wif_respond_join(p_activity uuid, p_user uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare me wif_profiles := wif_me(); a wif_activities; going int;
begin
  select * into a from wif_activities where id = p_activity and host_id = me.id for update;
  if a.id is null then raise exception 'not_found'; end if;
  if p_accept then
    select count(*) into going from wif_participants where activity_id = a.id and status = 'approved';
    if going + 1 >= a.max_participants then raise exception 'activity_full'; end if;
    update wif_participants set status = 'approved' where activity_id = a.id and user_id = p_user and status = 'pending';
    if not found then raise exception 'not_found'; end if;
    insert into wif_members (conversation_id, user_id) values (a.conversation_id, p_user) on conflict do nothing;
    insert into wif_messages (conversation_id, kind, body) values (a.conversation_id, 'system', 'joined:' || coalesce((select display_name from wif_profiles where id = p_user), ''));
  else
    update wif_participants set status = 'declined' where activity_id = a.id and user_id = p_user and status = 'pending';
  end if;
  perform wif_notify(p_user, case when p_accept then 'join_approved' else 'join_declined' end, jsonb_build_object('activity', a.id, 'title', a.title));
end $$;

create or replace function public.wif_leave_activity(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me wif_profiles := wif_me(); a wif_activities;
begin
  select * into a from wif_activities where id = p_id;
  if a.id is null then raise exception 'not_found'; end if;
  if a.host_id = me.id then
    update wif_activities set status = 'cancelled' where id = a.id;
    insert into wif_messages (conversation_id, kind, body) values (a.conversation_id, 'system', 'activity_cancelled');
    insert into wif_notifications (user_id, type, data)
      select user_id, 'activity_cancelled', jsonb_build_object('activity', a.id, 'title', a.title) from wif_participants where activity_id = a.id and status in ('approved','pending');
  else
    update wif_participants set status = 'left' where activity_id = a.id and user_id = me.id;
    delete from wif_members where conversation_id = a.conversation_id and user_id = me.id;
  end if;
end $$;

-- ----------------------------------------------------------------- surprise me (real data only)
create or replace function public.wif_surprise(p_minutes int, p_budget text default 'any', p_km int default 10, p_tz text default 'UTC') returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare me wif_profiles := wif_me(); mine wif_zones; act jsonb; people jsonb; win_end timestamptz := now() + make_interval(mins => least(greatest(coalesce(p_minutes, 120), 30), 1440));
begin
  select * into mine from wif_zones where user_id = me.id and enabled;
  if mine.user_id is null then raise exception 'location_off'; end if;
  select wif_activity_json(a, me, st_distance(a.cell, mine.cell)) into act
  from wif_activities a
  where a.status = 'open' and a.host_id <> me.id and not wif_blocked(a.host_id, me.id)
    and a.starts_at between now() - interval '30 minutes' and win_end
    and st_dwithin(a.cell, mine.cell, least(greatest(p_km, 1), 100) * 1000)
    and (select count(*) from wif_participants p where p.activity_id = a.id and p.status = 'approved') + 1 < a.max_participants
    and not exists (select 1 from wif_participants p where p.activity_id = a.id and p.user_id = me.id)
    and (p_budget in ('any', 'medium') or a.price_text is null or (p_budget = 'free' and a.price_text ~* '^(free|gratuit|0)'))
  order by (a.category_id = any(me.interests)) desc, st_distance(a.cell, mine.cell), random()
  limit 1;
  select coalesce(jsonb_agg(x), '[]') into people from (
    select wif_person(o, me, st_distance(z.cell, mine.cell)) x
    from wif_profiles o join wif_zones z on z.user_id = o.id and z.enabled
    join lateral (select * from wif_availability a where a.user_id = o.id and a.ends_at > now() and a.starts_at <= now() order by a.created_at desc limit 1) av on true
    where o.id <> me.id and o.status = 'active' and o.onboarded and o.discoverable and not wif_blocked(o.id, me.id)
      and st_dwithin(z.cell, mine.cell, least(greatest(p_km, 1), 100) * 1000)
      and (p_budget = 'any' or av.budget in (p_budget, 'any'))
    order by (select count(*) from unnest(av.categories) c where c = any(me.interests)) desc, random()
    limit 5) q;
  return jsonb_build_object('activity', act, 'people', people);
end $$;

-- ----------------------------------------------------------------- moments
create or replace function public.wif_feed(p_offset int default 0, p_limit int default 20) returns setof jsonb
language plpgsql security definer set search_path = public as $$
declare me wif_profiles := wif_me();
begin
  return query
  select jsonb_build_object('id', p.id, 'body', p.body, 'media_path', p.media_path, 'created_at', p.created_at, 'activity_id', p.activity_id,
    'author', jsonb_build_object('id', u.id, 'name', u.display_name, 'photo_path', u.photo_path, 'city', u.city, 'verified', u.is_verified),
    'likes', (select count(*) from wif_post_likes l where l.post_id = p.id),
    'liked', exists (select 1 from wif_post_likes l where l.post_id = p.id and l.user_id = me.id),
    'mine', p.author_id = me.id)
  from wif_posts p join wif_profiles u on u.id = p.author_id
  where p.status = 'visible' and u.status = 'active' and not wif_blocked(u.id, me.id)
  order by p.created_at desc offset greatest(p_offset, 0) limit least(greatest(p_limit, 1), 50);
end $$;

create or replace function public.wif_create_post(p_body text, p_media text default null, p_activity uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare me wif_profiles := wif_me(); n int; pid uuid;
begin
  if not me.onboarded then raise exception 'profile_incomplete'; end if;
  if p_media is not null and split_part(p_media, '/', 1) <> me.id::text then raise exception 'invalid_photo'; end if;
  select count(*) into n from wif_posts where author_id = me.id and created_at > now() - interval '1 day';
  if n >= 20 then raise exception 'rate_limited'; end if;
  insert into wif_posts (author_id, body, media_path, activity_id) values (me.id, nullif(trim(p_body), ''), p_media, p_activity) returning id into pid;
  return pid;
end $$;

create or replace function public.wif_toggle_like(p_post uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare me wif_profiles := wif_me();
begin
  if exists (select 1 from wif_post_likes where post_id = p_post and user_id = me.id) then
    delete from wif_post_likes where post_id = p_post and user_id = me.id; return false;
  end if;
  insert into wif_post_likes (post_id, user_id) values (p_post, me.id); return true;
end $$;

create or replace function public.wif_delete_post(p_post uuid) returns void language sql security definer set search_path = public as $$
  update wif_posts set status = 'removed' where id = p_post and author_id = auth.uid();
$$;

-- ----------------------------------------------------------------- safety
create or replace function public.wif_block(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me wif_profiles := wif_me();
begin
  if p_user = me.id then raise exception 'invalid'; end if;
  insert into wif_blocks (blocker, blocked) values (me.id, p_user) on conflict do nothing;
  update wif_requests set status = 'cancelled' where status = 'pending' and ((from_id = me.id and to_id = p_user) or (from_id = p_user and to_id = me.id));
end $$;
create or replace function public.wif_unblock(p_user uuid) returns void language sql security definer set search_path = public as $$
  delete from wif_blocks where blocker = auth.uid() and blocked = p_user;
$$;
create or replace function public.wif_blocked_list() returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'name', p.display_name, 'photo_path', p.photo_path)), '[]')
  from wif_blocks b join wif_profiles p on p.id = b.blocked where b.blocker = auth.uid();
$$;

create or replace function public.wif_report(p_user uuid, p_reason text, p_details text default null, p_activity uuid default null, p_post uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare me wif_profiles := wif_me(); n int;
begin
  select count(*) into n from wif_reports where reporter = me.id and created_at > now() - interval '1 day';
  if n >= 20 then raise exception 'rate_limited'; end if;
  insert into wif_reports (reporter, target_user, target_activity, target_post, reason, details) values (me.id, p_user, p_activity, p_post, p_reason, nullif(trim(p_details), ''));
end $$;

-- deletes the WhoIsFree profile and everything attached to it (the shared sign-in account is kept)
create or replace function public.wif_delete_account() returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  update wif_activities set status = 'cancelled' where host_id = auth.uid();
  delete from wif_profiles where id = auth.uid();
end $$;

-- ----------------------------------------------------------------- admin
create or replace function public.wif_require_admin() returns uuid language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from wif_profiles where id = auth.uid() and is_admin) then raise exception 'not_allowed'; end if;
  return auth.uid();
end $$;
revoke execute on function public.wif_require_admin() from public, anon;

create or replace function public.wif_admin_overview() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform wif_require_admin();
  return jsonb_build_object(
    'members', (select count(*) from wif_profiles where onboarded),
    'active_24h', (select count(*) from wif_profiles where last_active_at > now() - interval '24 hours'),
    'free_now', (select count(distinct user_id) from wif_availability where ends_at > now() and starts_at <= now()),
    'location_on', (select count(*) from wif_zones where enabled),
    'activities_open', (select count(*) from wif_activities where status = 'open' and starts_at > now()),
    'open_reports', (select count(*) from wif_reports where status = 'open'),
    'matches_7d', (select count(*) from wif_requests where status = 'accepted' and responded_at > now() - interval '7 days'));
end $$;

create or replace function public.wif_admin_reports() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform wif_require_admin();
  return coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'reason', r.reason, 'details', r.details, 'created_at', r.created_at,
      'target', jsonb_build_object('id', t.id, 'name', t.display_name, 'status', t.status, 'photo_path', t.photo_path),
      'reports_on_target', (select count(*) from wif_reports x where x.target_user = r.target_user),
      'activity', (select title from wif_activities where id = r.target_activity),
      'post', (select body from wif_posts where id = r.target_post)) order by r.created_at desc)
    from wif_reports r left join wif_profiles t on t.id = r.target_user where r.status = 'open'), '[]');
end $$;

create or replace function public.wif_admin_resolve(p_report uuid, p_action text) returns void
language plpgsql security definer set search_path = public as $$
declare a uuid := wif_require_admin(); r wif_reports;
begin
  select * into r from wif_reports where id = p_report;
  if r.id is null then raise exception 'not_found'; end if;
  if p_action = 'suspend' and r.target_user is not null then
    update wif_profiles set status = 'suspended' where id = r.target_user and not is_admin;
    delete from wif_zones where user_id = r.target_user;
  elsif p_action = 'remove_content' then
    update wif_posts set status = 'removed' where id = r.target_post;
    update wif_activities set status = 'cancelled' where id = r.target_activity;
  elsif p_action = 'remove_photos' and r.target_user is not null then
    update wif_profiles set photo_path = null, gallery = '{}' where id = r.target_user;
  elsif p_action <> 'dismiss' then raise exception 'invalid_action'; end if;
  update wif_reports set status = case when p_action = 'dismiss' then 'dismissed' else 'actioned' end where id = r.id;
  insert into wif_audit (actor, action, target, data) values (a, 'report:' || p_action, r.target_user, jsonb_build_object('report', r.id));
end $$;

create or replace function public.wif_admin_save_category(p_id text, p_emoji text, p_en text, p_fr text, p_ar text, p_color text, p_sort int, p_active boolean) returns void
language plpgsql security definer set search_path = public as $$
declare a uuid := wif_require_admin();
begin
  if p_id !~ '^[a-z_]{2,24}$' then raise exception 'invalid_id'; end if;
  insert into wif_categories (id, emoji, name_en, name_fr, name_ar, color, sort, active) values (p_id, p_emoji, p_en, p_fr, p_ar, coalesce(p_color, '#FFD600'), coalesce(p_sort, 99), coalesce(p_active, true))
  on conflict (id) do update set emoji = excluded.emoji, name_en = excluded.name_en, name_fr = excluded.name_fr, name_ar = excluded.name_ar,
    color = excluded.color, sort = excluded.sort, active = excluded.active;
  insert into wif_audit (actor, action, data) values (a, 'category', jsonb_build_object('id', p_id));
end $$;

-- ----------------------------------------------------------------- grants
do $$
declare f text;
begin
  for f in select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like 'wif\_%' loop
    execute format('revoke execute on function %s from public, anon', f);
  end loop;
end $$;
grant execute on function
  public.wif_bootstrap(), public.wif_touch(), public.wif_set_location(double precision, double precision, text, text), public.wif_disable_location(),
  public.wif_go_free(text[], timestamptz, int, text, text, text, timestamptz), public.wif_stop_free(),
  public.wif_discover(text, int, text, int, int, text, text, text, int, int), public.wif_get_person(uuid),
  public.wif_send_request(uuid, text, text), public.wif_respond_request(uuid, boolean), public.wif_cancel_request(uuid),
  public.wif_inbox(), public.wif_conversation(uuid),
  public.wif_create_activity(text, text, text, timestamptz, timestamptz, text, double precision, double precision, int, text, text),
  public.wif_activities(text, text, int, text, int, int), public.wif_get_activity(uuid), public.wif_join_activity(uuid, text),
  public.wif_respond_join(uuid, uuid, boolean), public.wif_leave_activity(uuid), public.wif_surprise(int, text, int, text),
  public.wif_feed(int, int), public.wif_create_post(text, text, uuid), public.wif_toggle_like(uuid), public.wif_delete_post(uuid),
  public.wif_block(uuid), public.wif_unblock(uuid), public.wif_blocked_list(), public.wif_report(uuid, text, text, uuid, uuid), public.wif_delete_account(),
  public.wif_admin_overview(), public.wif_admin_reports(), public.wif_admin_resolve(uuid, text),
  public.wif_admin_save_category(text, text, text, text, text, text, int, boolean),
  public.wif_is_member(uuid, uuid), public.wif_blocked(uuid, uuid)
to authenticated;
revoke execute on function public.wif_me(), public.wif_notify(uuid, text, jsonb), public.wif_open_direct(uuid, uuid) from authenticated;

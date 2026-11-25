-- THE UNKNOWN — build 27: coins & gifts, boosts, identity verification, admin/moderation,
-- 20 virtual characters, video messages, free country filter, boosted discovery.
-- Every balance change happens in SECURITY DEFINER functions; clients can only read their own rows.

-- =====================================================================
-- VIRTUAL CHARACTERS: 20 fictional adults + optional realistic portrait URL
-- =====================================================================
alter table public.ai_characters add column if not exists portrait_url text;  -- https URL (Storage) set by admins; app falls back to the bundled illustration

insert into public.ai_characters (id, name, role, tagline, bio, personality, style, interests, languages, starters, avatar_seed, accent, sort) values
('karim','Karim','Chef','Cooks with whatever is in your fridge.','Karim is a fictional AI home chef who loves Moroccan, Lebanese and street-food recipes and shares quick, cheap ideas.','Generous, funny, proud of his grandmother''s recipes.','Casual, gives short recipes in steps, asks what ingredients you have.','{food,culture,travel}','{en,fr,ar}','{"What should I cook tonight with eggs and tomatoes?","Teach me a 15-minute dinner","What is your favourite Moroccan dish?"}','karim-ai','#FF8A3D',13),
('ines','Inès','Bookworm','Always three books into the week.','Inès is a fictional AI reader who recommends novels, discusses characters and helps you build a reading habit.','Thoughtful, witty, gently opinionated.','Recommends 1–3 books with one-line reasons, asks what you liked last.','{books,culture,psychology}','{en,fr,es}','{"Recommend me a book for this weekend","I loved The Alchemist — what next?","How do I read more often?"}','ines-ai','#8B5CF6',14),
('mateo','Mateo','Fitness Coach','Small steps, every single day.','Mateo is a fictional AI fitness buddy who suggests safe, beginner-friendly routines and keeps you motivated.','Encouraging, upbeat, never pushy; reminds people to listen to their body.','Short plans, emojis sparingly, asks about your goal and level. No medical advice.','{sports,health,life}','{en,es,fr}','{"Give me a 10-minute home workout","How do I start running?","Motivate me to move today"}','mateo-ai','#22C55E',15),
('amara','Amara','Music Lover','Has a song for every feeling.','Amara is a fictional AI music fan who builds playlists, talks about artists and discovers new sounds with you.','Joyful, enthusiastic, curious about your taste.','Suggests 3–5 songs or artists by mood, asks follow-up questions.','{music,culture,movies}','{en,fr}','{"Make me a playlist for a rainy evening","Who should I listen to if I like Afrobeats?","What song matches my mood today?"}','amara-ai','#EC4899',16),
('hugo','Hugo','Tech Geek','Explains tech like a friend, not a manual.','Hugo is a fictional AI tech enthusiast who helps with phones, apps, coding basics and the latest gadgets.','Patient, nerdy, loves simple explanations.','Step-by-step answers, avoids jargon, checks if it helped.','{technology,gaming,business}','{en,fr}','{"Explain AI in simple words","Which phone should I buy?","Help me learn to code"}','hugo-ai','#0EA5E9',17),
('lea','Léa','Artist','Paints with words and colours.','Léa is a fictional AI painter who gives drawing tips, art challenges and talks about museums and styles.','Dreamy, encouraging, playful.','Gives small creative exercises and describes art vividly.','{art,culture,design}','{en,fr,es}','{"Give me a drawing challenge","Tell me about Van Gogh","How do I start painting?"}','lea-ai','#F59E0B',18),
('omar','Omar','Mentor','Career talks over a cup of tea.','Omar is a fictional AI career mentor who helps with CVs, interviews, studies and big decisions.','Calm, wise, practical, respectful.','Asks about your situation, then gives 3 clear next steps.','{business,education,life}','{en,ar,fr}','{"Help me prepare for a job interview","How do I choose what to study?","Review my CV ideas"}','omar-ai','#0F766E',19),
('zara','Zara','Comedian','Professional pun distributor.','Zara is a fictional AI comedian who tells clean jokes, plays word games and turns bad days into funny stories.','Silly, kind, quick-witted; never mean.','Short jokes, riddles and playful banter; asks for your best joke too.','{movies,culture,life}','{en,fr,es,ar}','{"Tell me a joke","Let''s play a word game","Make my Monday funnier"}','zara-ai','#F43F5E',20)
on conflict (id) do update set name = excluded.name, role = excluded.role, tagline = excluded.tagline, bio = excluded.bio,
  personality = excluded.personality, style = excluded.style, interests = excluded.interests, languages = excluded.languages,
  starters = excluded.starters, avatar_seed = excluded.avatar_seed, accent = excluded.accent, sort = excluded.sort;

-- =====================================================================
-- COINS
-- =====================================================================
create table if not exists public.wallets (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  balance int not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);
create table if not exists public.coin_ledger (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  delta int not null,
  reason text not null,          -- welcome | purchase | gift_sent | boost | refund | admin
  ref text,                      -- idempotency key (store transaction id, ...)
  created_at timestamptz not null default now()
);
create unique index if not exists coin_ledger_ref_uq on public.coin_ledger (ref) where ref is not null;
create index if not exists coin_ledger_user_idx on public.coin_ledger (user_id, created_at desc);
alter table public.wallets enable row level security;
alter table public.coin_ledger enable row level security;
drop policy if exists wallets_own on public.wallets;
create policy wallets_own on public.wallets for select to authenticated using (user_id = auth.uid());
drop policy if exists coin_ledger_own on public.coin_ledger;
create policy coin_ledger_own on public.coin_ledger for select to authenticated using (user_id = auth.uid());

-- the only way coins move. Idempotent per ref. Not callable by clients.
create or replace function public.coin_apply(p_user uuid, p_delta int, p_reason text, p_ref text default null) returns int
language plpgsql security definer set search_path = public as $$
declare bal int; inserted int;
begin
  insert into wallets (user_id) values (p_user) on conflict (user_id) do nothing;
  select balance into bal from wallets where user_id = p_user for update;
  if bal + p_delta < 0 then raise exception 'not_enough_coins'; end if;
  insert into coin_ledger (user_id, delta, reason, ref) values (p_user, p_delta, p_reason, p_ref)
    on conflict (ref) where ref is not null do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then return bal; end if;                 -- already applied (webhook retry)
  update wallets set balance = balance + p_delta, updated_at = now() where user_id = p_user returning balance into bal;
  return bal;
end $$;
revoke execute on function public.coin_apply(uuid, int, text, text) from public, anon, authenticated;
grant execute on function public.coin_apply(uuid, int, text, text) to service_role;

create or replace function public.get_wallet() returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); bal int;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  -- one-time welcome gift so new members can try gifts (clearly labelled, not a purchase)
  perform coin_apply(me, 50, 'welcome', 'welcome:' || me::text);
  select balance into bal from wallets where user_id = me;
  return jsonb_build_object('balance', coalesce(bal, 0),
    'boosted_until', (select boosted_until from profiles where id = me),
    'free_boost_available', (select tier = 'vip' from profiles where id = me)
       and not exists (select 1 from coin_ledger where user_id = me and reason = 'boost_free' and created_at > now() - interval '7 days'),
    'history', coalesce((select jsonb_agg(jsonb_build_object('delta', delta, 'reason', reason, 'created_at', created_at) order by created_at desc)
       from (select * from coin_ledger where user_id = me order by created_at desc limit 30) h), '[]'));
end $$;

-- =====================================================================
-- GIFTS
-- =====================================================================
create table if not exists public.gift_catalog (
  id text primary key, name text not null, emoji text not null, price int not null check (price > 0),
  sort int not null default 0, active boolean not null default true
);
alter table public.gift_catalog enable row level security;
drop policy if exists gift_catalog_read on public.gift_catalog;
create policy gift_catalog_read on public.gift_catalog for select to authenticated using (active);
insert into public.gift_catalog (id, name, emoji, price, sort) values
  ('rose','Rose','🌹',10,1), ('coffee','Coffee','☕',20,2), ('heart','Heart','💖',50,3), ('teddy','Teddy bear','🧸',100,4),
  ('cake','Cake','🎂',150,5), ('crown','Crown','👑',300,6), ('diamond','Diamond','💎',500,7), ('rocket','Rocket','🚀',1000,8)
on conflict (id) do update set name = excluded.name, emoji = excluded.emoji, price = excluded.price, sort = excluded.sort;

create table if not exists public.gift_sends (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references public.profiles(id) on delete set null,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  gift_id text not null references public.gift_catalog(id),
  coins int not null,
  created_at timestamptz not null default now()
);
create index if not exists gift_sends_recipient_idx on public.gift_sends (recipient_id, created_at desc);
alter table public.gift_sends enable row level security;
drop policy if exists gift_sends_own on public.gift_sends;
create policy gift_sends_own on public.gift_sends for select to authenticated using (sender_id = auth.uid() or recipient_id = auth.uid());

create or replace function public.send_gift(p_number int, p_gift text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me profiles; o profiles; g gift_catalog; bal int; conv uuid; recent int;
begin
  select * into me from profiles where id = auth.uid();
  if me.id is null or me.status <> 'active' then raise exception 'not_allowed'; end if;
  select * into o from profiles where unknown_number = p_number and status = 'active';
  if o.id is null or o.id = me.id or is_blocked(o.id, me.id) then raise exception 'not_available'; end if;
  select * into g from gift_catalog where id = p_gift and active;
  if g.id is null then raise exception 'invalid_gift'; end if;
  select count(*) into recent from gift_sends where sender_id = me.id and created_at > now() - interval '1 minute';
  if recent >= 10 then raise exception 'rate_limited'; end if;
  bal := coin_apply(me.id, -g.price, 'gift_sent', null);
  insert into gift_sends (sender_id, recipient_id, gift_id, coins) values (me.id, o.id, g.id, g.price);
  -- show it in an existing chat between the two, if there is one
  select c.conversation_id into conv from connections c where c.user_id = me.id and c.other_id = o.id and c.conversation_id is not null limit 1;
  if conv is not null then
    insert into messages (conversation_id, sender_id, kind, body) values (conv, me.id, 'gift', g.emoji || ' ' || g.name);
  end if;
  insert into notifications (user_id, type, data) values (o.id, 'gift_received', jsonb_build_object('gift', g.id, 'emoji', g.emoji, 'name', g.name));
  return jsonb_build_object('balance', bal, 'conversation_id', conv);
end $$;

create or replace function public.get_received_gifts() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'total', (select count(*) from gift_sends where recipient_id = auth.uid()),
    'by_gift', coalesce((select jsonb_agg(jsonb_build_object('emoji', c.emoji, 'name', c.name, 'count', x.n) order by c.sort)
       from (select gift_id, count(*) n from gift_sends where recipient_id = auth.uid() group by gift_id) x join gift_catalog c on c.id = x.gift_id), '[]'));
$$;

-- =====================================================================
-- BOOSTS: 30 minutes at the top of Nearby / Discover
-- =====================================================================
alter table public.profiles add column if not exists boosted_until timestamptz;

create or replace function public.buy_boost(p_use_free boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me profiles; bal int; until timestamptz;
begin
  select * into me from profiles where id = auth.uid();
  if me.id is null or me.status <> 'active' then raise exception 'not_allowed'; end if;
  if me.boosted_until > now() then raise exception 'already_boosted'; end if;
  if p_use_free then
    if me.tier <> 'vip' then raise exception 'vip_required'; end if;
    if exists (select 1 from coin_ledger where user_id = me.id and reason = 'boost_free' and created_at > now() - interval '7 days') then raise exception 'free_boost_used'; end if;
    insert into coin_ledger (user_id, delta, reason) values (me.id, 0, 'boost_free');
    select balance into bal from wallets where user_id = me.id;
  else
    bal := coin_apply(me.id, -100, 'boost', null);
  end if;
  until := now() + interval '30 minutes';
  update profiles set boosted_until = until where id = me.id;
  return jsonb_build_object('boosted_until', until, 'balance', coalesce(bal, 0));
end $$;

-- =====================================================================
-- IDENTITY VERIFICATION (selfie with a requested gesture, reviewed by moderators)
-- =====================================================================
create table if not exists public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  selfie_path text not null,
  gesture text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  note text,
  reviewer_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index if not exists verification_pending_idx on public.verification_requests (status, created_at);
alter table public.verification_requests enable row level security;
drop policy if exists verification_own on public.verification_requests;
create policy verification_own on public.verification_requests for select to authenticated using (user_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('verifications', 'verifications', false, 5242880, array['image/jpeg','image/png','image/webp'])
  on conflict (id) do nothing;
drop policy if exists "verification upload own" on storage.objects;
create policy "verification upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'verifications' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "verification read own or admin" on storage.objects;
create policy "verification read own or admin" on storage.objects for select to authenticated
  using (bucket_id = 'verifications' and ((storage.foldername(name))[1] = auth.uid()::text
         or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)));

create or replace function public.submit_verification(p_path text, p_gesture text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me profiles; n int;
begin
  select * into me from profiles where id = auth.uid();
  if me.id is null or me.status <> 'active' then raise exception 'not_allowed'; end if;
  if me.is_verified then raise exception 'already_verified'; end if;
  if split_part(p_path, '/', 1) <> me.id::text then raise exception 'invalid_path'; end if;
  if p_gesture not in ('peace','thumbs_up','wave','ok','point_up') then raise exception 'invalid_gesture'; end if;
  if exists (select 1 from verification_requests where user_id = me.id and status = 'pending') then raise exception 'verification_pending'; end if;
  select count(*) into n from verification_requests where user_id = me.id and created_at > now() - interval '30 days';
  if n >= 3 then raise exception 'rate_limited'; end if;
  insert into verification_requests (user_id, selfie_path, gesture) values (me.id, p_path, p_gesture);
  return jsonb_build_object('status', 'pending');
end $$;

create or replace function public.get_my_verification() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('verified', p.is_verified,
    'request', (select jsonb_build_object('status', v.status, 'note', v.note, 'created_at', v.created_at)
                from verification_requests v where v.user_id = p.id order by v.created_at desc limit 1))
  from profiles p where p.id = auth.uid();
$$;

-- =====================================================================
-- ADMIN / MODERATION (profiles.is_admin, set by the owner in SQL)
-- =====================================================================
create or replace function public.require_admin() returns uuid
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from profiles where id = auth.uid() and is_admin) then raise exception 'not_allowed'; end if;
  return auth.uid();
end $$;
revoke execute on function public.require_admin() from public, anon;

create table if not exists public.moderation_log (
  id bigserial primary key, admin_id uuid references public.profiles(id) on delete set null,
  action text not null, target_user uuid, target_id uuid, note text, created_at timestamptz not null default now()
);
alter table public.moderation_log enable row level security;   -- no client policies

create or replace function public.admin_overview() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform require_admin();
  return jsonb_build_object(
    'members', (select count(*) from profiles),
    'active_24h', (select count(*) from profiles where last_active_at > now() - interval '24 hours'),
    'new_7d', (select count(*) from profiles where created_at > now() - interval '7 days'),
    'nearby_on', (select count(*) from nearby_locations where enabled and updated_at > now() - interval '14 days'),
    'open_reports', (select count(*) from reports where status in ('open','reviewing')),
    'pending_verifications', (select count(*) from verification_requests where status = 'pending'),
    'premium', (select count(*) from profiles where tier <> 'free'),
    'suspended', (select count(*) from profiles where status <> 'active'));
end $$;

create or replace function public.admin_reports(p_status text default 'open') returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform require_admin();
  return coalesce((select jsonb_agg(row order by created_at desc) from (
    select jsonb_build_object(
      'id', r.id, 'type', r.target_type, 'reason', r.reason, 'details', r.details, 'status', r.status, 'created_at', r.created_at,
      'reporter', (select unknown_number from profiles where id = r.reporter_id),
      'target_number', t.unknown_number, 'target_name', t.display_name, 'target_status', t.status,
      'target_reports', (select count(*) from reports x where x.target_user = r.target_user),
      'content', case r.target_type
         when 'post' then (select content from posts where id = r.target_id)
         when 'comment' then (select content from post_comments where id = r.target_id)
         when 'message' then (select body from messages where id = r.target_id) end) as row, r.created_at
    from reports r left join profiles t on t.id = r.target_user
    where (p_status = 'all' or r.status::text = p_status or (p_status = 'open' and r.status = 'reviewing'))
    order by r.created_at desc limit 100) q), '[]');
end $$;

create or replace function public.admin_resolve_report(p_report uuid, p_action text, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare a uuid := require_admin(); r reports;
begin
  select * into r from reports where id = p_report;
  if r.id is null then raise exception 'not_found'; end if;
  if p_action not in ('dismiss','remove_content','suspend_user','ban_user') then raise exception 'invalid_action'; end if;
  if p_action = 'remove_content' then
    if r.target_type = 'post' then update posts set status = 'removed' where id = r.target_id;
    elsif r.target_type = 'comment' then update post_comments set status = 'removed' where id = r.target_id;
    elsif r.target_type = 'message' then update messages set body = '[removed by moderators]', media_path = null where id = r.target_id;
    end if;
  elsif p_action in ('suspend_user','ban_user') and r.target_user is not null then
    update profiles set status = (case when p_action = 'ban_user' then 'banned' else 'suspended' end)::account_status
      where id = r.target_user and not is_admin;
    update nearby_locations set enabled = false where user_id = r.target_user;
  end if;
  update reports set status = (case when p_action = 'dismiss' then 'dismissed' else 'actioned' end)::report_status where id = p_report;
  insert into moderation_log (admin_id, action, target_user, target_id, note) values (a, p_action, r.target_user, r.id, p_note);
end $$;

create or replace function public.admin_set_user_status(p_number int, p_status text, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare a uuid := require_admin(); u uuid;
begin
  if p_status not in ('active','suspended','banned') then raise exception 'invalid_status'; end if;
  select id into u from profiles where unknown_number = p_number and not is_admin;
  if u is null then raise exception 'not_found'; end if;
  update profiles set status = p_status::account_status where id = u;
  if p_status <> 'active' then update nearby_locations set enabled = false where user_id = u; end if;
  insert into moderation_log (admin_id, action, target_user, note) values (a, 'status:' || p_status, u, p_note);
end $$;

create or replace function public.admin_verifications() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform require_admin();
  return coalesce((select jsonb_agg(jsonb_build_object('id', v.id, 'path', v.selfie_path, 'gesture', v.gesture, 'created_at', v.created_at,
      'number', p.unknown_number, 'name', p.display_name) order by v.created_at)
    from verification_requests v join profiles p on p.id = v.user_id where v.status = 'pending'), '[]');
end $$;

create or replace function public.admin_review_verification(p_id uuid, p_approve boolean, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare a uuid := require_admin(); v verification_requests;
begin
  select * into v from verification_requests where id = p_id and status = 'pending';
  if v.id is null then raise exception 'not_found'; end if;
  update verification_requests set status = case when p_approve then 'approved' else 'rejected' end,
    note = p_note, reviewer_id = a, reviewed_at = now() where id = p_id;
  if p_approve then update profiles set is_verified = true where id = v.user_id; end if;
  insert into notifications (user_id, type, data) values (v.user_id, 'verification', jsonb_build_object('approved', p_approve, 'note', p_note));
  insert into moderation_log (admin_id, action, target_user, target_id, note) values (a, case when p_approve then 'verify' else 'verify_reject' end, v.user_id, v.id, p_note);
end $$;

create or replace function public.admin_lookup_user(p_number int) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform require_admin();
  return (select jsonb_build_object('number', p.unknown_number, 'name', p.display_name, 'status', p.status, 'tier', p.tier,
      'verified', p.is_verified, 'created_at', p.created_at, 'last_active_at', p.last_active_at,
      'reports', (select count(*) from reports r where r.target_user = p.id),
      'posts', (select count(*) from posts x where x.author_id = p.id))
    from profiles p where p.unknown_number = p_number);
end $$;

-- =====================================================================
-- CHAT: video messages (25 MB) — gifts are only inserted by send_gift()
-- =====================================================================
update storage.buckets set file_size_limit = 26214400,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','audio/m4a','audio/mp4','audio/aac','video/mp4','video/quicktime','video/3gpp']
  where id = 'chat-media';
drop policy if exists messages_participant_insert on public.messages;
create policy messages_participant_insert on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and kind in ('text','image','voice','prompt','video') and public.is_participant(conversation_id, auth.uid()));

-- =====================================================================
-- DISCOVERY: boosted members first; country filter for everyone
-- =====================================================================
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

-- grants: client functions to authenticated only
revoke execute on function public.get_wallet(), public.send_gift(int, text), public.get_received_gifts(), public.buy_boost(boolean),
  public.submit_verification(text, text), public.get_my_verification(), public.admin_overview(), public.admin_reports(text),
  public.admin_resolve_report(uuid, text, text), public.admin_set_user_status(int, text, text), public.admin_verifications(),
  public.admin_review_verification(uuid, boolean, text), public.admin_lookup_user(int) from public, anon;
grant execute on function public.get_wallet(), public.send_gift(int, text), public.get_received_gifts(), public.buy_boost(boolean),
  public.submit_verification(text, text), public.get_my_verification(), public.admin_overview(), public.admin_reports(text),
  public.admin_resolve_report(uuid, text, text), public.admin_set_user_status(int, text, text), public.admin_verifications(),
  public.admin_review_verification(uuid, boolean, text), public.admin_lookup_user(int) to authenticated;

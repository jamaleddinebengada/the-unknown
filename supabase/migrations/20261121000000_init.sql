-- =====================================================================
-- THE UNKNOWN — initial schema
-- Access model: every user is an anonymous guest (Supabase anonymous sign-in, no email/password).
--   Enable it in Dashboard → Authentication → Sign In / Providers → "Allow anonymous sign-ins".
-- Principles:
--   * Every table has RLS enabled. Clients never read other people's rows
--     directly: cross-user reads go through SECURITY DEFINER functions that
--     return only public, anonymised fields (UNKNOWN #number, country, ...).
--   * Internal UUIDs of other users are never returned by public RPCs.
--   * Privileged columns (premium, status, counters) are not client-writable.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- enums ----------------------------------------------------
create type public.account_status as enum ('active', 'suspended', 'banned');
create type public.post_type as enum ('thought','question','secret','story','advice','debate','dream','challenge','travel','business');
create type public.post_audience as enum ('everyone','topic','my_country','countries');
create type public.content_status as enum ('visible','hidden','removed');
create type public.interest_status as enum ('pending','accepted','declined');
create type public.conversation_kind as enum ('direct','group');
create type public.message_kind as enum ('text','image','voice','system','prompt');
create type public.report_target as enum ('user','post','comment','message');
create type public.report_status as enum ('open','reviewing','actioned','dismissed');

-- ---------- helpers ---------------------------------------------------
create sequence public.unknown_number_seq start 10000 increment 1;

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

-- ---------- topics ----------------------------------------------------
create table public.topics (
  slug text primary key,
  name text not null,
  sort int not null default 0
);
insert into public.topics (slug, name, sort) values
 ('travel','Travel',1),('business','Business',2),('technology','Technology',3),('relationships','Relationships',4),
 ('life','Life',5),('psychology','Psychology',6),('adventure','Adventure',7),('music','Music',8),('movies','Movies',9),
 ('gaming','Gaming',10),('sports','Sports',11),('culture','Culture',12),('education','Education',13),('dreams','Dreams',14),
 ('philosophy','Philosophy',15),('mystery','Mystery',16);
alter table public.topics enable row level security;
create policy topics_read on public.topics for select to authenticated, anon using (true);

-- ---------- profiles --------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  unknown_number int not null unique default nextval('public.unknown_number_seq'),
  username text unique check (username ~ '^[a-zA-Z0-9_\.]{3,24}$'),
  birth_date date,
  country_code text check (country_code ~ '^[A-Z]{2}$'),
  gender text check (gender in ('woman','man','nonbinary','other')),
  languages text[] not null default '{}',
  interests text[] not null default '{}',
  conversation_prefs text[] not null default '{}',
  discover_topics text[] not null default '{}',
  personality_tags text[] not null default '{}',
  tagline text check (char_length(tagline) <= 80),
  avatar_seed text not null default encode(gen_random_bytes(6), 'hex'),
  show_age boolean not null default true,
  show_country boolean not null default true,
  show_online boolean not null default true,
  who_can_message text not null default 'approved' check (who_can_message in ('approved','nobody')),
  onboarding_complete boolean not null default true,   -- guests enter instantly; nothing is required
  -- privileged (not client-writable)
  is_premium boolean not null default false,
  status public.account_status not null default 'active',
  is_admin boolean not null default false,
  last_active_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create or replace function public.profiles_validate() returns trigger language plpgsql as $$
begin
  if new.birth_date is not null and new.birth_date > (current_date - interval '18 years') then
    raise exception 'must_be_18';
  end if;
  return new;
end $$;
create trigger profiles_validate before insert or update of birth_date on public.profiles for each row execute function public.profiles_validate();
create index profiles_interests_gin on public.profiles using gin (interests);
create index profiles_languages_gin on public.profiles using gin (languages);

-- Private identity: only revealed through mutual consent.
create table public.profile_private (
  id uuid primary key references public.profiles(id) on delete cascade,
  display_name text check (char_length(display_name) <= 60),
  photo_path text,
  social_handle text check (char_length(social_handle) <= 80),
  about text check (char_length(about) <= 300),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.profile_private enable row level security;

create policy profiles_self_read on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_self_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy private_self_all on public.profile_private for all to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- column-level protection of privileged fields
revoke update on public.profiles from authenticated, anon;
grant update (username, birth_date, country_code, gender, languages, interests, conversation_prefs, discover_topics,
  personality_tags, tagline, show_age, show_country, show_online, who_can_message, onboarding_complete, last_active_at)
  on public.profiles to authenticated;
revoke insert, delete on public.profiles from authenticated, anon;

-- create profile on signup
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  insert into public.profile_private (id) values (new.id) on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ---------- blocks ----------------------------------------------------
create table public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.blocks enable row level security;
create policy blocks_own_read on public.blocks for select to authenticated using (blocker_id = auth.uid());
create policy blocks_own_delete on public.blocks for delete to authenticated using (blocker_id = auth.uid());
-- inserts go through block_user() so the client never needs the other user's uuid

create or replace function public.is_blocked(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from blocks where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a));
$$;

create or replace function public.is_active_user(u uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = u and status = 'active');
$$;

create or replace function public.age_of(d date) returns int language sql stable as $$
  select case when d is null then null else extract(year from age(current_date, d))::int end;
$$;

create or replace function public.age_range(d date) returns text language sql stable as $$
  select case when d is null then null
    when age_of(d) < 22 then '18–21' when age_of(d) < 26 then '22–25' when age_of(d) < 31 then '26–30'
    when age_of(d) < 36 then '31–35' when age_of(d) < 46 then '36–45' else '46+' end;
$$;

-- ---------- posts -----------------------------------------------------
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  type public.post_type not null default 'thought',
  category text references public.topics(slug),
  content text not null check (char_length(content) between 1 and 2000),
  image_path text,
  voice_path text,
  audience public.post_audience not null default 'everyone',
  audience_countries text[] not null default '{}',
  author_country text,           -- snapshot used for "My country" audience
  language text,
  like_count int not null default 0,
  comment_count int not null default 0,
  interested_count int not null default 0,
  status public.content_status not null default 'visible',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index posts_created_idx on public.posts (created_at desc) where status = 'visible';
create index posts_author_idx on public.posts (author_id, created_at desc);
create index posts_category_idx on public.posts (category, created_at desc);
create index posts_type_idx on public.posts (type, created_at desc);
create trigger posts_touch before update on public.posts for each row execute function public.touch_updated_at();

alter table public.posts enable row level security;
create policy posts_own_read on public.posts for select to authenticated using (author_id = auth.uid());
create policy posts_own_insert on public.posts for insert to authenticated with check (author_id = auth.uid() and public.is_active_user(auth.uid()));
create policy posts_own_update on public.posts for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy posts_own_delete on public.posts for delete to authenticated using (author_id = auth.uid());
revoke update on public.posts from authenticated;
grant update (content, category, image_path, voice_path, audience, audience_countries) on public.posts to authenticated;

-- rate limiting + snapshot of author country
create or replace function public.posts_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare recent int;
begin
  select count(*) into recent from posts where author_id = new.author_id and created_at > now() - interval '24 hours';
  if recent >= 25 then raise exception 'rate_limited: daily post limit reached'; end if;
  select country_code into new.author_country from profiles where id = new.author_id;
  new.like_count := 0; new.comment_count := 0; new.interested_count := 0; new.status := 'visible';
  return new;
end $$;
create trigger posts_bi before insert on public.posts for each row execute function public.posts_before_insert();

-- can the current user see this post?
create or replace function public.can_view_post(p public.posts, viewer uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p.status = 'visible'
    and is_active_user(p.author_id)
    and not is_blocked(p.author_id, viewer)
    and (
      p.author_id = viewer
      or p.audience in ('everyone','topic')
      or (p.audience = 'my_country' and p.author_country = (select country_code from profiles where id = viewer))
      or (p.audience = 'countries' and (select country_code from profiles where id = viewer) = any(p.audience_countries))
    );
$$;

create or replace function public.can_view_post_id(p_post uuid, viewer uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select can_view_post(p, viewer) from posts p where p.id = p_post), false);
$$;

-- ---------- likes -----------------------------------------------------
create table public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.post_likes enable row level security;
create policy likes_own_read on public.post_likes for select to authenticated using (user_id = auth.uid());
create policy likes_own_insert on public.post_likes for insert to authenticated
  with check (user_id = auth.uid() and public.can_view_post_id(post_id, auth.uid()));
create policy likes_own_delete on public.post_likes for delete to authenticated using (user_id = auth.uid());

-- ---------- comments --------------------------------------------------
create table public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 800),
  status public.content_status not null default 'visible',
  created_at timestamptz not null default now()
);
create index comments_post_idx on public.post_comments (post_id, created_at);
alter table public.post_comments enable row level security;
create policy comments_own_read on public.post_comments for select to authenticated using (author_id = auth.uid());
create policy comments_own_insert on public.post_comments for insert to authenticated
  with check (author_id = auth.uid() and public.is_active_user(auth.uid())
    and public.can_view_post_id(post_id, auth.uid()));
create policy comments_delete on public.post_comments for delete to authenticated
  using (author_id = auth.uid() or exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()));

create or replace function public.comments_rate_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from post_comments where author_id = new.author_id and created_at > now() - interval '10 minutes') >= 30 then
    raise exception 'rate_limited: slow down';
  end if;
  new.status := 'visible';
  return new;
end $$;
create trigger comments_bi before insert on public.post_comments for each row execute function public.comments_rate_limit();

-- ---------- interested users ------------------------------------------
create table public.post_interests (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  intro text check (char_length(intro) <= 280),
  status public.interest_status not null default 'pending',
  conversation_id uuid,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (post_id, user_id)
);
create index interests_post_idx on public.post_interests (post_id, status);
alter table public.post_interests enable row level security;
create policy interests_own_read on public.post_interests for select to authenticated using (user_id = auth.uid());
create policy interests_own_delete on public.post_interests for delete to authenticated using (user_id = auth.uid() and status = 'pending');
-- inserts / updates go through express_interest() and respond_interest()

-- ---------- conversations ---------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  kind public.conversation_kind not null default 'direct',
  post_id uuid references public.posts(id) on delete set null,
  match_id uuid,
  stage smallint not null default 1 check (stage between 1 and 5),
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  ended_at timestamptz
);
create table public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  joined_at timestamptz not null default now(),
  last_read_at timestamptz not null default now(),
  archived boolean not null default false,
  reveal_consent boolean not null default false,
  reveal_fields text[] not null default '{}',
  primary key (conversation_id, user_id)
);
create index participants_user_idx on public.conversation_participants (user_id);

create or replace function public.is_participant(c uuid, u uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from conversation_participants where conversation_id = c and user_id = u);
$$;

alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
create policy conv_participant_read on public.conversations for select to authenticated using (public.is_participant(id, auth.uid()));
create policy parts_participant_read on public.conversation_participants for select to authenticated using (public.is_participant(conversation_id, auth.uid()));
create policy parts_self_update on public.conversation_participants for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke update on public.conversation_participants from authenticated;
grant update (last_read_at, archived) on public.conversation_participants to authenticated;

-- ---------- messages --------------------------------------------------
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null,
  kind public.message_kind not null default 'text',
  body text check (char_length(body) <= 4000),
  media_path text,
  reply_to uuid references public.messages(id) on delete set null,
  created_at timestamptz not null default now()
);
create index messages_conv_idx on public.messages (conversation_id, created_at desc);
alter table public.messages enable row level security;
create policy messages_participant_read on public.messages for select to authenticated using (public.is_participant(conversation_id, auth.uid()));
create policy messages_participant_insert on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and kind in ('text','image','voice','prompt') and public.is_participant(conversation_id, auth.uid()));

create or replace function public.messages_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare c conversations; other uuid;
begin
  select * into c from conversations where id = new.conversation_id;
  if c.ended_at is not null then raise exception 'conversation_ended'; end if;
  if new.sender_id is not null then
    if not is_active_user(new.sender_id) then raise exception 'account_restricted'; end if;
    -- blocked in a direct conversation => cannot send
    if c.kind = 'direct' then
      select user_id into other from conversation_participants where conversation_id = c.id and user_id <> new.sender_id limit 1;
      if other is not null and is_blocked(new.sender_id, other) then raise exception 'blocked'; end if;
    end if;
    if (select count(*) from messages where sender_id = new.sender_id and created_at > now() - interval '1 minute') >= 40 then
      raise exception 'rate_limited: slow down';
    end if;
  end if;
  return new;
end $$;
create trigger messages_bi before insert on public.messages for each row execute function public.messages_before_insert();

create or replace function public.messages_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update conversations set last_message_at = new.created_at,
    stage = case when stage < 2 and (select count(*) from messages where conversation_id = new.conversation_id) >= 10 then 2
                 when stage < 3 and new.kind = 'voice' then 3 else stage end
  where id = new.conversation_id;
  update conversation_participants set last_read_at = new.created_at
  where conversation_id = new.conversation_id and user_id = new.sender_id;
  insert into notifications (user_id, type, data)
    select p.user_id, 'message', jsonb_build_object('conversation_id', new.conversation_id)
    from conversation_participants p
    where p.conversation_id = new.conversation_id and p.user_id <> coalesce(new.sender_id, '00000000-0000-0000-0000-000000000000')
      and not exists (select 1 from notifications n where n.user_id = p.user_id and n.type = 'message'
        and n.read_at is null and n.data->>'conversation_id' = new.conversation_id::text);
  return new;
end $$;

-- ---------- matches ---------------------------------------------------
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles(id) on delete cascade,  -- requester
  user_b uuid not null references public.profiles(id) on delete cascade,
  mode text not null default 'random',
  compatibility int not null default 50,
  shared_interests text[] not null default '{}',
  a_accepted boolean,
  b_accepted boolean,
  conversation_id uuid references public.conversations(id) on delete set null,
  match_date date not null default current_date,
  created_at timestamptz not null default now(),
  check (user_a <> user_b)
);
create index matches_a_idx on public.matches (user_a, match_date);
create index matches_b_idx on public.matches (user_b, match_date);
alter table public.matches enable row level security;
-- no direct client access; see get_daily_match() / respond_match()

-- ---------- connections -----------------------------------------------
create table public.connections (
  user_id uuid not null references public.profiles(id) on delete cascade,
  other_id uuid not null references public.profiles(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  source text not null default 'conversation',
  saved boolean not null default false,
  revealed boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (user_id, other_id)
);
alter table public.connections enable row level security;
create policy connections_own_read on public.connections for select to authenticated using (user_id = auth.uid());
create policy connections_own_delete on public.connections for delete to authenticated using (user_id = auth.uid());

-- ---------- notifications ---------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  data jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
create policy notif_own_read on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notif_own_update on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notif_own_delete on public.notifications for delete to authenticated using (user_id = auth.uid());
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

create trigger messages_ai after insert on public.messages for each row execute function public.messages_after_insert();

-- ---------- push tokens -----------------------------------------------
create table public.push_tokens (
  token text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  platform text,
  updated_at timestamptz not null default now()
);
alter table public.push_tokens enable row level security;
create policy push_own_all on public.push_tokens for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- reports ---------------------------------------------------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type public.report_target not null,
  target_user uuid references public.profiles(id) on delete set null,
  target_id uuid,
  reason text not null,
  details text check (char_length(details) <= 1000),
  status public.report_status not null default 'open',
  created_at timestamptz not null default now()
);
alter table public.reports enable row level security;
create policy reports_own_read on public.reports for select to authenticated using (reporter_id = auth.uid());
-- inserts via report_content()

-- ---------- subscriptions (written only by the RevenueCat webhook / service role) ----
create table public.subscriptions (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  product_id text,
  status text not null default 'inactive',
  provider text not null default 'revenuecat',
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
create policy subs_own_read on public.subscriptions for select to authenticated using (user_id = auth.uid());

-- =====================================================================
-- Counter + notification triggers
-- =====================================================================
create or replace function public.likes_counter() returns trigger
language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  if tg_op = 'INSERT' then
    update posts set like_count = like_count + 1 where id = new.post_id returning author_id into owner;
    if owner <> new.user_id then
      insert into notifications (user_id, type, data) values (owner, 'like', jsonb_build_object('post_id', new.post_id));
    end if;
    return new;
  else
    update posts set like_count = greatest(like_count - 1, 0) where id = old.post_id;
    return old;
  end if;
end $$;
create trigger likes_count after insert or delete on public.post_likes for each row execute function public.likes_counter();

create or replace function public.comments_counter() returns trigger
language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  if tg_op = 'INSERT' then
    update posts set comment_count = comment_count + 1 where id = new.post_id returning author_id into owner;
    if owner <> new.author_id then
      insert into notifications (user_id, type, data) values (owner, 'comment', jsonb_build_object('post_id', new.post_id));
    end if;
    return new;
  else
    update posts set comment_count = greatest(comment_count - 1, 0) where id = old.post_id;
    return old;
  end if;
end $$;
create trigger comments_count after insert or delete on public.post_comments for each row execute function public.comments_counter();

-- =====================================================================
-- Public read API (SECURITY DEFINER, anonymised output)
-- =====================================================================
create or replace function public.post_row(p public.posts, viewer uuid)
returns table (
  id uuid, type public.post_type, category text, content text, image_path text, voice_path text, audience public.post_audience,
  created_at timestamptz, like_count int, comment_count int, interested_count int,
  author_number int, author_country text, author_age int, author_avatar_seed text,
  is_mine boolean, liked_by_me boolean, my_interest public.interest_status
) language sql stable security definer set search_path = public as $$
  select p.id, p.type, p.category, p.content, p.image_path, p.voice_path, p.audience, p.created_at,
    p.like_count, p.comment_count, p.interested_count,
    a.unknown_number, case when a.show_country then a.country_code end, case when a.show_age then age_of(a.birth_date) end,
    a.avatar_seed, p.author_id = viewer,
    exists (select 1 from post_likes l where l.post_id = p.id and l.user_id = viewer),
    (select i.status from post_interests i where i.post_id = p.id and i.user_id = viewer)
  from profiles a where a.id = p.author_id;
$$;
revoke execute on function public.post_row(public.posts, uuid) from public, anon, authenticated;

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
      + (('x' || substr(md5(p.id::text || me.id::text || current_date::text), 1, 6))::bit(24)::int / 16777215.0) as score
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

create or replace function public.get_post(p_post uuid)
returns table (
  id uuid, type public.post_type, category text, content text, image_path text, voice_path text, audience public.post_audience,
  created_at timestamptz, like_count int, comment_count int, interested_count int,
  author_number int, author_country text, author_age int, author_avatar_seed text,
  is_mine boolean, liked_by_me boolean, my_interest public.interest_status
) language sql stable security definer set search_path = public as $$
  select r.* from posts p cross join lateral post_row(p, auth.uid()) r
  where p.id = p_post and can_view_post(p, auth.uid());
$$;

create or replace function public.get_user_posts(p_number int, p_offset int default 0, p_limit int default 20)
returns table (
  id uuid, type public.post_type, category text, content text, image_path text, voice_path text, audience public.post_audience,
  created_at timestamptz, like_count int, comment_count int, interested_count int,
  author_number int, author_country text, author_age int, author_avatar_seed text,
  is_mine boolean, liked_by_me boolean, my_interest public.interest_status
) language sql stable security definer set search_path = public as $$
  select r.* from posts p join profiles a on a.id = p.author_id
  cross join lateral post_row(p, auth.uid()) r
  where a.unknown_number = p_number and can_view_post(p, auth.uid())
  order by p.created_at desc offset greatest(p_offset,0) limit least(greatest(p_limit,1),50);
$$;

create or replace function public.search_posts(p_query text, p_offset int default 0, p_limit int default 20)
returns table (
  id uuid, type public.post_type, category text, content text, image_path text, voice_path text, audience public.post_audience,
  created_at timestamptz, like_count int, comment_count int, interested_count int,
  author_number int, author_country text, author_age int, author_avatar_seed text,
  is_mine boolean, liked_by_me boolean, my_interest public.interest_status
) language sql stable security definer set search_path = public as $$
  select r.* from posts p cross join lateral post_row(p, auth.uid()) r
  where char_length(trim(p_query)) >= 2 and can_view_post(p, auth.uid())
    and (p.content ilike '%' || replace(replace(trim(p_query), '%', ''), '_', '') || '%' or p.category = lower(trim(p_query)))
  order by p.created_at desc offset greatest(p_offset,0) limit least(greatest(p_limit,1),50);
$$;

create or replace function public.get_comments(p_post uuid)
returns table (id uuid, content text, created_at timestamptz, author_number int, author_country text, author_avatar_seed text, is_mine boolean, can_delete boolean)
language sql stable security definer set search_path = public as $$
  select c.id, c.content, c.created_at, a.unknown_number, case when a.show_country then a.country_code end, a.avatar_seed,
    c.author_id = auth.uid(), c.author_id = auth.uid() or p.author_id = auth.uid()
  from post_comments c join posts p on p.id = c.post_id join profiles a on a.id = c.author_id
  where c.post_id = p_post and c.status = 'visible' and can_view_post(p, auth.uid())
    and not is_blocked(c.author_id, auth.uid()) and a.status = 'active'
  order by c.created_at asc limit 300;
$$;

create or replace function public.get_public_profile(p_number int)
returns table (unknown_number int, country_code text, age_range text, languages text[], interests text[], personality_tags text[],
  tagline text, avatar_seed text, post_count bigint, member_since timestamptz, is_me boolean)
language sql stable security definer set search_path = public as $$
  select a.unknown_number, case when a.show_country then a.country_code end, case when a.show_age then age_range(a.birth_date) end,
    a.languages, a.interests, a.personality_tags, a.tagline, a.avatar_seed,
    (select count(*) from posts p where p.author_id = a.id and p.status = 'visible'), a.created_at, a.id = auth.uid()
  from profiles a where a.unknown_number = p_number and a.status = 'active' and not is_blocked(a.id, auth.uid());
$$;

-- =====================================================================
-- Actions
-- =====================================================================
create or replace function public.express_interest(p_post uuid, p_intro text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare p posts; new_id uuid;
begin
  if auth.uid() is null or not is_active_user(auth.uid()) then raise exception 'not_allowed'; end if;
  select * into p from posts where id = p_post;
  if p.id is null or not can_view_post(p, auth.uid()) then raise exception 'post_not_found'; end if;
  if p.author_id = auth.uid() then raise exception 'own_post'; end if;
  if (select count(*) from post_interests where user_id = auth.uid() and created_at > now() - interval '24 hours') >= 40 then
    raise exception 'rate_limited: daily interest limit reached';
  end if;
  insert into post_interests (post_id, user_id, intro) values (p_post, auth.uid(), nullif(trim(p_intro), ''))
    on conflict (post_id, user_id) do nothing returning id into new_id;
  if new_id is not null then
    update posts set interested_count = interested_count + 1 where id = p_post;
    insert into notifications (user_id, type, data) values (p.author_id, 'interested', jsonb_build_object('post_id', p_post));
  end if;
  return new_id;
end $$;

create or replace function public.withdraw_interest(p_post uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  with d as (delete from post_interests where post_id = p_post and user_id = auth.uid() and status = 'pending' returning 1)
  update posts set interested_count = greatest(interested_count - (select count(*) from d), 0) where id = p_post;
end $$;

create or replace function public.get_post_interests(p_post uuid)
returns table (interest_id uuid, intro text, status public.interest_status, created_at timestamptz, conversation_id uuid,
  unknown_number int, country_code text, age_range text, interests text[], tagline text, avatar_seed text, shared_interests int)
language sql stable security definer set search_path = public as $$
  select i.id, i.intro, i.status, i.created_at, i.conversation_id, a.unknown_number,
    case when a.show_country then a.country_code end, case when a.show_age then age_range(a.birth_date) end,
    a.interests, a.tagline, a.avatar_seed,
    (select count(*)::int from unnest(a.interests) x where x = any(coalesce((select pr.interests from profiles pr where pr.id = auth.uid()), '{}'::text[])))
  from post_interests i join posts p on p.id = i.post_id join profiles a on a.id = i.user_id
  where i.post_id = p_post and p.author_id = auth.uid() and a.status = 'active' and not is_blocked(a.id, auth.uid())
  order by (i.status = 'pending') desc, i.created_at desc;
$$;


create or replace function public.get_my_pending_interests()
returns table (post_id uuid, snippet text, pending int, latest timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, left(p.content, 90), count(*)::int, max(i.created_at)
  from posts p join post_interests i on i.post_id = p.id and i.status = 'pending'
  join profiles a on a.id = i.user_id and a.status = 'active'
  where p.author_id = auth.uid() and not is_blocked(i.user_id, auth.uid())
  group by p.id order by max(i.created_at) desc;
$$;

create or replace function public.create_connection_pair(a uuid, b uuid, conv uuid, src text) returns void
language sql security definer set search_path = public as $$
  insert into connections (user_id, other_id, conversation_id, source) values (a, b, conv, src), (b, a, conv, src)
  on conflict (user_id, other_id) do update set conversation_id = excluded.conversation_id;
$$;
revoke execute on function public.create_connection_pair(uuid, uuid, uuid, text) from public, anon, authenticated;

-- Owner accepts/declines. p_group = true adds the person to the post's group conversation.
create or replace function public.respond_interest(p_interest uuid, p_accept boolean, p_group boolean default false) returns uuid
language plpgsql security definer set search_path = public as $$
declare i post_interests; p posts; conv uuid;
begin
  select * into i from post_interests where id = p_interest for update;
  if i.id is null then raise exception 'not_found'; end if;
  select * into p from posts where id = i.post_id;
  if p.author_id <> auth.uid() then raise exception 'not_allowed'; end if;
  if i.status <> 'pending' then return i.conversation_id; end if;
  if not p_accept then
    update post_interests set status = 'declined', responded_at = now() where id = i.id;
    return null;
  end if;
  if is_blocked(p.author_id, i.user_id) then raise exception 'blocked'; end if;

  if p_group then
    select id into conv from conversations where post_id = p.id and kind = 'group' and ended_at is null limit 1;
    if conv is null then
      insert into conversations (kind, post_id) values ('group', p.id) returning id into conv;
      insert into conversation_participants (conversation_id, user_id, role) values (conv, p.author_id, 'owner');
    end if;
    insert into conversation_participants (conversation_id, user_id) values (conv, i.user_id) on conflict do nothing;
  else
    insert into conversations (kind, post_id) values ('direct', p.id) returning id into conv;
    insert into conversation_participants (conversation_id, user_id, role) values (conv, p.author_id, 'owner'), (conv, i.user_id, 'member');
    perform create_connection_pair(p.author_id, i.user_id, conv, 'post');
  end if;
  insert into messages (conversation_id, sender_id, kind, body)
    values (conv, null, 'system', 'You connected through a post: “' || left(p.content, 120) || '”');
  update post_interests set status = 'accepted', responded_at = now(), conversation_id = conv where id = i.id;
  insert into notifications (user_id, type, data) values (i.user_id, 'interest_accepted', jsonb_build_object('conversation_id', conv, 'post_id', p.id));
  return conv;
end $$;

create or replace function public.block_user(p_number int) returns void
language plpgsql security definer set search_path = public as $$
declare target uuid;
begin
  select id into target from profiles where unknown_number = p_number;
  if target is null or target = auth.uid() then raise exception 'not_found'; end if;
  insert into blocks (blocker_id, blocked_id) values (auth.uid(), target) on conflict do nothing;
  delete from connections where (user_id = auth.uid() and other_id = target) or (user_id = target and other_id = auth.uid());
  update conversations c set ended_at = now() where c.kind = 'direct' and c.ended_at is null
    and is_participant(c.id, auth.uid()) and is_participant(c.id, target);
end $$;

create or replace function public.get_blocked_users()
returns table (unknown_number int, avatar_seed text, blocked_at timestamptz)
language sql stable security definer set search_path = public as $$
  select a.unknown_number, a.avatar_seed, b.created_at from blocks b join profiles a on a.id = b.blocked_id
  where b.blocker_id = auth.uid() order by b.created_at desc;
$$;

create or replace function public.unblock_user(p_number int) returns void
language sql security definer set search_path = public as $$
  delete from blocks where blocker_id = auth.uid() and blocked_id = (select id from profiles where unknown_number = p_number);
$$;

-- target: user (p_number), post/comment/message (p_target_id)
create or replace function public.report_content(p_type public.report_target, p_reason text, p_details text default null,
  p_number int default null, p_target_id uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare target_user uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if (select count(*) from reports where reporter_id = auth.uid() and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'rate_limited';
  end if;
  if p_type = 'user' then select id into target_user from profiles where unknown_number = p_number;
  elsif p_type = 'post' then select author_id into target_user from posts where id = p_target_id;
  elsif p_type = 'comment' then select author_id into target_user from post_comments where id = p_target_id;
  elsif p_type = 'message' then
    select sender_id into target_user from messages m where m.id = p_target_id and is_participant(m.conversation_id, auth.uid());
  end if;
  if target_user is null then raise exception 'not_found'; end if;
  insert into reports (reporter_id, target_type, target_user, target_id, reason, details)
  values (auth.uid(), p_type, target_user, p_target_id, p_reason, p_details);
  -- auto-hide content that receives many independent reports pending human review
  if p_type = 'post' and (select count(distinct reporter_id) from reports where target_id = p_target_id and status = 'open') >= 5 then
    update posts set status = 'hidden' where id = p_target_id;
  end if;
end $$;

-- ---------- conversations read API -----------------------------------
create or replace function public.get_my_conversations()
returns table (conversation_id uuid, kind public.conversation_kind, stage smallint, last_message_at timestamptz, ended boolean, archived boolean,
  other_number int, other_country text, other_avatar_seed text, other_online boolean, member_count int,
  last_body text, last_kind public.message_kind, last_is_mine boolean, unread int, post_snippet text, revealed boolean)
language sql stable security definer set search_path = public as $$
  select c.id, c.kind, c.stage, c.last_message_at, c.ended_at is not null, me.archived,
    o.unknown_number, case when o.show_country then o.country_code end, o.avatar_seed,
    (o.show_online and o.last_active_at > now() - interval '3 minutes'),
    (select count(*)::int from conversation_participants x where x.conversation_id = c.id),
    lm.body, lm.kind, lm.sender_id = auth.uid(),
    (select count(*)::int from messages m where m.conversation_id = c.id and m.created_at > me.last_read_at and m.sender_id is distinct from auth.uid()),
    (select left(p.content, 80) from posts p where p.id = c.post_id),
    c.stage >= 4
  from conversation_participants me
  join conversations c on c.id = me.conversation_id
  left join lateral (select x.user_id from conversation_participants x where x.conversation_id = c.id and x.user_id <> auth.uid() order by x.joined_at limit 1) ot on true
  left join profiles o on o.id = ot.user_id
  left join lateral (select m.body, m.kind, m.sender_id from messages m where m.conversation_id = c.id order by m.created_at desc limit 1) lm on true
  where me.user_id = auth.uid()
  order by c.last_message_at desc;
$$;

create or replace function public.get_conversation(p_conv uuid)
returns table (conversation_id uuid, kind public.conversation_kind, stage smallint, ended boolean, created_at timestamptz,
  other_number int, other_country text, other_avatar_seed text, other_interests text[], my_reveal_consent boolean,
  other_reveal_consent boolean, message_count int, post_snippet text)
language sql stable security definer set search_path = public as $$
  select c.id, c.kind, c.stage, c.ended_at is not null, c.created_at,
    o.unknown_number, case when o.show_country then o.country_code end, o.avatar_seed, o.interests,
    me.reveal_consent, op.reveal_consent,
    (select count(*)::int from messages m where m.conversation_id = c.id and m.kind <> 'system'),
    (select left(p.content, 120) from posts p where p.id = c.post_id)
  from conversations c
  join conversation_participants me on me.conversation_id = c.id and me.user_id = auth.uid()
  left join lateral (select x.* from conversation_participants x where x.conversation_id = c.id and x.user_id <> auth.uid() order by x.joined_at limit 1) op on true
  left join profiles o on o.id = op.user_id
  where c.id = p_conv;
$$;

-- messages are returned without raw sender uuids; group members are labelled by their UNKNOWN number
create or replace function public.get_messages(p_conv uuid, p_before timestamptz default null, p_limit int default 50)
returns table (id uuid, kind public.message_kind, body text, media_path text, reply_to uuid, created_at timestamptz,
  is_mine boolean, sender_number int, sender_avatar_seed text)
language sql stable security definer set search_path = public as $$
  select m.id, m.kind, m.body, m.media_path, m.reply_to, m.created_at, m.sender_id = auth.uid(), a.unknown_number, a.avatar_seed
  from messages m left join profiles a on a.id = m.sender_id
  where m.conversation_id = p_conv and is_participant(p_conv, auth.uid())
    and (p_before is null or m.created_at < p_before)
  order by m.created_at desc limit least(greatest(p_limit,1),100);
$$;

create or replace function public.end_conversation(p_conv uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_participant(p_conv, auth.uid()) then raise exception 'not_allowed'; end if;
  insert into messages (conversation_id, sender_id, kind, body) values (p_conv, null, 'system', 'This conversation has ended.');
  update conversations set ended_at = now() where id = p_conv and ended_at is null;
end $$;

-- ---------- reveal (mutual consent) -----------------------------------
create or replace function public.set_reveal_consent(p_conv uuid, p_consent boolean, p_fields text[] default '{display_name,photo}')
returns smallint language plpgsql security definer set search_path = public as $$
declare all_in boolean; st smallint; other uuid;
begin
  if not is_participant(p_conv, auth.uid()) then raise exception 'not_allowed'; end if;
  if (select kind from conversations where id = p_conv) <> 'direct' then raise exception 'direct_only'; end if;
  update conversation_participants set reveal_consent = p_consent,
    reveal_fields = (select coalesce(array_agg(f), '{}') from unnest(p_fields) f where f in ('display_name','photo','social','about'))
  where conversation_id = p_conv and user_id = auth.uid();
  select bool_and(reveal_consent) into all_in from conversation_participants where conversation_id = p_conv;
  select user_id into other from conversation_participants where conversation_id = p_conv and user_id <> auth.uid() limit 1;
  if all_in then
    update conversations set stage = greatest(stage, 4) where id = p_conv returning stage into st;
    update connections set revealed = true where conversation_id = p_conv;
    insert into notifications (user_id, type, data) values (other, 'revealed', jsonb_build_object('conversation_id', p_conv));
  elsif p_consent then
    insert into notifications (user_id, type, data) values (other, 'reveal_request', jsonb_build_object('conversation_id', p_conv));
  end if;
  return coalesce(st, (select stage from conversations where id = p_conv));
end $$;

create or replace function public.get_revealed_identity(p_conv uuid)
returns table (display_name text, photo_path text, social_handle text, about text)
language sql stable security definer set search_path = public as $$
  select case when 'display_name' = any(op.reveal_fields) then pp.display_name end,
         case when 'photo' = any(op.reveal_fields) then pp.photo_path end,
         case when 'social' = any(op.reveal_fields) then pp.social_handle end,
         case when 'about' = any(op.reveal_fields) then pp.about end
  from conversation_participants me
  join conversation_participants op on op.conversation_id = me.conversation_id and op.user_id <> me.user_id
  join profile_private pp on pp.id = op.user_id
  where me.conversation_id = p_conv and me.user_id = auth.uid() and me.reveal_consent and op.reveal_consent;
$$;

-- ---------- Mystery Match ---------------------------------------------
create or replace function public.match_row(m public.matches)
returns table (match_id uuid, mode text, compatibility int, shared_interests text[], i_accepted boolean, they_accepted boolean,
  conversation_id uuid, other_number int, other_country text, other_age int, other_avatar_seed text, other_tagline text,
  other_tags text[], other_languages text[], is_incoming boolean)
language sql stable security definer set search_path = public as $$
  select m.id, m.mode, m.compatibility, m.shared_interests,
    case when m.user_a = auth.uid() then m.a_accepted else m.b_accepted end,
    case when m.user_a = auth.uid() then m.b_accepted else m.a_accepted end,
    m.conversation_id, o.unknown_number, case when o.show_country then o.country_code end,
    case when o.show_age then age_of(o.birth_date) end, o.avatar_seed, o.tagline, o.personality_tags, o.languages,
    m.user_b = auth.uid()
  from profiles o where o.id = case when m.user_a = auth.uid() then m.user_b else m.user_a end;
$$;
revoke execute on function public.match_row(public.matches) from public, anon, authenticated;

create or replace function public.get_my_matches()
returns table (match_id uuid, mode text, compatibility int, shared_interests text[], i_accepted boolean, they_accepted boolean,
  conversation_id uuid, other_number int, other_country text, other_age int, other_avatar_seed text, other_tagline text,
  other_tags text[], other_languages text[], is_incoming boolean)
language sql stable security definer set search_path = public as $$
  select r.* from matches m cross join lateral match_row(m) r
  where (m.user_a = auth.uid() or m.user_b = auth.uid()) and m.match_date > current_date - 7
    and not is_blocked(m.user_a, m.user_b)
  order by m.created_at desc limit 30;
$$;

create or replace function public.find_mystery_match(p_mode text default 'random')
returns table (match_id uuid, mode text, compatibility int, shared_interests text[], i_accepted boolean, they_accepted boolean,
  conversation_id uuid, other_number int, other_country text, other_age int, other_avatar_seed text, other_tagline text,
  other_tags text[], other_languages text[], is_incoming boolean)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare me profiles; today_count int; daily_limit int; cand record; new_match matches;
begin
  select * into me from profiles where id = auth.uid();
  if me.id is null or me.status <> 'active' then raise exception 'not_allowed'; end if;
  daily_limit := case when me.is_premium then 10 else 1 end;
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

create or replace function public.respond_match(p_match uuid, p_accept boolean) returns uuid
language plpgsql security definer set search_path = public as $$
declare m matches; conv uuid;
begin
  select * into m from matches where id = p_match for update;
  if m.id is null or (m.user_a <> auth.uid() and m.user_b <> auth.uid()) then raise exception 'not_found'; end if;
  if m.conversation_id is not null then return m.conversation_id; end if;
  if m.user_a = auth.uid() then update matches set a_accepted = p_accept where id = m.id returning * into m;
  else update matches set b_accepted = p_accept where id = m.id returning * into m; end if;
  if m.a_accepted and m.b_accepted and not is_blocked(m.user_a, m.user_b) then
    insert into conversations (kind, match_id) values ('direct', m.id) returning id into conv;
    insert into conversation_participants (conversation_id, user_id) values (conv, m.user_a), (conv, m.user_b);
    insert into messages (conversation_id, sender_id, kind, body) values (conv, null, 'system', 'Mystery Match — you both chose to discover each other.');
    update matches set conversation_id = conv where id = m.id;
    perform create_connection_pair(m.user_a, m.user_b, conv, 'match');
    insert into notifications (user_id, type, data)
      values (case when m.user_a = auth.uid() then m.user_b else m.user_a end, 'match_accepted', jsonb_build_object('conversation_id', conv));
    return conv;
  end if;
  return null;
end $$;

-- ---------- account ---------------------------------------------------
create or replace function public.touch_presence() returns void
language sql security definer set search_path = public as $$
  update profiles set last_active_at = now() where id = auth.uid();
$$;

create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  -- media files are removed by the `account-cleanup` edge function (Supabase blocks direct deletes on storage.objects)
  delete from auth.users where id = auth.uid();  -- cascades to every user-owned row
end $$;

revoke execute on function public.can_view_post(public.posts, uuid) from public, anon;
-- ---------- grants for RPCs ------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'get_feed(text,int,int)','get_post(uuid)','get_user_posts(int,int,int)','search_posts(text,int,int)','get_comments(uuid)',
    'get_public_profile(int)','express_interest(uuid,text)','withdraw_interest(uuid)','get_post_interests(uuid)',
    'respond_interest(uuid,boolean,boolean)','get_my_pending_interests()','block_user(int)','get_blocked_users()','unblock_user(int)',
    'report_content(public.report_target,text,text,int,uuid)','get_my_conversations()','get_conversation(uuid)',
    'get_messages(uuid,timestamptz,int)','end_conversation(uuid)','set_reveal_consent(uuid,boolean,text[])',
    'get_revealed_identity(uuid)','get_my_matches()','find_mystery_match(text)','respond_match(uuid,boolean)',
    'touch_presence()','delete_my_account()']
  loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- ---------- realtime --------------------------------------------------
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.notifications;

-- ---------- storage ---------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('post-media', 'post-media', true, 10485760, array['image/jpeg','image/png','image/webp','audio/m4a','audio/mp4','audio/mpeg','audio/aac']),
  ('chat-media', 'chat-media', false, 10485760, array['image/jpeg','image/png','image/webp','audio/m4a','audio/mp4','audio/aac']),
  ('avatars', 'avatars', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "post media upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'post-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "post media delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'post-media' and owner = auth.uid());
create policy "chat media upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-media' and public.is_participant(((storage.foldername(name))[1])::uuid, auth.uid()));
create policy "chat media read" on storage.objects for select to authenticated
  using (bucket_id = 'chat-media' and public.is_participant(((storage.foldername(name))[1])::uuid, auth.uid()));
create policy "avatar own" on storage.objects for all to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

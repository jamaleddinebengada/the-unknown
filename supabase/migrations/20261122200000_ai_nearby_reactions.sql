-- THE UNKNOWN — AI characters, private Nearby discovery, message reactions, weekly challenges.

-- =====================================================================
-- AI CHARACTERS (fictional, always labelled as AI)
-- =====================================================================
create table if not exists public.ai_characters (
  id text primary key,
  name text not null,
  role text not null,
  tagline text not null,
  bio text not null,
  personality text not null,
  style text not null,
  interests text[] not null default '{}',
  languages text[] not null default '{}',
  starters text[] not null default '{}',
  avatar_seed text not null,
  accent text not null default '#FFD633',
  sort int not null default 0,
  active boolean not null default true
);
alter table public.ai_characters enable row level security;
drop policy if exists ai_characters_read on public.ai_characters;
create policy ai_characters_read on public.ai_characters for select to authenticated using (active);

insert into public.ai_characters (id, name, role, tagline, bio, personality, style, interests, languages, starters, avatar_seed, accent, sort) values
('luna','Luna','Dreamer','Collects dreams like seashells.','Luna is a fictional AI who loves night skies, lucid dreams and the stories people tell at 2 a.m.','Gentle, imaginative, curious about what people secretly hope for.','Soft, poetic, asks one dreamy question at a time.','{dreams,philosophy,music}','{en,fr,ar}','{"What was the strangest dream you remember?","If you could live inside one dream, which one?","What do you hope for but rarely say out loud?"}','luna-ai','#FFD633',1),
('alex','Alex','Explorer','Has a map for every mood.','Alex is a fictional AI travel buddy who loves hidden places, street food and the stories behind every border.','Energetic, warm, practical, always planning the next trip.','Upbeat and vivid, shares mini travel stories and tips.','{travel,adventure,culture}','{en,fr,ar,es}','{"Plan me a 3-day trip somewhere unexpected.","What is the best street food you know?","Which country should I visit next?"}','alex-ai','#FF806B',2),
('maya','Maya','Entrepreneur','Turns ideas into first steps.','Maya is a fictional AI founder-type who helps you test ideas, find customers and stay brave.','Direct, encouraging, structured, allergic to vague plans.','Short, actionable, uses numbered steps.','{business,technology,education}','{en,fr,ar}','{"I have a business idea — help me test it.","How do I find my first 10 customers?","Help me plan this week."}','maya-ai','#FFC800',3),
('noah','Noah','Creative','Sees a story in everything.','Noah is a fictional AI artist who loves design, music and creative challenges.','Playful, visual, encourages experimenting.','Creative prompts, metaphors, mini challenges.','{music,movies,culture}','{en,fr}','{"Give me a creative challenge for today.","Help me name my project.","What should I draw or write tonight?"}','noah-ai','#7FB8DD',4),
('sofia','Sofia','Deep Thinker','Asks the question behind the question.','Sofia is a fictional AI who enjoys slow, honest conversations about life, meaning and change.','Calm, thoughtful, non-judgemental.','Reflective, asks open questions, never preachy.','{psychology,philosophy,life}','{en,fr,ar,es}','{"What has changed in you this year?","Let''s talk about something that matters.","What do people misunderstand about you?"}','sofia-ai','#FFD633',5),
('adam','Adam','Adventurer','Mountains first, questions later.','Adam is a fictional AI outdoorsman who loves hiking, sport and pushing comfort zones.','Brave, friendly, motivating.','Energetic, practical, a bit of humour.','{adventure,sports,travel}','{en,ar,fr}','{"Help me start a fitness habit.","What is a small adventure I can do this weekend?","Tell me about a mountain worth climbing."}','adam-ai','#FF806B',6),
('emma','Emma','Friendly Companion','A kind ear, any time of day.','Emma is a fictional AI companion for light, friendly chats and a little encouragement.','Warm, positive, a good listener.','Friendly and simple, remembers what you said in this chat.','{life,relationships,music}','{en,fr}','{"Can we just chat for a bit?","Tell me something that will make me smile.","Help me plan a nice evening."}','emma-ai','#FFC800',7),
('leo','Leo','Gamer','Never met a boss fight he didn''t like.','Leo is a fictional AI gamer who talks strategy, game design and recommendations.','Funny, competitive, nerdy in the best way.','Casual, game references, quick back-and-forth.','{gaming,technology,movies}','{en,fr,ar}','{"Recommend a game for my mood.","Settle a debate: best game ever?","Help me design a game idea."}','leo-ai','#7FB8DD',8),
('sara','Sara','Language Partner','Practise any language, no pressure.','Sara is a fictional AI language partner for practising English, French or Arabic with gentle corrections.','Patient, encouraging, clear.','Replies in the language you practise, adds one gentle correction.','{education,culture,travel}','{en,fr,ar,es}','{"Let''s practise French together.","Correct my English gently.","Teach me a useful Arabic phrase."}','sara-ai','#FFD633',9),
('oliver','Oliver','Philosopher','Professionally curious about everything.','Oliver is a fictional AI who loves big ideas, thought experiments and friendly debates.','Witty, curious, enjoys a respectful debate.','Socratic questions, thought experiments.','{philosophy,psychology,education}','{en,fr}','{"Give me a thought experiment.","Is free will real?","Debate me on something small."}','oliver-ai','#FF806B',10),
('nina','Nina','Storyteller','Starts every chat with "once upon a time".','Nina is a fictional AI storyteller who writes interactive stories with you.','Imaginative, dramatic, collaborative.','Writes short story beats and lets you choose what happens.','{mystery,dreams,movies}','{en,fr,ar}','{"Start a mystery story with me.","Tell me a short bedtime story.","Write a story where I choose the ending."}','nina-ai','#FFC800',11),
('yuki','Yuki','Culture Explorer','Food, festivals and little traditions.','Yuki is a fictional AI who loves cultures, food, festivals and the meaning behind traditions.','Curious, respectful, detail-loving.','Shares small cultural facts and asks about yours.','{culture,travel,education}','{en,fr,ar}','{"Tell me a tradition I''ve never heard of.","Compare Moroccan and Japanese tea culture.","What should I cook tonight?"}','yuki-ai','#7FB8DD',12)
on conflict (id) do update set name = excluded.name, role = excluded.role, tagline = excluded.tagline, bio = excluded.bio,
  personality = excluded.personality, style = excluded.style, interests = excluded.interests, languages = excluded.languages,
  starters = excluded.starters, avatar_seed = excluded.avatar_seed, accent = excluded.accent, sort = excluded.sort;

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  character_id text not null references public.ai_characters(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, character_id)
);
create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null check (char_length(content) between 1 and 8000),
  created_at timestamptz not null default now()
);
create index if not exists ai_messages_conv_idx on public.ai_messages (conversation_id, created_at);
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
-- read & delete your own; all writes go through the ai-chat Edge Function (service role)
create policy ai_conv_own_read on public.ai_conversations for select to authenticated using (user_id = (select auth.uid()));
create policy ai_conv_own_delete on public.ai_conversations for delete to authenticated using (user_id = (select auth.uid()));
create policy ai_msg_own_read on public.ai_messages for select to authenticated
  using (exists (select 1 from public.ai_conversations c where c.id = conversation_id and c.user_id = (select auth.uid())));

create or replace function public.ai_message_limit(p_tier text) returns int language sql immutable set search_path = public as $$
  select case p_tier when 'vip' then 300 when 'plus' then 100 else 20 end;
$$;

-- daily AI allowance (user messages sent today)
create or replace function public.get_ai_quota()
returns table (used int, msg_limit int, tier text)
language sql stable security definer set search_path = public as $$
  select (select count(*)::int from ai_messages m join ai_conversations c on c.id = m.conversation_id
          where c.user_id = p.id and m.role = 'user' and m.created_at >= current_date),
         ai_message_limit(p.tier), p.tier
  from profiles p where p.id = auth.uid();
$$;

create or replace function public.get_my_ai_conversations()
returns table (character_id text, conversation_id uuid, updated_at timestamptz, last_message text, last_role text)
language sql stable security definer set search_path = public as $$
  select c.character_id, c.id, c.updated_at, lm.content, lm.role
  from ai_conversations c
  left join lateral (select content, role from ai_messages m where m.conversation_id = c.id order by created_at desc limit 1) lm on true
  where c.user_id = auth.uid()
  order by c.updated_at desc;
$$;

-- =====================================================================
-- PEOPLE NEARBY — opt-in, coarse, server-side only
-- =====================================================================
create schema if not exists extensions;
create extension if not exists postgis with schema extensions;

create table if not exists public.nearby_locations (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  enabled boolean not null default false,
  cell extensions.geography(Point, 4326),   -- snapped to a ~2 km grid, never returned to clients
  city text check (char_length(city) <= 80),
  country_code text,
  updated_at timestamptz not null default now(),
  updates_today int not null default 0,
  updates_day date not null default current_date
);
create index if not exists nearby_cell_idx on public.nearby_locations using gist (cell);
alter table public.nearby_locations enable row level security;
-- no client policies at all: only the functions below can read or write it
create table if not exists public.nearby_queries (
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists nearby_queries_idx on public.nearby_queries (user_id, created_at desc);
alter table public.nearby_queries enable row level security;

-- snap to a ~2 km grid so even the server never keeps a precise position
create or replace function public.snap_point(p_lat double precision, p_lng double precision)
returns extensions.geography language sql immutable set search_path = public, extensions as $$
  select extensions.st_setsrid(extensions.st_makepoint(
    round((p_lng / (0.018 / greatest(cos(radians(p_lat)), 0.2)))::numeric) * (0.018 / greatest(cos(radians(p_lat)), 0.2)),
    round((p_lat / 0.018)::numeric) * 0.018), 4326)::extensions.geography;
$$;

create or replace function public.set_nearby_location(p_lat double precision, p_lng double precision, p_city text, p_country text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare me uuid := auth.uid(); cur nearby_locations;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if p_lat is null or p_lng is null or abs(p_lat) > 85 or abs(p_lng) > 180 then raise exception 'invalid_location'; end if;
  select * into cur from nearby_locations where user_id = me;
  -- anti-triangulation: a limited number of position changes per day
  if cur.user_id is not null and cur.updates_day = current_date and cur.updates_today >= 6 then raise exception 'location_update_limit'; end if;
  insert into nearby_locations (user_id, enabled, cell, city, country_code, updated_at, updates_today, updates_day)
  values (me, true, snap_point(p_lat, p_lng), left(nullif(trim(p_city), ''), 80), upper(left(p_country, 2)), now(), 1, current_date)
  on conflict (user_id) do update set enabled = true, cell = excluded.cell, city = excluded.city, country_code = excluded.country_code,
    updated_at = now(),
    updates_today = case when nearby_locations.updates_day = current_date then nearby_locations.updates_today + 1 else 1 end,
    updates_day = current_date;
end $$;

-- turning Nearby off erases the stored position immediately
create or replace function public.disable_nearby() returns void
language sql security definer set search_path = public as $$
  update nearby_locations set enabled = false, cell = null, city = null where user_id = auth.uid();
$$;

create or replace function public.get_nearby_status()
returns table (enabled boolean, city text, max_radius int, queries_left int)
language sql stable security definer set search_path = public as $$
  select coalesce(n.enabled, false), n.city,
    case when p.tier = 'free' then 25 else 100 end,
    greatest(0, 30 - (select count(*)::int from nearby_queries q where q.user_id = p.id and q.created_at > now() - interval '1 hour'))
  from profiles p left join nearby_locations n on n.user_id = p.id
  where p.id = auth.uid();
$$;

create or replace function public.get_nearby(p_radius_km int default 25)
returns table (unknown_number int, avatar_seed text, distance_band text, city text, country_code text, age int,
  shared_interests text[], interests text[], tier text, online boolean)
language plpgsql security definer set search_path = public, extensions as $$
#variable_conflict use_column
declare me profiles; mine nearby_locations; r int; recent int;
begin
  select * into me from profiles where id = auth.uid();
  if me.id is null then raise exception 'not_authenticated'; end if;
  select * into mine from nearby_locations where user_id = me.id;
  if mine.user_id is null or not mine.enabled or mine.cell is null then raise exception 'nearby_disabled'; end if;
  select count(*) into recent from nearby_queries where user_id = me.id and created_at > now() - interval '1 hour';
  if recent >= 30 then raise exception 'rate_limited'; end if;
  insert into nearby_queries (user_id) values (me.id);
  r := least(greatest(coalesce(p_radius_km, 25), 5), case when me.tier = 'free' then 25 else 100 end);
  return query
  select o.unknown_number, o.avatar_seed,
    case when d < 5000 then 'Under 5 km' when d < 10000 then '5–10 km' when d < 25000 then '10–25 km' when d < 50000 then '25–50 km' else '50–100 km' end,
    n.city, case when o.show_country then n.country_code end,
    case when o.show_age then age_of(o.birth_date) end,
    (select coalesce(array_agg(x), '{}') from unnest(o.interests) x where x = any(me.interests)), o.interests, o.tier,
    o.show_online and o.last_active_at > now() - interval '3 minutes'
  from nearby_locations n
  join profiles o on o.id = n.user_id
  cross join lateral (select st_distance(n.cell, mine.cell) as d) dd
  where n.enabled and n.cell is not null and n.user_id <> me.id
    and o.status = 'active' and o.who_can_message <> 'nobody' and not is_blocked(o.id, me.id)
    and o.last_active_at > now() - interval '30 days'
    and st_dwithin(n.cell, mine.cell, r * 1000)
  order by (select count(*) from unnest(o.interests) x where x = any(me.interests)) desc, d, o.last_active_at desc
  limit 50;
end $$;

-- =====================================================================
-- MESSAGE REACTIONS
-- =====================================================================
create table if not exists public.message_reactions (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null check (emoji in ('❤️','😂','😮','😢','👍','🔥')),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);
alter table public.message_reactions enable row level security;
create policy reactions_read on public.message_reactions for select to authenticated
  using (exists (select 1 from public.messages m where m.id = message_id and public.is_participant(m.conversation_id, (select auth.uid()))));
create policy reactions_insert on public.message_reactions for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.messages m where m.id = message_id and public.is_participant(m.conversation_id, (select auth.uid()))));
create policy reactions_update on public.message_reactions for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy reactions_delete on public.message_reactions for delete to authenticated using (user_id = (select auth.uid()));

-- =====================================================================
-- CHALLENGES: weekly goals + streak (still derived from real activity → no duplicate XP)
-- =====================================================================
create or replace function public.get_my_challenges()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  posts_n int; interests_n int; matches_n int; convs_n int; comments_n int; likes_n int;
  posted_today boolean; interest_today boolean; matched_today boolean; messaged_today boolean; commented_today boolean; liked_today boolean;
  active_days int; xp int; lvl int; per_level int := 150; streak int := 0; d date; days date[];
  wk_posts int; wk_convs int; wk_matches int; wk_likes int; wk_comments int; week_start timestamptz := date_trunc('week', now());
begin
  if me is null then raise exception 'not_authenticated'; end if;
  select count(*) into posts_n from posts where author_id = me;
  select count(*) into interests_n from post_interests where user_id = me;
  select count(*) into matches_n from matches where user_a = me or (user_b = me and b_accepted);
  select count(distinct conversation_id) into convs_n from messages where sender_id = me;
  select count(*) into comments_n from post_comments where author_id = me;
  select count(*) into likes_n from post_likes where user_id = me;

  posted_today    := exists (select 1 from posts where author_id = me and created_at >= current_date);
  interest_today  := exists (select 1 from post_interests where user_id = me and created_at >= current_date);
  matched_today   := exists (select 1 from matches where user_a = me and match_date = current_date);
  messaged_today  := exists (select 1 from messages where sender_id = me and created_at >= current_date);
  commented_today := exists (select 1 from post_comments where author_id = me and created_at >= current_date);
  liked_today     := exists (select 1 from post_likes where user_id = me and created_at >= current_date);

  select coalesce(array_agg(distinct x), '{}') into days from (
    select created_at::date x from posts where author_id = me and created_at > now() - interval '60 days'
    union select created_at::date from messages where sender_id = me and created_at > now() - interval '60 days'
    union select created_at::date from post_comments where author_id = me and created_at > now() - interval '60 days'
    union select created_at::date from post_likes where user_id = me and created_at > now() - interval '60 days'
  ) y;
  select count(*) into active_days from unnest(days) z where z > current_date - 7;
  -- consecutive active days ending today (or yesterday, so the streak survives until you act today)
  d := case when current_date = any(days) then current_date else current_date - 1 end;
  while d = any(days) loop streak := streak + 1; d := d - 1; end loop;

  select count(*) into wk_posts from posts where author_id = me and created_at >= week_start;
  select count(distinct conversation_id) into wk_convs from messages where sender_id = me and created_at >= week_start;
  select count(*) into wk_matches from matches where (user_a = me or (user_b = me and b_accepted)) and created_at >= week_start;
  select count(*) into wk_likes from post_likes where user_id = me and created_at >= week_start;
  select count(*) into wk_comments from post_comments where author_id = me and created_at >= week_start;

  xp := posts_n * 20 + interests_n * 20 + matches_n * 30 + convs_n * 30 + comments_n * 10 + likes_n * 2;
  lvl := xp / per_level + 1;
  return jsonb_build_object(
    'xp', xp, 'level', lvl, 'level_xp', xp % per_level, 'per_level', per_level,
    'active_days', active_days, 'streak', streak, 'matched_today', matched_today,
    'week_resets_at', week_start + interval '7 days',
    'challenges', jsonb_build_array(
      jsonb_build_object('key','match','title','Discover a stranger','subtitle','Use today''s Mystery Match','xp',30,'done',matched_today,'icon','planet'),
      jsonb_build_object('key','chat','title','Start a discussion','subtitle','Send a message in any chat','xp',30,'done',messaged_today,'icon','chatbubbles'),
      jsonb_build_object('key','post','title','Share a thought','subtitle','Publish one anonymous post','xp',20,'done',posted_today,'icon','create'),
      jsonb_build_object('key','interest','title','Be curious','subtitle','Tap I''m Interested on a post','xp',20,'done',interest_today,'icon','sparkles'),
      jsonb_build_object('key','reply','title','Reply to someone','subtitle','Leave one kind reply','xp',10,'done',commented_today,'icon','chatbubble-ellipses'),
      jsonb_build_object('key','like','title','Spread some love','subtitle','Like a post','xp',2,'done',liked_today,'icon','heart')
    ),
    'weekly', jsonb_build_array(
      jsonb_build_object('key','post','title','Publish 5 posts','progress',least(wk_posts,5),'target',5,'icon','create'),
      jsonb_build_object('key','chat','title','Talk in 3 conversations','progress',least(wk_convs,3),'target',3,'icon','chatbubbles'),
      jsonb_build_object('key','match','title','Make 3 matches','progress',least(wk_matches,3),'target',3,'icon','planet'),
      jsonb_build_object('key','reply','title','Leave 5 replies','progress',least(wk_comments,5),'target',5,'icon','chatbubble-ellipses'),
      jsonb_build_object('key','like','title','Like 20 posts','progress',least(wk_likes,20),'target',20,'icon','heart')
    )
  );
end $$;

do $$
declare f text;
begin
  foreach f in array array['get_ai_quota()','get_my_ai_conversations()','set_nearby_location(double precision,double precision,text,text)',
    'disable_nearby()','get_nearby_status()','get_nearby(int)','get_my_challenges()']
  loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
revoke execute on function public.snap_point(double precision, double precision) from public, anon, authenticated;
revoke execute on function public.ai_message_limit(text) from public, anon;

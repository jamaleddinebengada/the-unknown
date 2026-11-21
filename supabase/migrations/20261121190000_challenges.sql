-- Daily challenges + XP, derived from real activity (no client-writable state, nothing to fake).
create or replace function public.get_my_challenges()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  posts_n int; interests_n int; matches_n int; convs_n int; comments_n int; likes_n int;
  posted_today boolean; interest_today boolean; matched_today boolean; messaged_today boolean; commented_today boolean; liked_today boolean;
  active_days int; xp int; lvl int; per_level int := 150;
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

  select count(distinct d) into active_days from (
    select created_at::date d from posts where author_id = me and created_at > now() - interval '7 days'
    union all select created_at::date from messages where sender_id = me and created_at > now() - interval '7 days'
    union all select created_at::date from post_comments where author_id = me and created_at > now() - interval '7 days'
    union all select created_at::date from post_likes where user_id = me and created_at > now() - interval '7 days'
  ) x;

  xp := posts_n * 20 + interests_n * 20 + matches_n * 30 + convs_n * 30 + comments_n * 10 + likes_n * 2;
  lvl := xp / per_level + 1;
  return jsonb_build_object(
    'xp', xp, 'level', lvl, 'level_xp', xp % per_level, 'per_level', per_level,
    'active_days', active_days, 'matched_today', matched_today,
    'challenges', jsonb_build_array(
      jsonb_build_object('key','match','title','Discover a stranger','subtitle','Use today''s Mystery Match','xp',30,'done',matched_today,'icon','planet'),
      jsonb_build_object('key','chat','title','Start a discussion','subtitle','Send a message in any chat','xp',30,'done',messaged_today,'icon','chatbubbles'),
      jsonb_build_object('key','post','title','Share a thought','subtitle','Publish one anonymous post','xp',20,'done',posted_today,'icon','create'),
      jsonb_build_object('key','interest','title','Be curious','subtitle','Tap I''m Interested on a post','xp',20,'done',interest_today,'icon','sparkles'),
      jsonb_build_object('key','reply','title','Reply to someone','subtitle','Leave one kind reply','xp',10,'done',commented_today,'icon','chatbubble-ellipses'),
      jsonb_build_object('key','like','title','Spread some love','subtitle','Like a post','xp',2,'done',liked_today,'icon','heart')
    )
  );
end $$;
revoke execute on function public.get_my_challenges() from public, anon;
grant execute on function public.get_my_challenges() to authenticated;

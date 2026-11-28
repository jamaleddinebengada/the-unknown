\set ON_ERROR_STOP 1
select 'companions seeded', count(*), count(*) filter (where gender='female'), min(age), max(age), min(jsonb_array_length(photos)), max(jsonb_array_length(photos)) from wif_companions;
select 'unique names per gender', count(distinct (name, gender)) from wif_companions;
-- separation: no companion id appears in real-user tables / discover
reset role; set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';
select 'direct table read blocked'; do $$ begin begin perform 1 from wif_companions limit 1; raise exception 'SHOULD FAIL'; exception when insufficient_privilege then raise notice 'companions table: no direct access'; end; end $$;
do $$ begin begin perform 1 from wif_companion_messages limit 1; raise exception 'SHOULD FAIL'; exception when insufficient_privilege then raise notice 'messages table: no direct access'; end; end $$;
do $$ begin begin perform wif_ai_context('aaaaaaaa-0000-0000-0000-000000000001', gen_random_uuid()); raise exception 'SHOULD FAIL'; exception when insufficient_privilege then raise notice 'wif_ai_context: service only'; end; end $$;
select 'list', count(*), bool_and(x->>'kind' = 'ai'), bool_and(not (x ? 'persona')), bool_and(not (x::text ~* 'distance|lat|lng|free|available|online')) from wif_companions('fr', null, null, 0, 50) x;
select 'personalised first has coffee/football?', (select x->'interests' from wif_companions('en') x limit 1);
select 'filter interest', count(*), bool_and(x->'interests' ? 'beach') from wif_companions('en', 'beach') x;
select 'discover excludes AI', count(*) filter (where x->>'id' in (select y->>'id' from wif_companions('en',null,null,0,50) y union select y->>'id' from wif_companions('en',null,null,50,50) y)) from wif_discover('nearby', 100) x;
select x->>'id' as cid from wif_companions('ar') x limit 1 \gset
select 'profile ar', (wif_companion(:'cid'::uuid, 'ar'))->>'bio', (wif_companion(:'cid'::uuid, 'ar'))->'chat' is null as no_chat_yet, jsonb_array_length((wif_companion(:'cid'::uuid, 'ar'))->'photos') as photos;
select 'msgs before start', count(*) from wif_companion_messages(:'cid'::uuid);
select 'start', wif_companion_start(:'cid'::uuid, true) is not null;
select 'start again keeps one chat', wif_companion_start(:'cid'::uuid, true) = wif_companion_start(:'cid'::uuid, true);
-- service side turn
reset role; set role service_role;
select 'ctx', x->>'name', x->>'memory_enabled', jsonb_array_length(x->'history'), x->>'user_first_name' from wif_ai_context('aaaaaaaa-0000-0000-0000-000000000001', :'cid'::uuid) x;
select 'save', wif_ai_save_turn(((wif_ai_context('aaaaaaaa-0000-0000-0000-000000000001', :'cid'::uuid))->>'chat_id')::uuid, 'Salam, labas?', 'Labas lhamdullah! W nta?')->>'turns';
select 'mem', wif_ai_save_memory(((wif_ai_context('aaaaaaaa-0000-0000-0000-000000000001', :'cid'::uuid))->>'chat_id')::uuid, 'User is called Amine, likes coffee.');
select 'ctx after', jsonb_array_length(x->'history'), x->>'memory' from wif_ai_context('aaaaaaaa-0000-0000-0000-000000000001', :'cid'::uuid) x;
do $$ begin begin perform wif_ai_context('aaaaaaaa-0000-0000-0000-000000000002', (select id from wif_companions limit 1)); raise exception 'SHOULD FAIL'; exception when raise_exception then if sqlerrm <> 'not_disclosed' then raise; end if; raise notice 'no chat without disclosure: ok'; end; end $$;
reset role; set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';
select 'history', string_agg(x->>'role' || ':' || (x->>'body'), ' | ' order by (x->>'id')::bigint) from wif_companion_messages(:'cid'::uuid) x;
select 'inbox', count(*), max(x->'last'->>'body') from wif_companion_inbox('en') x;
select 'card chatting', (wif_companion(:'cid'::uuid, 'en'))->'chatting', (wif_companion(:'cid'::uuid, 'en'))->'chat'->>'has_memory';
-- user 2 cannot see user 1 chat
reset role; set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000002';
select 'other user sees msgs', count(*) from wif_companion_messages(:'cid'::uuid);
select 'other user inbox', count(*) from wif_companion_inbox() ;
reset role; set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';
select 'memory off clears', wif_companion_set_memory(:'cid'::uuid, false), (wif_companion(:'cid'::uuid))->'chat'->>'has_memory';
select 'clear', wif_companion_clear(:'cid'::uuid), (select count(*) from wif_companion_messages(:'cid'::uuid));
-- rate limit
reset role; set role postgres;
update wif_ai_usage set n = 80;
set role service_role;
do $$ begin begin perform wif_ai_context('aaaaaaaa-0000-0000-0000-000000000001', (select companion_id from wif_companion_chats limit 1)); raise exception 'SHOULD FAIL'; exception when raise_exception then if sqlerrm <> 'ai_daily_limit' then raise; end if; raise notice 'daily limit: ok'; end; end $$;
reset role; set role authenticated; set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';
select 'delete account removes chats', wif_delete_account(); reset role; select count(*) from wif_companion_chats;

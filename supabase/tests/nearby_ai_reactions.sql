reset role;
insert into auth.users (id, email) values ('55555555-5555-5555-5555-555555555555','e@x.com') on conflict do nothing;
update profiles set last_active_at = now(), interests = '{travel,music}' where id in ('22222222-2222-2222-2222-222222222222','55555555-5555-5555-5555-555555555555','33333333-3333-3333-3333-333333333333');
-- B in Casablanca, E 3 km away, C in Rabat (~87 km)
set role authenticated; set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select set_nearby_location(33.5731, -7.5898, 'Casablanca', 'MA');
set request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';
select set_nearby_location(33.5900, -7.6200, 'Casablanca', 'MA');
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select set_nearby_location(34.0209, -6.8416, 'Rabat', 'MA');
-- no client can read the table
do $$ begin perform * from nearby_locations; raise notice 'rows visible: %', (select count(*) from nearby_locations); exception when insufficient_privilege then raise notice 'ok: table not readable'; end $$;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select 'B status', * from get_nearby_status();
select 'B nearby 25', unknown_number, distance_band, city, shared_interests from get_nearby(25);
select 'B nearby 100 (free capped to 25)', count(*) from get_nearby(100);
reset role; update profiles set tier='plus' where id='22222222-2222-2222-2222-222222222222';
set role authenticated; set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select 'B plus 100', unknown_number, distance_band, city from get_nearby(100);
-- columns returned never include coordinates
select 'cols', string_agg(attname, ',') from pg_attribute where attrelid = 'pg_proc'::regclass and false;
-- triangulation guard: 6 location changes per day
do $$ declare i int; begin for i in 1..7 loop perform set_nearby_location(33.5 + i*0.01, -7.6, 'X', 'MA'); end loop; raise notice 'SHOULD FAIL'; exception when raise_exception then raise notice 'ok: %', sqlerrm; end $$;
select disable_nearby();
do $$ begin perform get_nearby(25); raise notice 'SHOULD FAIL'; exception when raise_exception then raise notice 'ok: %', sqlerrm; end $$;
reset role; select 'B row after disable', enabled, cell is null, city from nearby_locations where user_id='22222222-2222-2222-2222-222222222222';
-- rate limit
set role authenticated; set request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';
do $$ declare i int; begin for i in 1..31 loop perform get_nearby(25); end loop; raise notice 'SHOULD FAIL'; exception when raise_exception then raise notice 'ok: %', sqlerrm; end $$;
-- AI
select 'chars', count(*) from ai_characters;
select 'quota', * from get_ai_quota();
do $$ begin insert into ai_conversations (user_id, character_id) values (auth.uid(), 'luna'); raise notice 'SHOULD FAIL'; exception when insufficient_privilege then raise notice 'ok: ai insert blocked'; end $$;
select 'ai convs', count(*) from get_my_ai_conversations();
-- reactions
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
insert into message_reactions (message_id, user_id, emoji) select m.id, auth.uid(), '🔥' from messages m where is_participant(m.conversation_id, auth.uid()) limit 1;
select 'reactions', count(*) from message_reactions;
do $$ begin insert into message_reactions (message_id, user_id, emoji) select m.id, auth.uid(), '💩' from messages m limit 1; raise notice 'SHOULD FAIL'; exception when others then raise notice 'ok: bad emoji %', sqlstate; end $$;
select 'challenges', (get_my_challenges())->'streak', jsonb_array_length((get_my_challenges())->'weekly');

\set ON_ERROR_STOP 1
insert into storage.objects (bucket_id, name, owner) values ('avatars','22222222-2222-2222-2222-222222222222/p.jpg','22222222-2222-2222-2222-222222222222');
-- B sets a photo visible only after reveal
set role authenticated; set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
update profile_private set photo_path = '22222222-2222-2222-2222-222222222222/p.jpg', gallery = '{x/1.jpg}' where id = auth.uid();
do $$ begin begin update profiles set profile_theme = 'gold' where id = auth.uid(); raise exception 'SHOULD FAIL'; exception when raise_exception then raise notice 'ok theme: %', sqlerrm; end; end $$;
do $$ begin begin update profiles set tier = 'vip' where id = auth.uid(); raise exception 'SHOULD FAIL'; exception when insufficient_privilege then raise notice 'ok tier protected'; end; end $$;
reset role;
-- C (free, no conversation with B) cannot see B's photo
set role authenticated; set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select 'C sees meta', unknown_number, photo_path, tier from get_people_meta(array(select unknown_number from get_people()));
select 'C storage rows', count(*) from storage.objects where bucket_id='avatars';
select 'C plan', * from get_my_plan();
select 'C people', count(*) from get_people('JP', 20, 40);  -- filters ignored for free
do $$ begin begin perform toggle_saved_post((select id from get_feed('for_you',0,1))); raise exception 'SHOULD FAIL'; exception when raise_exception then raise notice 'ok save: %', sqlerrm; end; end $$;
select 'C match', other_number, mode from find_mystery_match('random');
do $$ begin begin perform find_mystery_match('random'); raise exception 'SHOULD FAIL'; exception when raise_exception then raise notice 'ok limit: %', sqlerrm; end; end $$;
reset role;
-- B goes public, C becomes VIP (as the webhook would)
update profiles set photo_visibility = 'public' where id = '22222222-2222-2222-2222-222222222222';
update profiles set tier = 'vip', is_premium = true where id = '33333333-3333-3333-3333-333333333333';
set role authenticated; set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select 'C sees public photo', photo_path, gallery from get_people_meta(array(select unknown_number from get_people()));
select 'C storage rows now', count(*) from storage.objects where bucket_id='avatars';
select 'C plan vip', tier, matches_today, match_limit, super_limit from get_my_plan();
select 'C people filtered', count(*) from get_people('ZZ');
select 'C saves', toggle_saved_post((select id from get_feed('for_you',0,1)));
select 'C saved list', count(*) from get_saved_posts();
select 'C connect', other_number, mode, i_accepted from connect_with((select unknown_number from get_people() limit 1));
select 'C super', super_connect((select match_id from get_my_matches() limit 1)) ;
select 'C super ids', count(*) from get_my_super_match_ids();
update profiles set profile_theme = 'gold' where id = auth.uid();
select 'C feed', count(*) from get_feed('for_you',0,20);
reset role;

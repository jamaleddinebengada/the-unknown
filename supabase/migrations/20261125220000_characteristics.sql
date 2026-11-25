-- Profile characteristics shown on cards and profiles (all optional, user-editable).
alter table public.profiles add column if not exists height_cm int check (height_cm between 120 and 230);
alter table public.profiles add column if not exists zodiac text check (zodiac in ('aries','taurus','gemini','cancer','leo','virgo','libra','scorpio','sagittarius','capricorn','aquarius','pisces'));
alter table public.profiles add column if not exists job text check (char_length(trim(job)) between 1 and 60);
alter table public.profiles add column if not exists education text check (education in ('high_school','college','bachelor','master','doctorate','other'));
alter table public.profiles add column if not exists smoking text check (smoking in ('never','sometimes','regularly'));
alter table public.profiles add column if not exists drinking text check (drinking in ('never','socially','regularly'));
alter table public.profiles add column if not exists exercise text check (exercise in ('never','sometimes','often','daily'));
alter table public.profiles add column if not exists pets text check (pets in ('none','cat','dog','other','want'));
grant update (height_cm, zodiac, job, education, smoking, drinking, exercise, pets) on public.profiles to authenticated;

create or replace function public.person_json(o public.profiles, me public.profiles, d double precision)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'unknown_number', o.unknown_number,
    'display_name', o.display_name,
    'avatar_seed', o.avatar_seed,
    'age', case when o.show_age then age_of(o.birth_date) end,
    'gender', o.gender,
    'bio', coalesce(o.bio, o.tagline),
    'looking_for', o.looking_for,
    'languages', o.languages,
    'interests', o.interests,
    'shared_interests', (select coalesce(jsonb_agg(x), '[]') from unnest(o.interests) x where x = any(me.interests)),
    'country_code', case when o.show_country then o.country_code end,
    'city', (select n.city from nearby_locations n where n.user_id = o.id and n.enabled),
    'distance_band', distance_band(d),
    'online', o.show_online and o.last_active_at > now() - interval '3 minutes',
    'recently_active', o.show_online and o.last_active_at > now() - interval '24 hours',
    'is_new', o.created_at > now() - interval '14 days',
    'is_verified', o.is_verified,
    'tier', o.tier,
    'has_photo', o.photo_visibility = 'public' and exists (select 1 from profile_private pp where pp.id = o.id and pp.photo_path is not null),
    'is_favorite', exists (select 1 from favorites f where f.user_id = me.id and f.target_id = o.id),
    'i_liked', exists (select 1 from swipes s where s.swiper = me.id and s.target = o.id and s.action in ('like','super')),
    'traits', jsonb_strip_nulls(jsonb_build_object('height_cm', o.height_cm, 'zodiac', o.zodiac, 'job', o.job, 'education', o.education,
       'smoking', o.smoking, 'drinking', o.drinking, 'exercise', o.exercise, 'pets', o.pets)),
    'personality_tags', o.personality_tags
  );
$$;
revoke execute on function public.person_json(public.profiles, public.profiles, double precision) from public, anon, authenticated;

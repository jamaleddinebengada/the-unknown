-- Display names + authorized photos for any list of members (chat list, matches, posts, notifications).
create or replace function public.get_people_cards(p_numbers int[])
returns table (unknown_number int, display_name text, photo_path text, gallery text[], tier text, profile_theme text, is_verified boolean)
language sql stable security definer set search_path = public as $$
  select o.unknown_number, o.display_name,
    case when can_see_photo(o.id, auth.uid()) then pp.photo_path end,
    case when can_see_photo(o.id, auth.uid()) then coalesce(pp.gallery, '{}') else '{}'::text[] end,
    o.tier, o.profile_theme, o.is_verified
  from profiles o left join profile_private pp on pp.id = o.id
  where o.unknown_number = any(p_numbers[1:100]) and o.status = 'active' and not is_blocked(o.id, auth.uid());
$$;
revoke execute on function public.get_people_cards(int[]) from public, anon;
grant execute on function public.get_people_cards(int[]) to authenticated;

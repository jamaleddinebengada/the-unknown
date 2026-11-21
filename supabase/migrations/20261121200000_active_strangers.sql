create or replace function public.get_active_strangers(p_limit int default 6)
returns table (unknown_number int, avatar_seed text, country_code text, online boolean)
language sql stable security definer set search_path = public as $$
  select p.unknown_number, p.avatar_seed, case when p.show_country then p.country_code end,
         p.last_active_at > now() - interval '3 minutes'
  from profiles p
  where p.id <> auth.uid() and p.status = 'active' and p.show_online
    and p.last_active_at > now() - interval '24 hours'
    and not is_blocked(p.id, auth.uid())
  order by p.last_active_at desc
  limit least(greatest(p_limit, 1), 20);
$$;
revoke execute on function public.get_active_strangers(int) from public, anon;
grant execute on function public.get_active_strangers(int) to authenticated;

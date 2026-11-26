-- Realistic portraits for the fictional AI characters, uploaded by moderators from the app.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('ai-portraits', 'ai-portraits', true, 3145728, array['image/jpeg','image/png','image/webp'])
  on conflict (id) do nothing;
create policy "ai portraits admin insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'ai-portraits' and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

create or replace function public.admin_set_character_portrait(p_id text, p_path text) returns text
language plpgsql security definer set search_path = public as $$
declare a uuid := require_admin(); url text;
begin
  if p_path is null then
    update ai_characters set portrait_url = null where id = p_id;
    return null;
  end if;
  if p_path !~ '^[a-z]+-[0-9]+\.(jpg|png|webp)$' or split_part(p_path, '-', 1) <> p_id then raise exception 'invalid_path'; end if;
  url := 'https://summcadnxnckemvpzojh.supabase.co/storage/v1/object/public/ai-portraits/' || p_path;
  update ai_characters set portrait_url = url where id = p_id;
  if not found then raise exception 'not_found'; end if;
  insert into moderation_log (admin_id, action, note) values (a, 'character_portrait', p_id);
  return url;
end $$;
revoke execute on function public.admin_set_character_portrait(text, text) from public, anon;
grant execute on function public.admin_set_character_portrait(text, text) to authenticated;

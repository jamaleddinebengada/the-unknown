-- New message kinds (must be committed before they are used, so they live in their own migration).
alter type public.message_kind add value if not exists 'video';
alter type public.message_kind add value if not exists 'gift';

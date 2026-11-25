// Supabase Edge Function: livekit-token — short-lived LiveKit access token for a 1:1 call or a voice room.
// Secrets: LIVEKIT_URL (wss://…livekit.cloud), LIVEKIT_API_KEY, LIVEKIT_API_SECRET. Never shipped in the app.
// The caller must be signed in (verify_jwt = true) and a participant of the conversation it wants to call in.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { SignJWT } from 'npm:jose@5';

Deno.serve(async (req) => {
  const url = Deno.env.get('LIVEKIT_URL'), key = Deno.env.get('LIVEKIT_API_KEY'), secret = Deno.env.get('LIVEKIT_API_SECRET');
  if (!url || !key || !secret) return Response.json({ error: 'calls_not_configured' }, { status: 503 });
  const auth = req.headers.get('Authorization') ?? '';
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
  const { data: u } = await sb.auth.getUser();
  if (!u.user) return Response.json({ error: 'not_authenticated' }, { status: 401 });
  const { conversation_id, room } = await req.json().catch(() => ({}));

  let roomName: string;
  if (conversation_id) {
    // RLS: the participant row is only visible to members of the conversation
    const { data: part } = await sb.from('conversation_participants').select('conversation_id').eq('conversation_id', conversation_id).eq('user_id', u.user.id).maybeSingle();
    if (!part) return Response.json({ error: 'not_allowed' }, { status: 403 });
    roomName = `call-${conversation_id}`;
  } else if (typeof room === 'string' && /^[a-z0-9-]{3,40}$/.test(room)) {
    roomName = `voice-${room}`;
  } else return Response.json({ error: 'bad_request' }, { status: 400 });

  const token = await new SignJWT({
    video: { room: roomName, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: true },
    name: u.user.id.slice(0, 8),
  }).setProtectedHeader({ alg: 'HS256' }).setIssuer(key).setSubject(u.user.id).setNotBefore('0s').setExpirationTime('2h').sign(new TextEncoder().encode(secret));
  return Response.json({ url, token, room: roomName });
});

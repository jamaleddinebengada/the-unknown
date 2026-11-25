// Supabase Edge Function: send-push — delivers a push notification for each new row in public.notifications.
// Trigger: Supabase Dashboard → Database → Webhooks → "notifications INSERT" → this function (HTTP POST),
//          with header  Authorization: <PUSH_WEBHOOK_AUTH secret>.
// Secrets: PUSH_WEBHOOK_AUTH, FCM_SERVICE_ACCOUNT (the Firebase service-account JSON, one line).
// Deployed with verify_jwt = false; the shared secret is checked instead. Tokens never leave the server.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { importPKCS8, SignJWT } from 'npm:jose@5';

const TEXT: Record<string, [string, string]> = {
  message: ['New message', 'You have a new message'],
  swipe_match: ['It’s a match! 💙', 'You both liked each other — say hi'],
  like_received: ['Someone likes you', 'Open THE UNKNOWN to find out who'],
  super_like: ['You got a Super Like ⭐', 'Someone really wants to meet you'],
  gift_received: ['You received a gift 🎁', 'Someone sent you a gift'],
  connection_request: ['New chat request', 'Someone wants to talk with you'],
  verification: ['Verification update', 'Your verification was reviewed'],
};

let cached: { token: string; exp: number } | null = null;
async function accessToken(sa: { client_email: string; private_key: string }) {
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  const key = await importPKCS8(sa.private_key, 'RS256');
  const jwt = await new SignJWT({ scope: 'https://www.googleapis.com/auth/firebase.messaging' })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' }).setIssuer(sa.client_email).setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt().setExpirationTime('1h').sign(key);
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }) });
  const j = await r.json();
  if (!j.access_token) throw new Error('fcm auth failed');
  cached = { token: j.access_token, exp: Date.now() + 3500_000 };
  return cached.token;
}

Deno.serve(async (req) => {
  const secret = Deno.env.get('PUSH_WEBHOOK_AUTH');
  const saRaw = Deno.env.get('FCM_SERVICE_ACCOUNT');
  if (!secret || !saRaw) return new Response('push not configured', { status: 503 });
  if (req.headers.get('Authorization') !== secret) return new Response('unauthorized', { status: 401 });
  const body = await req.json().catch(() => null);
  const n = body?.record;
  if (!n?.user_id || !n?.type) return Response.json({ ok: true, skipped: 'no record' });
  const [title, text] = TEXT[n.type] ?? ['THE UNKNOWN', 'You have something new'];

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data: tokens } = await admin.from('push_tokens').select('token').eq('user_id', n.user_id).eq('platform', 'fcm');
  if (!tokens?.length) return Response.json({ ok: true, sent: 0 });

  const sa = JSON.parse(saRaw);
  const auth = await accessToken(sa);
  let sent = 0;
  for (const { token } of tokens) {
    const r = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
      method: 'POST', headers: { Authorization: `Bearer ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: { token, notification: { title, body: text }, android: { priority: 'high', notification: { channel_id: 'default' } }, data: { type: String(n.type) } } }),
    });
    if (r.ok) sent++;
    else if (r.status === 404 || r.status === 400) await admin.from('push_tokens').delete().eq('token', token); // stale token
  }
  return Response.json({ ok: true, sent });
});

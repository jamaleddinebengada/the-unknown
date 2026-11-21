// Supabase Edge Function: revenuecat-webhook
// RevenueCat → Project Settings → Integrations → Webhooks:
//   URL:  https://<project>.supabase.co/functions/v1/revenuecat-webhook
//   Authorization header: the same value as the REVENUECAT_WEBHOOK_AUTH secret.
// Deployed with verify_jwt = false (RevenueCat cannot send a Supabase JWT); the shared
// Authorization secret is checked instead. Premium is only ever granted here, server-side.

import { createClient } from 'npm:@supabase/supabase-js@2';

const ACTIVE = new Set(['INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION', 'PRODUCT_CHANGE', 'NON_RENEWING_PURCHASE', 'SUBSCRIPTION_EXTENDED', 'TEMPORARY_ENTITLEMENT_GRANT']);
const INACTIVE = new Set(['EXPIRATION', 'SUBSCRIPTION_PAUSED']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  const secret = Deno.env.get('REVENUECAT_WEBHOOK_AUTH');
  if (!secret) return new Response('webhook not configured', { status: 503 });
  if (req.headers.get('Authorization') !== secret) return new Response('unauthorized', { status: 401 });
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });

  const body = await req.json().catch(() => null);
  const ev = body?.event;
  if (!ev?.type) return new Response('bad request', { status: 400 });

  // The app logs in to RevenueCat with the Supabase user id; aliases cover transfers/restores.
  const ids: string[] = [ev.app_user_id, ev.original_app_user_id, ...(ev.aliases ?? []), ...(ev.transferred_to ?? [])]
    .filter((x: unknown): x is string => typeof x === 'string' && UUID.test(x));
  if (!ids.length) return Response.json({ ok: true, skipped: 'no supabase user id' });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const entitled = (ev.entitlement_ids ?? []).includes('plus') || ev.entitlement_id === 'plus';
  let status: 'active' | 'inactive' | null = null;
  if (ACTIVE.has(ev.type) && entitled) status = 'active';
  else if (INACTIVE.has(ev.type)) status = 'inactive';
  else if (ev.type === 'CANCELLATION' || ev.type === 'BILLING_ISSUE') status = null; // keeps access until EXPIRATION

  for (const id of [...new Set(ids)]) {
    const { data: exists } = await admin.from('profiles').select('id').eq('id', id).maybeSingle();
    if (!exists) continue;
    await admin.from('subscriptions').upsert({
      user_id: id,
      product_id: ev.product_id ?? null,
      status: status ?? (ev.type === 'CANCELLATION' ? 'cancelled' : ev.type === 'BILLING_ISSUE' ? 'billing_issue' : 'active'),
      provider: 'revenuecat',
      current_period_end: ev.expiration_at_ms ? new Date(ev.expiration_at_ms).toISOString() : null,
      updated_at: new Date().toISOString(),
    });
    if (status) await admin.from('profiles').update({ is_premium: status === 'active' }).eq('id', id);
  }
  return Response.json({ ok: true, type: ev.type, status });
});

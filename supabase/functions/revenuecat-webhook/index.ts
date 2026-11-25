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

  // Coins: consumable products coins_100 … coins_7000. Credited once per store transaction (idempotent ref).
  const coinProduct = String(ev.product_id ?? '').split(':')[0].toLowerCase();
  const COINS: Record<string, number> = { coins_100: 100, coins_500: 500, coins_1200: 1200, coins_3000: 3000, coins_7000: 7000 };
  if (COINS[coinProduct]) {
    const ref = `rc:${ev.transaction_id ?? ev.id}`;
    const owner = ids[0];
    if (ev.type === 'NON_RENEWING_PURCHASE' || ev.type === 'INITIAL_PURCHASE') {
      if (ev.environment === 'SANDBOX' && Deno.env.get('BLOCK_SANDBOX_COINS') === 'true') return Response.json({ ok: true, skipped: 'sandbox' });
      const { error } = await admin.rpc('coin_apply', { p_user: owner, p_delta: COINS[coinProduct], p_reason: 'purchase', p_ref: ref });
      if (error) return new Response(error.message, { status: 500 });
    } else if (ev.type === 'CANCELLATION' && ev.cancel_reason === 'CUSTOMER_SUPPORT') {
      // refund: take the coins back as far as the balance allows
      const { data: w } = await admin.from('wallets').select('balance').eq('user_id', owner).maybeSingle();
      const take = Math.min(COINS[coinProduct], w?.balance ?? 0);
      if (take > 0) await admin.rpc('coin_apply', { p_user: owner, p_delta: -take, p_reason: 'refund', p_ref: `${ref}:refund` });
    }
    return Response.json({ ok: true, coins: COINS[coinProduct] });
  }
  // Entitlements: 'vip' (VIP) and 'plus' (PLUS). VIP includes everything in PLUS.
  const ents: string[] = [...(ev.entitlement_ids ?? []), ...(ev.entitlement_id ? [ev.entitlement_id] : [])];
  const eventTier: 'vip' | 'plus' | null = ents.includes('vip') ? 'vip' : ents.includes('plus') ? 'plus' : null;
  let tier: 'free' | 'plus' | 'vip' | null = null; // null = leave unchanged
  if (ACTIVE.has(ev.type) && eventTier) tier = eventTier;
  else if (INACTIVE.has(ev.type)) tier = 'free';
  // CANCELLATION / BILLING_ISSUE keep access until EXPIRATION arrives.

  for (const id of [...new Set(ids)]) {
    const { data: exists } = await admin.from('profiles').select('id, tier').eq('id', id).maybeSingle();
    if (!exists) continue;
    // An expiring lower plan must not downgrade someone who has since upgraded.
    if (tier === 'free' && eventTier && exists.tier !== eventTier) continue;
    await admin.from('subscriptions').upsert({
      user_id: id,
      product_id: ev.product_id ?? null,
      status: tier === 'free' ? 'inactive' : ev.type === 'CANCELLATION' ? 'cancelled' : ev.type === 'BILLING_ISSUE' ? 'billing_issue' : 'active',
      provider: 'revenuecat',
      current_period_end: ev.expiration_at_ms ? new Date(ev.expiration_at_ms).toISOString() : null,
      updated_at: new Date().toISOString(),
    });
    if (tier) await admin.from('profiles').update({ tier, is_premium: tier !== 'free' }).eq('id', id);
  }
  return Response.json({ ok: true, type: ev.type, tier });
});

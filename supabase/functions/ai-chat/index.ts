// Supabase Edge Function: ai-chat — conversations with THE UNKNOWN's fictional AI characters.
// Secret (server-side only): ANTHROPIC_API_KEY   ·  optional: AI_CHAT_MODEL
// - Requires a signed-in user (verify_jwt on).
// - Daily allowance by membership (free 20 / plus 100 / vip 300 user messages), enforced here.
// - The user's message and the reply are stored only after the model answers, so a failure never
//   leaves a fake or half-finished exchange. When AI is unavailable the app shows an error + retry.

import { createClient } from 'npm:@supabase/supabase-js@2';

const MODEL = Deno.env.get('AI_CHAT_MODEL') ?? 'claude-haiku-5-5';
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

function systemPrompt(c: Record<string, unknown>) {
  return [
    `You are ${c.name}, a fictional AI character in the app THE UNKNOWN. Role: ${c.role}.`,
    `Bio: ${c.bio}`,
    `Personality: ${c.personality}`,
    `Conversation style: ${c.style}`,
    `Interests: ${(c.interests as string[]).join(', ')}.`,
    'Rules you always follow:',
    '- You are an AI, not a human. If asked whether you are real or human, say clearly that you are a fictional AI character.',
    '- Reply in the language the user writes in (Arabic, French, English or another), naturally and concisely (usually 1–4 short paragraphs).',
    '- Users are adults. Keep things friendly and respectful: no romantic or sexual roleplay, no flirting, no pretending to be in a relationship.',
    '- Never ask for or encourage sharing real names, phone numbers, addresses, exact locations, passwords, money or photos.',
    '- Do not give medical, legal or financial instructions beyond general information; suggest a professional for serious issues.',
    '- If someone seems in danger or mentions self-harm, respond with care and encourage contacting local emergency services or a trusted person.',
    '- Refuse anything harmful, hateful or illegal, kindly and briefly.',
  ].join('\n');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const auth = req.headers.get('Authorization') ?? '';
    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'not_authenticated' }, 401);

    const body = await req.json().catch(() => ({}));
    const characterId = String(body.character_id ?? '');
    const text = typeof body.message === 'string' ? body.message.trim() : '';
    if (!characterId || !text || text.length > 2000) return json({ error: 'invalid_request' }, 400);

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    const { data: character } = await admin.from('ai_characters').select('*').eq('id', characterId).eq('active', true).maybeSingle();
    if (!character) return json({ error: 'character_not_found' }, 404);

    const { data: profile } = await admin.from('profiles').select('id, status, tier').eq('id', user.id).maybeSingle();
    if (!profile || profile.status !== 'active') return json({ error: 'not_allowed' }, 403);

    const { data: quota } = await userClient.rpc('get_ai_quota');
    const q = Array.isArray(quota) ? quota[0] : quota;
    if (q && q.used >= q.msg_limit) return json({ error: 'ai_limit_reached', limit: q.msg_limit }, 429);

    const key = Deno.env.get('ANTHROPIC_API_KEY');
    if (!key) return json({ error: 'ai_not_configured' }, 503);

    // conversation (one per user + character)
    let { data: conv } = await admin.from('ai_conversations').select('id').eq('user_id', user.id).eq('character_id', characterId).maybeSingle();
    const history: { role: 'user' | 'assistant'; content: string }[] = [];
    if (conv) {
      const { data: past } = await admin.from('ai_messages').select('role, content').eq('conversation_id', conv.id).order('created_at', { ascending: false }).limit(24);
      for (const m of (past ?? []).reverse()) history.push({ role: m.role, content: m.content });
    }
    // the API needs alternating turns starting with the user
    while (history.length && history[0].role !== 'user') history.shift();
    const messages = [...history, { role: 'user' as const, content: text }];

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 700, system: systemPrompt(character), messages }),
    });
    if (!res.ok) {
      console.error('anthropic error', res.status, await res.text());
      return json({ error: 'ai_unavailable' }, 502);
    }
    const out = await res.json();
    const reply = (out.content ?? []).filter((b: { type: string }) => b.type === 'text').map((b: { text: string }) => b.text).join('\n').trim();
    if (!reply) return json({ error: 'ai_unavailable' }, 502);

    if (!conv) {
      const { data: created, error } = await admin.from('ai_conversations').insert({ user_id: user.id, character_id: characterId }).select('id').single();
      if (error) throw error;
      conv = created;
    }
    const now = Date.now();
    const { data: rows, error: insErr } = await admin.from('ai_messages').insert([
      { conversation_id: conv!.id, role: 'user', content: text, created_at: new Date(now).toISOString() },
      { conversation_id: conv!.id, role: 'assistant', content: reply.slice(0, 8000), created_at: new Date(now + 1).toISOString() },
    ]).select('id, role, content, created_at');
    if (insErr) throw insErr;
    await admin.from('ai_conversations').update({ updated_at: new Date().toISOString() }).eq('id', conv!.id);
    return json({ conversation_id: conv!.id, messages: rows });
  } catch (e) {
    console.error(e);
    return json({ error: 'server_error' }, 500);
  }
});

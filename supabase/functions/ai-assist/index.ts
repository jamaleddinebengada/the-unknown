// Supabase Edge Function: ai-assist
// Deploy:  supabase functions deploy ai-assist
// Secret:  supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
// The client never sees the key. Requests must carry a valid user JWT (verify_jwt is on by default).
// AI only *suggests* text — publishing always requires the user to tap Publish/Send in the app.

import { createClient } from 'npm:@supabase/supabase-js@2';

const MODEL = Deno.env.get('AI_MODEL') ?? 'claude-haiku-5-5';
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PROMPTS: Record<string, string> = {
  improve: 'Improve the writing of this anonymous social post. Keep the author’s voice, meaning and language. Return only the improved post.',
  interesting: 'Rewrite this anonymous social post so it sparks curiosity and replies, without clickbait. Keep the language. Return only the post.',
  question: 'Turn this into one thought-provoking open question that invites strangers to answer. Keep the language. Return only the question.',
  clearer: 'Make this post clearer and more concise while keeping its meaning and language. Return only the post.',
  title: 'Suggest one short, evocative title (max 8 words) for this post, in the same language. Return only the title.',
  translate: 'Translate this text into {target}. Return only the translation.',
  conversation: 'You help two anonymous strangers have a meaningful conversation. Based on the recent messages, suggest ONE warm, curious, non-intrusive next message for "Me" to send. Never ask for real names, contact details, photos, location or anything sexual. Return only the message.',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const key = Deno.env.get('ANTHROPIC_API_KEY');
    if (!key) return json({ error: 'ai_not_configured' }, 503);

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: 'not_authenticated' }, 401);

    const { action, text, target = 'English' } = await req.json();
    const system = PROMPTS[action as string];
    if (!system || typeof text !== 'string' || !text.trim() || text.length > 6000) return json({ error: 'invalid_request' }, 400);

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 400,
        system: system.replace('{target}', String(target)) + ' If the text contains harassment, threats or sexual content involving anyone, refuse briefly.',
        messages: [{ role: 'user', content: text }],
      }),
    });
    if (!res.ok) return json({ error: 'ai_unavailable' }, 502);
    const data = await res.json();
    const result = (data.content ?? []).filter((b: { type: string }) => b.type === 'text').map((b: { text: string }) => b.text).join('').trim();
    return json({ result });
  } catch (e) {
    return json({ error: 'server_error' }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

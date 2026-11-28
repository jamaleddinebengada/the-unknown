// wif-companion-chat — generates an AI companion reply. Keys live only in Supabase secrets:
//   ANTHROPIC_API_KEY (required for replies), WIF_AI_MODEL (optional, default claude-haiku-5-5).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { handle, type Turn } from './logic.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const MODEL = Deno.env.get('WIF_AI_MODEL') ?? 'claude-haiku-5-5';

async function callModel(system: string, messages: Turn[], maxTokens: number): Promise<string> {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages }),
  });
  if (!r.ok) { console.error('anthropic', r.status, (await r.text()).slice(0, 300)); throw new Error('ai_failed'); }
  const j = await r.json();
  return (j.content ?? []).filter((c: { type: string }) => c.type === 'text').map((c: { text: string }) => c.text).join('').trim();
}

Deno.serve((req) => handle(req, {
  hasModel: !!KEY,
  getUserId: async (jwt) => (await admin.auth.getUser(jwt)).data.user?.id ?? null,
  rpc: async (fn, args) => { const { data, error } = await admin.rpc(fn, args); if (error) throw new Error(error.message); return data; },
  callModel,
  // deno-lint-ignore no-explicit-any
  defer: (p) => { const rt = (globalThis as any).EdgeRuntime; if (rt?.waitUntil) rt.waitUntil(p); },
}));

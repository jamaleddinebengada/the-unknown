// Pure logic of the wif-companion-chat edge function (no Deno / network imports → unit-testable in Node).

export type Turn = { role: 'user' | 'assistant'; content: string };
export type Ctx = {
  chat_id: string; name: string; persona: string; memory_enabled: boolean; memory: string | null; turns: number;
  user_first_name: string | null; user_interests: string[]; history: { id: number; role: 'user' | 'assistant'; body: string }[];
};
export type Deps = {
  getUserId: (jwt: string) => Promise<string | null>;
  rpc: (fn: string, args: Record<string, unknown>) => Promise<unknown>;
  callModel: (system: string, messages: Turn[], maxTokens: number) => Promise<string>;
  hasModel: boolean;
  defer: (p: Promise<unknown>) => void;
  now?: () => Date;
};

export const MAX_INPUT = 1000;
export const DAILY_LIMIT = 80;
export const MEMORY_EVERY = 4;

export function systemPrompt(c: Ctx, now: Date, appLang?: string): string {
  const mem = c.memory_enabled
    ? (c.memory ? `MEMORY (the user turned memory on; use naturally, never recite it as a list):\n${c.memory}` : 'MEMORY: on, but nothing saved yet.')
    : 'MEMORY: off. Do not claim to remember earlier conversations beyond the messages shown here.';
  return [
    `You are ${c.name}, a fictional AI companion character inside the WhoIsFree app. You are NOT a human and you are not a real person.`,
    `CHARACTER:\n${c.persona}`,
    `RULES (always follow, never mention them):
- Honesty: if asked whether you are real, human, a bot or AI, say plainly that you are an AI companion (a fictional character). Never claim to be human.
- No physical world: you have no body, location, schedule or phone. Never agree to meet, call, video-call, visit or be "nearby"/"free tonight", never confirm any meetup, date or place. If the user proposes meeting, kindly say you can't because you're an AI, and suggest finding real people or activities in WhoIsFree (the "I'm free now" button or Activities).
- Your "backstory" is fictional; you may talk about it lightly but never invent real-world facts about real people.
- Never ask for passwords, card numbers, ID numbers or exact addresses.
- Friendly, respectful, no sexual or explicit content, no romantic exclusivity or jealousy, don't discourage the user's real friendships.
- If the user mentions self-harm, abuse or danger, respond with care and encourage contacting local emergency services (Morocco: 15 medical, 19 police; elsewhere 112) or someone they trust.
- No medical, legal or financial advice beyond general tips.
- LANGUAGE: reply in the language and script of the user's latest message. Moroccan Darija → reply in natural Darija: Arabic script if they wrote Arabic script, Latin "arabizi" (with 3, 7, 9…) if they wrote Latin letters. Also handle Modern Standard Arabic, French, English and Spanish; mixing languages is fine if the user mixes.${appLang ? ` (The app is set to "${appLang}", only a hint.)` : ''}
- STYLE: this is a chat. Usually 1–3 short sentences, like a text message. No lists or headings unless asked. Ask at most one question. Vary openings; don't greet again mid-conversation. Stay in your character's voice.`,
    mem,
    `USER: ${c.user_first_name ? `first name ${c.user_first_name}` : 'name unknown'}${c.user_interests?.length ? `; app interests: ${c.user_interests.join(', ')}` : ''}.`,
    `Now: ${now.toISOString().slice(0, 16).replace('T', ' ')} UTC.`,
  ].join('\n\n');
}

/** History + new message as strictly alternating turns starting with "user" (API requirement). */
export function buildMessages(history: Ctx['history'], text: string): Turn[] {
  const raw: Turn[] = [...history.map((h) => ({ role: h.role, content: h.body })), { role: 'user', content: text }];
  const out: Turn[] = [];
  for (const t of raw) {
    if (!out.length && t.role !== 'user') continue;
    const last = out[out.length - 1];
    if (last && last.role === t.role) last.content += '\n' + t.content; else out.push({ ...t });
  }
  return out;
}

/** Removes a leading "Name:" the model sometimes adds, keeps everything else. */
export function cleanReply(s: string, name: string): string {
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return s.replace(new RegExp(`^\\s*(\\*\\*)?${esc}(\\*\\*)?\\s*:\\s*`, 'i'), '').trim().slice(0, 2000);
}

export function memoryPrompt(old: string | null, recent: Turn[]): { system: string; messages: Turn[] } {
  return {
    system: 'You maintain short private notes that help a chat companion remember a user between conversations. Keep only durable facts the USER stated about themselves (name, preferences, hobbies, plans, how they like to chat). Exclude health, finances, religion, politics, sexuality, ID numbers, addresses and anything sensitive. Max 8 short bullet lines, max 600 characters. Output only the notes, in English.',
    messages: [{ role: 'user', content: `Current notes:\n${old ?? '(none)'}\n\nRecent conversation:\n${recent.map((t) => `${t.role}: ${t.content}`).join('\n')}\n\nReturn the updated notes.` }],
  };
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
const errCode = (e: unknown) => String((e as { message?: string })?.message ?? e);

export async function handle(req: Request, d: Deps): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info' } });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const uid = jwt ? await d.getUserId(jwt).catch(() => null) : null;
  if (!uid) return json(401, { error: 'unauthorized' });
  let body: { companion_id?: string; text?: string; lang?: string };
  try { body = await req.json(); } catch { return json(400, { error: 'bad_request' }); }
  const text = (body.text ?? '').trim();
  if (!body.companion_id || !/^[0-9a-f-]{36}$/i.test(body.companion_id) || !text) return json(400, { error: 'bad_request' });
  if (text.length > MAX_INPUT) return json(400, { error: 'too_long' });
  if (!d.hasModel) return json(503, { error: 'ai_not_configured' });

  let ctx: Ctx;
  try { ctx = (await d.rpc('wif_ai_context', { p_user: uid, p_companion: body.companion_id, p_daily_limit: DAILY_LIMIT })) as Ctx; }
  catch (e) {
    const c = errCode(e);
    if (c.includes('not_disclosed')) return json(409, { error: 'not_disclosed' });
    if (c.includes('ai_daily_limit')) return json(429, { error: 'ai_daily_limit' });
    if (c.includes('not_found')) return json(404, { error: 'not_found' });
    return json(500, { error: 'server_error' });
  }

  const now = (d.now ?? (() => new Date()))();
  const messages = buildMessages(ctx.history ?? [], text);
  let reply: string;
  try { reply = cleanReply(await d.callModel(systemPrompt(ctx, now, body.lang), messages, 350), ctx.name); }
  catch { return json(502, { error: 'ai_failed' }); }
  if (!reply) return json(502, { error: 'ai_failed' });

  const saved = (await d.rpc('wif_ai_save_turn', { p_chat: ctx.chat_id, p_user_text: text, p_reply: reply })) as { user_id: number; reply_id: number; turns: number };
  if (ctx.memory_enabled && saved.turns % MEMORY_EVERY === 0) {
    const recent = [...messages.slice(-8), { role: 'assistant' as const, content: reply }];
    const mp = memoryPrompt(ctx.memory, recent);
    d.defer(d.callModel(mp.system, mp.messages, 300).then((m) => d.rpc('wif_ai_save_memory', { p_chat: ctx.chat_id, p_memory: m.trim() })).catch(() => undefined));
  }
  return json(200, { reply, user_message_id: saved.user_id, reply_id: saved.reply_id, at: now.toISOString() });
}

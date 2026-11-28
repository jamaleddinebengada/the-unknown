// Runs the real edge-function handler against the local Postgres test DB (service_role), with a mocked model.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { handle, buildMessages, cleanReply, systemPrompt, type Deps, type Turn } from '../supabase/functions/wif-companion-chat/logic.ts';

const PG = ['-h', '/tmp', '-p', '54329', '-U', 'postgres', '-qAt', '-v', 'ON_ERROR_STOP=1'];
const sql = (q: string) => execFileSync('psql', [...PG, '-c', q], { encoding: 'utf8' }).trim();
const lit = (v: unknown) => v === null ? 'null' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`;
const U1 = 'aaaaaaaa-0000-0000-0000-000000000001', U3 = 'aaaaaaaa-0000-0000-0000-000000000003';
const asUser = (uid: string, q: string) => sql(`set role authenticated; set request.jwt.claim.sub = '${uid}'; ${q}`).split('\n').pop()!;

function deps(calls: { system: string; messages: Turn[] }[], replies: string[], deferred: Promise<unknown>[], hasModel = true): Deps {
  return {
    hasModel,
    getUserId: async (jwt) => ({ tok1: U1, tok3: U3 } as Record<string, string>)[jwt] ?? null,
    rpc: async (fn, args) => {
      const sig: Record<string, string[]> = { wif_ai_context: ['p_user::uuid', 'p_companion::uuid', 'p_daily_limit'], wif_ai_save_turn: ['p_chat::uuid', 'p_user_text', 'p_reply'], wif_ai_save_memory: ['p_chat::uuid', 'p_memory'] };
      const params = sig[fn].map((p) => { const [k, cast] = p.split('::'); return lit(args[k]) + (cast ? `::${cast}` : ''); }).join(', ');
      try { const out = sql(`set role service_role; select ${fn}(${params})`); return out ? JSON.parse(out.split('\n').pop()!) : null; }
      catch (e) { throw new Error(String((e as Error).message).match(/ERROR:\s+(\w+)/)?.[1] ?? 'db_error'); }
    },
    callModel: async (system, messages) => { calls.push({ system, messages }); return replies.shift() ?? 'ok'; },
    defer: (p) => { deferred.push(p); },
    now: () => new Date('2026-11-28T18:00:00Z'),
  };
}
const post = (tok: string | null, body: unknown) => new Request('http://x/fn', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: `Bearer ${tok}` } : {}) }, body: JSON.stringify(body) });

const cid = asUser(U1, `select x->>'id' from wif_companions('en') x limit 1`);
const name = asUser(U1, `select (wif_companion('${cid}'))->>'name'`);

test('rejects missing auth, bad input, unconfigured AI', async () => {
  const c: never[] = [];
  assert.equal((await handle(post(null, { companion_id: cid, text: 'hi' }), deps(c, [], []))).status, 401);
  assert.equal((await handle(post('tok1', { companion_id: 'x', text: 'hi' }), deps(c, [], []))).status, 400);
  assert.equal((await handle(post('tok1', { companion_id: cid, text: 'a'.repeat(1001) }), deps(c, [], []))).status, 400);
  const r = await handle(post('tok1', { companion_id: cid, text: 'hi' }), deps(c, [], [], false));
  assert.equal(r.status, 503); assert.equal((await r.json()).error, 'ai_not_configured');
});

test('no reply before the AI disclosure was accepted', async () => {
  const r = await handle(post('tok3', { companion_id: cid, text: 'salam' }), deps([], [], []));
  assert.equal(r.status, 409); assert.equal((await r.json()).error, 'not_disclosed');
});

test('full conversation: Darija, French, persona, history, memory', async () => {
  asUser(U1, `select wif_companion_start('${cid}', true)`);
  asUser(U1, `select wif_companion_clear('${cid}')`); sql(`delete from wif_ai_usage`);
  const calls: { system: string; messages: Turn[] }[] = []; const deferred: Promise<unknown>[] = [];
  const replies = [`${name}: Labas 3lik! Ach katdir lyoum?`, 'Ah zwin, l9ahwa dima mzyana ☕', 'Ça marche, et toi ?', "I'm an AI companion, so I can't meet — but tap “I'm free now” to find real people nearby!", 'User: Amine. Likes coffee.'];
  const d = deps(calls, replies, deferred);
  const msgs = ['Salam, labas?', 'ana ghadi nchreb chi 9ahwa', 'On parle français ?', 'Can we meet tonight at a café?'];
  for (const m of msgs) {
    const r = await handle(post('tok1', { companion_id: cid, text: m, lang: 'fr' }), d);
    assert.equal(r.status, 200, await r.clone().text());
  }
  await Promise.all(deferred);
  // persona + rules + memory in system prompt
  assert.match(calls[0].system, new RegExp(`You are ${name}`));
  assert.match(calls[0].system, /NOT a human/);
  assert.match(calls[0].system, /Never agree to meet/);
  assert.match(calls[0].system, /Darija/);
  assert.match(calls[0].system, /first name Amine/);
  assert.match(calls[0].system, /MEMORY: on, but nothing saved yet/);
  // history is passed back, alternating and ordered
  const last = calls[3].messages;
  assert.equal(last.length, 7); assert.equal(last[0].content, 'Salam, labas?'); assert.equal(last[6].content, 'Can we meet tonight at a café?');
  assert.ok(last.every((t, i) => t.role === (i % 2 ? 'assistant' : 'user')));
  // name prefix stripped, saved in DB in order
  const hist = JSON.parse(asUser(U1, `select json_agg(x order by (x->>'id')::bigint) from wif_companion_messages('${cid}') x`));
  assert.equal(hist.length, 8);
  assert.equal(hist[1].body, 'Labas 3lik! Ach katdir lyoum?');
  assert.equal(hist[6].body, 'Can we meet tonight at a café?');
  // memory summarised after 4 turns
  assert.equal(calls.length, 5); assert.match(calls[4].system, /private notes/);
  assert.equal(asUser(U1, `select (wif_companion('${cid}'))->'chat'->>'has_memory'`), 'true');
  // next request includes memory
  await handle(post('tok1', { companion_id: cid, text: 'tfakarti smiti?' }), d);
  assert.match(calls[5].system, /User: Amine\. Likes coffee\./);
});

test('memory off: no summary, prompt says off', async () => {
  asUser(U1, `select wif_companion_set_memory('${cid}', false)`);
  const calls: { system: string; messages: Turn[] }[] = []; const deferred: Promise<unknown>[] = [];
  const d = deps(calls, ['a', 'b', 'c', 'd', 'e'], deferred);
  for (let i = 0; i < 4; i++) await handle(post('tok1', { companion_id: cid, text: `m${i}` }), d);
  assert.equal(deferred.length, 0);
  assert.match(calls[0].system, /MEMORY: off/);
});

test('model failure → 502 and nothing saved', async () => {
  const before = asUser(U1, `select count(*) from wif_companion_messages('${cid}', null, 100)`);
  const d = deps([], [], []); d.callModel = async () => { throw new Error('boom'); };
  assert.equal((await handle(post('tok1', { companion_id: cid, text: 'hello?' }), d)).status, 502);
  assert.equal(asUser(U1, `select count(*) from wif_companion_messages('${cid}', null, 100)`), before);
});

test('daily limit → 429', async () => {
  sql(`update wif_ai_usage set n = 80`);
  assert.equal((await handle(post('tok1', { companion_id: cid, text: 'x' }), deps([], [], []))).status, 429);
  sql(`update wif_ai_usage set n = 0`);
});

test('helpers', () => {
  assert.deepEqual(buildMessages([{ id: 1, role: 'assistant', body: 'orphan' }, { id: 2, role: 'user', body: 'a' }, { id: 3, role: 'user', body: 'b' }], 'c').map((t) => t.content), ['a\nb\nc']);
  assert.equal(cleanReply('Salma: hi', 'Salma'), 'hi');
  assert.equal(cleanReply('Fun fact: octopuses have 3 hearts', 'Salma'), 'Fun fact: octopuses have 3 hearts');
  assert.match(systemPrompt({ chat_id: '', name: 'X', persona: 'p', memory_enabled: false, memory: null, turns: 0, user_first_name: null, user_interests: [], history: [] }, new Date()), /name unknown/);
});

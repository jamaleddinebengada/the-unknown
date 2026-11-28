import { FunctionsHttpError } from '@supabase/supabase-js';
import { getLanguage } from '@/i18n';
import { supabase } from '@/lib/supabase';
import type { AvatarSpec } from './art';

export type CompanionCard = {
  id: string; kind: 'ai'; name: string; age: number; gender: 'female' | 'male'; occupation: string; tagline: string;
  traits: string[]; interests: string[]; languages: string[]; avatar: AvatarSpec; portrait_path: string | null;
  cover: { scene: string; emoji: string; bg: string[] } | null; chatting: boolean;
};
export type CompanionPhoto = { scene: string; emoji: string; bg: string[]; caption: string };
export type Companion = CompanionCard & { bio: string; photos: CompanionPhoto[]; chat: { id: string; disclosed_at: string; memory_enabled: boolean; has_memory: boolean; turns: number } | null };
export type AiMessage = { id: number | string; role: 'user' | 'assistant'; body: string; created_at: string; pending?: boolean; failed?: boolean };
export type AiThread = { id: string; kind: 'ai'; name: string; avatar: AvatarSpec; portrait_path: string | null; occupation: string; last_at: string; last: { role: string; body: string } | null };

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}
const lang = () => getLanguage();

export const listCompanions = (o: { interest?: string | null; gender?: 'female' | 'male' | null; offset?: number; limit?: number } = {}) =>
  rpc<CompanionCard[]>('wif_companions', { p_lang: lang(), p_interest: o.interest ?? null, p_gender: o.gender ?? null, p_offset: o.offset ?? 0, p_limit: o.limit ?? 30 });
export const getCompanion = (id: string) => rpc<Companion>('wif_companion', { p_id: id, p_lang: lang() });
/** Call only after the user accepted the AI disclosure. */
export const startCompanionChat = (id: string, memory: boolean) => rpc<string>('wif_companion_start', { p_id: id, p_memory: memory });
export const companionMessages = async (id: string, before?: number) =>
  (await rpc<AiMessage[]>('wif_companion_messages', { p_id: id, p_before: before ?? null, p_limit: 40 })).reverse();
export const setCompanionMemory = (id: string, on: boolean) => rpc<void>('wif_companion_set_memory', { p_id: id, p_enabled: on });
export const clearCompanionChat = (id: string) => rpc<void>('wif_companion_clear', { p_id: id });
export const companionInbox = () => rpc<AiThread[]>('wif_companion_inbox', { p_lang: lang() });

export class AiError extends Error { constructor(public code: string) { super(code); } }

/** Sends a message; resolves when the AI reply has actually been generated and saved. */
export async function sendToCompanion(id: string, text: string): Promise<{ reply: string; user_message_id: number; reply_id: number; at: string }> {
  const { data, error } = await supabase.functions.invoke('wif-companion-chat', { body: { companion_id: id, text, lang: lang() } });
  if (error) {
    let code = 'ai_failed';
    if (error instanceof FunctionsHttpError) { try { code = (await error.context.json()).error ?? code; } catch { /* keep */ } }
    else if (/fetch|network/i.test(error.message)) code = 'offline';
    throw new AiError(code);
  }
  return data;
}

export const LANG_LABEL: Record<string, string> = { ary: 'Darija', ar: 'العربية', fr: 'Français', en: 'English', es: 'Español' };

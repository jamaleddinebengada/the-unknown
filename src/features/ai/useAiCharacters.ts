import { useEffect, useState } from 'react';
import { getAiCharacters, type AiCharacter } from '@/services/api';

let cache: AiCharacter[] | null = null;
let pending: Promise<AiCharacter[]> | null = null;

/** The fictional AI characters (cached for the session). */
export function useAiCharacters() {
  const [list, setList] = useState<AiCharacter[] | null>(cache);
  const [error, setError] = useState<string | null>(null);
  const load = (fresh = false) => {
    setError(null);
    if (fresh) cache = null;
    pending = pending ?? getAiCharacters().finally(() => { pending = null; });
    pending.then((l) => { cache = l; setList(l); }).catch((e) => setError(String(e?.message ?? e)));
  };
  useEffect(() => { if (!cache) load(); }, []);
  return { list, error, reload: () => load(), refresh: () => load(true) };
}
export const LANG_LABEL: Record<string, string> = { en: 'English', fr: 'Français', ar: 'العربية', es: 'Español' };

/** "Gentle, imaginative, curious about…" → ["Gentle", "Imaginative"] */
export const traitsOf = (personality: string) => personality.split(/[,;.]| and /).map((x) => x.trim().split(' ').slice(0, 2).join(' ')).filter((x) => x && x.length <= 18).map((x) => x[0].toUpperCase() + x.slice(1));

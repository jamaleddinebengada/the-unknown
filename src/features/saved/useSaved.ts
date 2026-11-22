import { useEffect, useState } from 'react';
import { getMySavedIds, toggleSavedPost } from '@/services/api';

/** Saved favorites (a PLUS feature, enforced by the server). One shared set for every card. */
let ids: Set<string> | null = null;
let loading: Promise<void> | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

function load() {
  if (!loading) loading = getMySavedIds().then((s) => { ids = s; emit(); }).catch(() => { ids = new Set(); }).finally(() => { loading = null; });
  return loading;
}

export function useSaved(postId: string) {
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force((n) => n + 1);
    subs.add(f);
    if (!ids) load();
    return () => { subs.delete(f); };
  }, []);
  return !!ids?.has(postId);
}

/** Returns the new saved state. Throws `plus_required` for free members. */
export async function toggleSaved(postId: string) {
  const on = await toggleSavedPost(postId);
  if (!ids) ids = new Set();
  if (on) ids.add(postId); else ids.delete(postId);
  emit();
  return on;
}
export const resetSaved = () => { ids = null; };

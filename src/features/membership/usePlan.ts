import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { getMyPlan } from '@/services/api';
import type { Plan } from '@/types/models';

let cached: Plan | null = null;
const subs = new Set<(p: Plan | null) => void>();

export async function refreshPlan() {
  try { cached = await getMyPlan(); } catch { /* keep last */ }
  subs.forEach((f) => f(cached));
  return cached;
}

/** Current membership (tier, daily limits, renewal) — always read from the server. */
export function usePlan() {
  const [plan, setPlan] = useState<Plan | null>(cached);
  useEffect(() => { subs.add(setPlan); return () => { subs.delete(setPlan); }; }, []);
  useFocusEffect(useCallback(() => { refreshPlan(); }, []));
  return plan;
}

export const TIER_LABEL = { free: 'Free', plus: 'Plus', vip: 'VIP' } as const;

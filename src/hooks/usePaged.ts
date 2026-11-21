import { useCallback, useEffect, useRef, useState } from 'react';
import { friendlyError, isSupabaseConfigured } from '@/lib/supabase';
import { PAGE_SIZE } from '@/services/api';

/** Offset pagination with de-duplication, pull-to-refresh and error state. */
export function usePaged<T extends { id: string }>(fetchPage: (offset: number) => Promise<T[]>, key: string) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const offset = useRef(0);
  const req = useRef(0);
  const fetchRef = useRef(fetchPage);
  useEffect(() => { fetchRef.current = fetchPage; });

  const load = useCallback(async (mode: 'initial' | 'refresh' | 'more') => {
    if (!isSupabaseConfigured) { setLoading(false); setError(friendlyError(null)); return; }
    const id = ++req.current;
    if (mode === 'more') setLoadingMore(true);
    if (mode === 'refresh') setRefreshing(true);
    if (mode === 'initial') { setLoading(true); setItems([]); setDone(false); }
    const from = mode === 'more' ? offset.current : 0;
    try {
      const page = await fetchRef.current(from);
      if (id !== req.current) return;
      offset.current = from + page.length;
      setDone(page.length < PAGE_SIZE);
      setItems((prev) => {
        if (mode !== 'more') return page;
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...page.filter((p) => !seen.has(p.id))];
      });
      setError(null);
    } catch (e) {
      if (id === req.current) setError(friendlyError(e));
    } finally {
      if (id === req.current) { setLoading(false); setRefreshing(false); setLoadingMore(false); }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => { load('initial'); }, [load]);

  return {
    items, setItems, loading, refreshing, loadingMore, done, error,
    refresh: () => load('refresh'),
    retry: () => load('initial'),
    loadMore: () => { if (!done && !loadingMore && !loading) load('more'); },
    update: (item: T) => setItems((prev) => prev.map((p) => (p.id === item.id ? item : p))),
    remove: (id: string) => setItems((prev) => prev.filter((p) => p.id !== id)),
  };
}

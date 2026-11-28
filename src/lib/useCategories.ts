import { useEffect, useMemo, useState } from 'react';
import { getCategories } from './api';
import type { Category } from './types';

/** Activity categories (admin-editable on the server), cached for the session. */
export function useCategories() {
  const [list, setList] = useState<Category[]>([]);
  useEffect(() => { getCategories().then(setList).catch(() => {}); }, []);
  const map = useMemo(() => new Map(list.map((c) => [c.id, c])), [list]);
  return { list, map };
}

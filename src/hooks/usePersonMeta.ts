import { useEffect, useState } from 'react';
import { requestMeta, subscribeMeta, type PersonMeta } from '@/services/photos';

/** Photo (if the owner allows it), tier and theme for an anonymous member number. */
export function usePersonMeta(n?: number | null): PersonMeta | null {
  const [meta, setMeta] = useState<PersonMeta | null>(() => (n ? requestMeta(n) : null));
  useEffect(() => {
    if (!n) { setMeta(null); return; }
    setMeta(requestMeta(n));
    return subscribeMeta(() => setMeta(requestMeta(n)));
  }, [n]);
  return meta;
}

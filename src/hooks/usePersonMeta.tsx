import { useEffect, useState } from 'react';
import { unknownName } from '@/utils/format';
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

/** The member's chosen display name, or "UNKNOWN #number" when they have none (or stay anonymous). */
export function usePersonName(n?: number | null): string {
  const meta = usePersonMeta(n);
  return meta?.name?.trim() || unknownName(n);
}
/** Inline text node — usable inside <Text>. */
export function PersonName({ number }: { number?: number | null }) {
  return usePersonName(number);
}

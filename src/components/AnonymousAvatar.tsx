import { memo } from 'react';
import { PersonAvatar } from './PersonAvatar';

/** Avatar for a member: real photo when they allow you to see it, otherwise the anonymous mask. */
export const AnonymousAvatar = memo(function AnonymousAvatar({ seed, size = 42, number, online }: { seed: string; size?: number; revealed?: boolean; number?: number | null; online?: boolean }) {
  return <PersonAvatar seed={seed || 'unknown'} number={number} size={size} ring={size >= 34} online={online} />;
});

import { memo } from 'react';
import { EmojiAvatar } from './Illustrations3D';

/**
 * Anonymous identity avatar: a playful 3D-style character picked deterministically from the
 * user's random avatar seed. Same seed → same character, so strangers stay recognisable
 * across the app without revealing who they really are.
 */
export const AnonymousAvatar = memo(function AnonymousAvatar({ seed, size = 42 }: { seed: string; size?: number; revealed?: boolean }) {
  return <EmojiAvatar seed={seed || 'unknown'} size={size} ring={size >= 34} />;
});

import { createAvatar } from '@dicebear/core';
import * as personas from '@dicebear/personas';
import { memo, useMemo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { seeded } from '@/utils/format';

/**
 * Illustrated people (women & men) generated locally from a seed.
 * Artwork: "Personas" by Draftbit (https://personas.draftbit.com) — CC BY 4.0, via DiceBear (MIT).
 * Same seed → same character, so anonymous users stay recognisable without revealing anything real.
 */
export type CharacterGender = 'woman' | 'man' | 'any';

const WOMAN_HAIR = ['long', 'bobCut', 'curly', 'pigtails', 'curlyBun', 'bobBangs', 'straightBun', 'extraLong'] as const;
const MAN_HAIR = ['shortCombover', 'curlyHighTop', 'fade', 'shortComboverChops', 'sideShave', 'cap', 'buzzcut'] as const;
const BACKGROUNDS = ['ffd5dc', 'c0aede', 'd1d4f9', 'b6e3f4', 'ffdfbf', 'c7f9e0'];

/** Gender used when the person did not choose one: derived from the seed so it is stable. */
export function genderFor(seed: string, gender?: string | null): 'woman' | 'man' {
  if (gender === 'woman' || gender === 'man') return gender;
  return seeded(`g:${seed}`)() < 0.5 ? 'woman' : 'man';
}

export function characterSvg(seed: string, gender: 'woman' | 'man', background = true) {
  const r = seeded(`c:${seed}`);
  const pick = <T,>(arr: readonly T[]) => arr[Math.floor(r() * arr.length)];
  return createAvatar(personas, {
    seed,
    hair: [pick(gender === 'woman' ? WOMAN_HAIR : MAN_HAIR)] as never,
    facialHairProbability: gender === 'man' ? 35 : 0,
    mouth: [pick(['smile', 'bigSmile', 'smirk', 'lips'] as const)] as never,
    eyes: [pick(['open', 'happy', 'glasses', 'wink'] as const)] as never,
    hairColor: [pick(['362c47', '6c4545', 'e15c66', 'f27d65', 'f29c65', '362c47', '6c4545'] as const)] as never,
    backgroundColor: background ? [pick(BACKGROUNDS)] : undefined,
    radius: 50,
  }).toString();
}

export const Character = memo(function Character({ seed, size = 44, gender, background = true, style }: {
  seed: string; size?: number; gender?: string | null; background?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const xml = useMemo(() => characterSvg(seed || 'unknown', genderFor(seed || 'unknown', gender), background), [seed, gender, background]);
  return (
    <View style={[{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }, style]}>
      <SvgXml xml={xml} width={size} height={size} />
    </View>
  );
});

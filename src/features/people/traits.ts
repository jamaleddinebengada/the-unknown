import type { Ionicons } from '@expo/vector-icons';

/** Optional profile characteristics (stored on profiles, returned as person.traits). */
export interface Traits { height_cm?: number; zodiac?: string; job?: string; education?: string; smoking?: string; drinking?: string; exercise?: string; pets?: string }
type Icon = keyof typeof Ionicons.glyphMap;
type Opt = { key: string; label: string };

export const ZODIAC: Opt[] = [
  ['aries', '♈ Aries'], ['taurus', '♉ Taurus'], ['gemini', '♊ Gemini'], ['cancer', '♋ Cancer'], ['leo', '♌ Leo'], ['virgo', '♍ Virgo'],
  ['libra', '♎ Libra'], ['scorpio', '♏ Scorpio'], ['sagittarius', '♐ Sagittarius'], ['capricorn', '♑ Capricorn'], ['aquarius', '♒ Aquarius'], ['pisces', '♓ Pisces'],
].map(([key, label]) => ({ key, label }));
export const EDUCATION: Opt[] = [
  { key: 'high_school', label: 'High school' }, { key: 'college', label: 'College' }, { key: 'bachelor', label: 'Bachelor' },
  { key: 'master', label: 'Master' }, { key: 'doctorate', label: 'Doctorate' }, { key: 'other', label: 'Other' },
];
export const SMOKING: Opt[] = [{ key: 'never', label: 'Non-smoker' }, { key: 'sometimes', label: 'Smokes sometimes' }, { key: 'regularly', label: 'Smoker' }];
export const DRINKING: Opt[] = [{ key: 'never', label: 'Doesn’t drink' }, { key: 'socially', label: 'Drinks socially' }, { key: 'regularly', label: 'Drinks often' }];
export const EXERCISE: Opt[] = [{ key: 'never', label: 'Rarely active' }, { key: 'sometimes', label: 'Active sometimes' }, { key: 'often', label: 'Active often' }, { key: 'daily', label: 'Works out daily' }];
export const PETS: Opt[] = [{ key: 'none', label: 'No pets' }, { key: 'cat', label: 'Cat person' }, { key: 'dog', label: 'Dog person' }, { key: 'other', label: 'Has pets' }, { key: 'want', label: 'Wants a pet' }];

const lab = (opts: Opt[], k?: string) => opts.find((o) => o.key === k)?.label;

/** Icon + text rows for a profile's characteristics, in display order. */
export function traitRows(t?: Traits | null): { icon: Icon; label: string; key: string }[] {
  if (!t) return [];
  const rows: { icon: Icon; label: string | undefined; key: string }[] = [
    { key: 'job', icon: 'briefcase-outline', label: t.job },
    { key: 'education', icon: 'school-outline', label: lab(EDUCATION, t.education) },
    { key: 'height', icon: 'resize-outline', label: t.height_cm ? `${t.height_cm} cm` : undefined },
    { key: 'zodiac', icon: 'sparkles-outline', label: lab(ZODIAC, t.zodiac) },
    { key: 'exercise', icon: 'barbell-outline', label: lab(EXERCISE, t.exercise) },
    { key: 'smoking', icon: 'leaf-outline', label: lab(SMOKING, t.smoking) },
    { key: 'drinking', icon: 'wine-outline', label: lab(DRINKING, t.drinking) },
    { key: 'pets', icon: 'paw-outline', label: lab(PETS, t.pets) },
  ];
  return rows.filter((r): r is { icon: Icon; label: string; key: string } => !!r.label);
}

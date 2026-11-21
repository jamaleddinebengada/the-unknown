import { Platform } from 'react-native';

export const colors = {
  bg: '#0B0F28',
  bgSecondary: '#11163A',
  card: '#181F4A',
  elevated: '#222A5C',
  hairline: 'rgba(248,250,252,0.06)',
  hairlineStrong: 'rgba(248,250,252,0.12)',

  violet: '#8B5CF6',
  violetDeep: '#6D4AFF',
  violetSoft: '#A78BFA',
  blue: '#38BDF8',
  cyan: '#67E8F9',

  text: '#F8FAFC',
  textSecondary: '#9CA3AF',
  textMuted: '#64748B',

  success: '#34D399',
  warning: '#FBBF24',
  danger: '#FB7185',

  overlay: 'rgba(5,6,12,0.72)',
  violetGlow: 'rgba(139,92,246,0.35)',
  violetTint: 'rgba(139,92,246,0.14)',
  blueTint: 'rgba(56,189,248,0.12)',
} as const;

export const gradients = {
  primary: ['#6D4AFF', '#A855F7'] as const,
  secondary: ['#38BDF8', '#8B5CF6'] as const,
  mystery: ['#0B0F2A', '#1A1550', '#0E1330'] as const,
  /** Headline candy gradient (pink → violet → white). */
  candy: ['#FF8AD8', '#C084FC', '#F5F3FF'] as const,
  /** Glossy pill buttons. */
  pill: ['#8B7BFF', '#6C5CFF', '#5B4BF0'] as const,
  gold: ['#FFE07A', '#FBBF24', '#F59E0B'] as const,
  cardSheen: ['rgba(139,92,246,0.16)', 'rgba(22,27,43,0)'] as const,
};

/** Accent colour per post type: used for glowing borders, tags and type badges. */
export const typeAccent: Record<string, readonly [string, string]> = {
  thought: ['#8B5CF6', '#38BDF8'],
  question: ['#38BDF8', '#67E8F9'],
  secret: ['#A855F7', '#FB7185'],
  story: ['#6D4AFF', '#A78BFA'],
  advice: ['#34D399', '#38BDF8'],
  debate: ['#FB7185', '#FBBF24'],
  dream: ['#A78BFA', '#67E8F9'],
  challenge: ['#FBBF24', '#FB7185'],
  travel: ['#38BDF8', '#34D399'],
  business: ['#FBBF24', '#8B5CF6'],
};

export const glass = {
  fill: ['rgba(32,38,64,0.72)', 'rgba(18,22,38,0.78)'] as const,
  border: ['rgba(167,139,250,0.55)', 'rgba(56,189,248,0.18)', 'rgba(255,255,255,0.04)'] as const,
  highlight: 'rgba(255,255,255,0.06)',
};

export const spacing = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 20, xl: 24, xxl: 32, xxxl: 48 } as const;
export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 } as const;

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
  /** Rounded, playful display face for headlines, buttons and game UI. */
  display: 'Fredoka_700Bold',
  displaySemi: 'Fredoka_600SemiBold',
} as const;

export const type = {
  display: { fontFamily: 'Fredoka_700Bold', fontSize: 36, lineHeight: 42, letterSpacing: 0 },
  game: { fontFamily: 'Fredoka_700Bold', fontSize: 18, lineHeight: 23, letterSpacing: 0.3 },
  screenTitle: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 34, letterSpacing: -0.5 },
  section: { fontFamily: fonts.semibold, fontSize: 21, lineHeight: 27, letterSpacing: -0.3 },
  cardTitle: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 23 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 22 },
  caption: { fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 17 },
  overline: { fontFamily: fonts.semibold, fontSize: 11.5, lineHeight: 15, letterSpacing: 2 },
} as const;

export const shadow = Platform.select({
  ios: { shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } },
  android: { elevation: 6 },
  default: {},
});

export const glow = (color: string = colors.violet) =>
  Platform.select({
    ios: { shadowColor: color, shadowOpacity: 0.55, shadowRadius: 16, shadowOffset: { width: 0, height: 0 } },
    android: { elevation: 10, shadowColor: color },
    default: { boxShadow: `0 0 24px ${color}66` } as object,
  });

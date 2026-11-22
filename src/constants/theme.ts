import { Platform } from 'react-native';

/**
 * THE UNKNOWN — premium identity.
 * Warm ivory & blush backgrounds, rose pink + plum purple, champagne gold accents.
 * (Legacy key names such as `violet` are kept so every screen picks up the new palette.)
 */
export const colors = {
  bg: '#FFF7F3',
  bgSecondary: '#FFFFFF',
  card: '#FFFFFF',
  elevated: '#FCEEF3',
  blush: '#FBE4EC',
  ivory: '#FFFBF6',
  hairline: 'rgba(74,20,64,0.07)',
  hairlineStrong: 'rgba(74,20,64,0.13)',
  white: '#FFFFFF',
  surface: 'rgba(255,255,255,0.9)',
  surfaceBorder: 'rgba(176,58,140,0.14)',

  /** plum family */
  violet: '#A3288E',
  violetDeep: '#7B1E74',
  violetSoft: '#C77DB8',
  plum: '#6B1A68',
  /** rose family */
  rose: '#E2508A',
  roseSoft: '#F7B7CF',
  /** champagne gold */
  gold: '#C9974A',
  goldSoft: '#F3E2BC',

  blue: '#5B8DEF',
  cyan: '#62C4D9',

  text: '#2A1430',
  textSecondary: '#6F5A72',
  textMuted: '#A9939F',

  success: '#2FBF8A',
  warning: '#E0A43A',
  danger: '#E0466E',

  overlay: 'rgba(42,20,48,0.45)',
  violetGlow: 'rgba(163,40,142,0.35)',
  violetTint: 'rgba(163,40,142,0.08)',
  blueTint: 'rgba(91,141,239,0.1)',
} as const;

export const gradients = {
  primary: ['#B5309A', '#7B1E74'] as const,
  secondary: ['#E2508A', '#A3288E'] as const,
  /** page background wash */
  mystery: ['#FFFBF6', '#FDEFF2', '#F9E9F3'] as const,
  /** headline gradient (rose → plum) */
  candy: ['#E2508A', '#B5309A', '#6B1A68'] as const,
  /** the main glossy plum pill button */
  pill: ['#C13A9F', '#9B2386', '#6E1A6B'] as const,
  rose: ['#F27BA8', '#E2508A', '#C2336F'] as const,
  gold: ['#F6E3B4', '#E2BE74', '#C9974A'] as const,
  /** kept for older call sites */
  orange: ['#F27BA8', '#E2508A', '#C2336F'] as const,
  blueBtn: ['#C13A9F', '#9B2386', '#6E1A6B'] as const,
  green: ['#43D19B', '#2FBF8A', '#1F9E70'] as const,
  cardSheen: ['rgba(226,80,138,0.07)', 'rgba(255,255,255,0)'] as const,
};

/** Accent colour per post type. */
export const typeAccent: Record<string, readonly [string, string]> = {
  thought: ['#B5309A', '#E2508A'],
  question: ['#E2508A', '#F7B7CF'],
  secret: ['#6B1A68', '#B5309A'],
  story: ['#A3288E', '#C77DB8'],
  advice: ['#2FBF8A', '#62C4D9'],
  debate: ['#E0466E', '#E0A43A'],
  dream: ['#C77DB8', '#F7B7CF'],
  challenge: ['#C9974A', '#E2508A'],
  travel: ['#62C4D9', '#5B8DEF'],
  business: ['#C9974A', '#A3288E'],
};

export const glass = {
  fill: ['rgba(255,255,255,0.97)', 'rgba(255,250,252,0.95)'] as const,
  border: ['rgba(226,80,138,0.32)', 'rgba(201,151,74,0.2)', 'rgba(163,40,142,0.08)'] as const,
  highlight: 'rgba(255,255,255,0.9)',
};

export const spacing = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 20, xl: 24, xxl: 32, xxxl: 48 } as const;
export const radius = { sm: 10, md: 14, lg: 20, xl: 26, pill: 999 } as const;

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
  /** Headlines and numbers: clean, confident sans. */
  display: 'Inter_700Bold',
  displaySemi: 'Inter_600SemiBold',
  /** Brand and premium moments ("THE UNKNOWN", "Premium", levels): elegant serif. */
  serif: 'PlayfairDisplay_700Bold',
  serifSemi: 'PlayfairDisplay_600SemiBold',
  serifItalic: 'PlayfairDisplay_700Bold_Italic',
} as const;

export const type = {
  display: { fontFamily: fonts.serif, fontSize: 36, lineHeight: 44, letterSpacing: 0 },
  game: { fontFamily: fonts.bold, fontSize: 17, lineHeight: 22, letterSpacing: 0 },
  screenTitle: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 34, letterSpacing: -0.6 },
  section: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 26, letterSpacing: -0.3 },
  cardTitle: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 23 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 22 },
  caption: { fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 17 },
  overline: { fontFamily: fonts.semibold, fontSize: 11.5, lineHeight: 15, letterSpacing: 1.6 },
} as const;

export const shadow = Platform.select({
  ios: { shadowColor: '#7B1E74', shadowOpacity: 0.1, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } },
  android: { elevation: 5, shadowColor: '#7B1E74' },
  default: { boxShadow: '0 10px 28px rgba(123,30,116,0.10)' } as object,
});

export const glow = (color: string = colors.violet) =>
  Platform.select({
    ios: { shadowColor: color, shadowOpacity: 0.45, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
    android: { elevation: 8, shadowColor: color },
    default: { boxShadow: `0 8px 22px ${color}55` } as object,
  });

import { Platform } from 'react-native';

/**
 * THE UNKNOWN — Nearby social discovery.
 * Clean white & cool grey surfaces, primary blue, VIP gold, online green, like coral.
 * (Legacy key names such as `violet` are kept so every screen picks up the palette.)
 */
export const colors = {
  bg: '#F8FAFC',
  bgSecondary: '#F1F5F9',
  card: '#FFFFFF',
  elevated: '#F1F5F9',
  cream: '#F1F5F9',
  blush: '#EAF5FF',
  ivory: '#F8FAFC',
  hairline: '#EEF2F6',
  hairlineStrong: '#E2E8F0',
  border: '#E2E8F0',
  white: '#FFFFFF',
  surface: 'rgba(255,255,255,0.96)',
  surfaceBorder: '#E2E8F0',

  /** Primary blue — white text on top. */
  primary: '#168AF7',
  primaryDeep: '#0B6FD1',
  primarySoft: '#EAF5FF',
  onPrimary: '#FFFFFF',
  /** Like / heart accent. */
  coral: '#FF5277',
  coralSoft: '#FFE1E8',
  sky: '#EAF5FF',
  skyDeep: '#7DBBF5',
  /** VIP gold. */
  vip: '#FFC83D',
  online: '#22C55E',

  /* legacy names */
  violet: '#168AF7',
  violetDeep: '#172339',
  violetSoft: '#7DBBF5',
  plum: '#172339',
  rose: '#FF5277',
  roseSoft: '#FFE1E8',
  gold: '#E0A800',
  goldSoft: '#FFF3CF',

  blue: '#168AF7',
  cyan: '#22B8CF',

  text: '#172339',
  textSecondary: '#475569',
  textMuted: '#64748B',

  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',

  overlay: 'rgba(23,35,57,0.45)',
  violetGlow: 'rgba(22,138,247,0.35)',
  violetTint: 'rgba(22,138,247,0.10)',
  blueTint: 'rgba(22,138,247,0.10)',
} as const;

export const gradients = {
  primary: ['#3BA0FF', '#168AF7'] as const,
  secondary: ['#FF7A95', '#FF5277'] as const,
  mystery: ['#F8FAFC', '#F8FAFC', '#F1F5F9'] as const,
  candy: ['#3BA0FF', '#168AF7', '#0B6FD1'] as const,
  /** main button: primary blue (white label) */
  pill: ['#3BA0FF', '#168AF7', '#0B6FD1'] as const,
  rose: ['#FF7A95', '#FF5277', '#F0365F'] as const,
  gold: ['#FFE08A', '#FFC83D', '#F5B100'] as const,
  orange: ['#FF7A95', '#FF5277', '#F0365F'] as const,
  blueBtn: ['#3BA0FF', '#168AF7', '#0B6FD1'] as const,
  green: ['#4ADE80', '#22C55E', '#16A34A'] as const,
  sky: ['#F5FAFF', '#EAF5FF'] as const,
  cardSheen: ['rgba(22,138,247,0.06)', 'rgba(255,255,255,0)'] as const,
};

/** Accent colour per post type. */
export const typeAccent: Record<string, readonly [string, string]> = {
  thought: ['#168AF7', '#7DBBF5'],
  question: ['#8B5CF6', '#C4B5FD'],
  secret: ['#172339', '#64748B'],
  story: ['#FF5277', '#FF9AB0'],
  advice: ['#22C55E', '#86EFAC'],
  debate: ['#EF4444', '#FCA5A5'],
  dream: ['#22B8CF', '#A5F3FC'],
  challenge: ['#F59E0B', '#FCD34D'],
  travel: ['#0EA5E9', '#7DD3FC'],
  business: ['#E0A800', '#FFC83D'],
};

export const glass = {
  fill: ['#FFFFFF', '#FFFFFF'] as const,
  border: ['#E2E8F0', '#E2E8F0', '#E2E8F0'] as const,
  highlight: 'rgba(255,255,255,0.9)',
};

export const spacing = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 20, xl: 24, xxl: 32, xxxl: 48 } as const;
export const radius = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 } as const;

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
  /** Headlines and numbers: clean, confident sans. */
  display: 'Inter_800ExtraBold',
  displaySemi: 'Inter_700Bold',
  /** Brand and premium moments ("THE UNKNOWN", "Premium", levels): elegant serif. */
  /** editorial headlines (Inter, tight tracking) — legacy "serif" names kept for call sites */
  serif: 'Inter_800ExtraBold',
  serifSemi: 'Inter_700Bold',
  serifItalic: 'Inter_600SemiBold',
} as const;

export const type = {
  display: { fontFamily: fonts.serif, fontSize: 34, lineHeight: 40, letterSpacing: -1 },
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
  ios: { shadowColor: '#25324A', shadowOpacity: 0.08, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } },
  android: { elevation: 5, shadowColor: '#25324A' },
  default: { boxShadow: '0 10px 28px rgba(37,50,74,0.08)' } as object,
});

export const glow = (color: string = colors.violet) =>
  Platform.select({
    ios: { shadowColor: color, shadowOpacity: 0.45, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
    android: { elevation: 8, shadowColor: color },
    default: { boxShadow: `0 8px 22px ${color}55` } as object,
  });

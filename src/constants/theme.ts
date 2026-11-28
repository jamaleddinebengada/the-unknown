import { Platform } from 'react-native';

/**
 * WhoIsFree — bold yellow, premium white, navy text.
 * Clean white & cool grey surfaces, primary blue, VIP gold, online green, like coral.
 * (Legacy key names such as `violet` are kept so every screen picks up the palette.)
 */
export const colors = {
  bg: '#F7F8FA',
  bgSecondary: '#F1F3F6',
  card: '#FFFFFF',
  elevated: '#F1F3F6',
  cream: '#FFFBE8',
  blush: '#FFFBE8',
  ivory: '#FFFFFF',
  hairline: '#EEF0F3',
  hairlineStrong: '#E4E7EC',
  border: '#E4E7EC',
  white: '#FFFFFF',
  surface: 'rgba(255,255,255,0.96)',
  surfaceBorder: '#E4E7EC',

  /** Bold yellow — dark text on top. */
  primary: '#FFD600',
  primaryDeep: '#F2B800',
  primarySoft: '#FFF6C2',
  onPrimary: '#18202B',
  accent: '#4263EB',
  accentSoft: '#E7ECFF',
  lavender: '#EEE8FF',
  coral: '#FF5A5F',
  coralSoft: '#FFE4E5',
  sky: '#E7ECFF',
  skyDeep: '#8DA2F5',
  vip: '#FFB800',
  online: '#22C55E',
  live: '#22C55E',

  /* legacy names used by shared components */
  violet: '#4263EB',
  violetDeep: '#18202B',
  violetSoft: '#8DA2F5',
  plum: '#18202B',
  rose: '#FF5A5F',
  roseSoft: '#FFE4E5',
  gold: '#F2B800',
  goldSoft: '#FFF6C2',
  blue: '#4263EB',
  cyan: '#22B8CF',

  text: '#18202B',
  textSecondary: '#3F4756',
  textMuted: '#727987',

  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',

  overlay: 'rgba(24,32,43,0.45)',
  violetGlow: 'rgba(255,214,0,0.45)',
  violetTint: 'rgba(66,99,235,0.10)',
  blueTint: 'rgba(66,99,235,0.10)',
} as const;

export const gradients = {
  primary: ['#FFE24D', '#FFD600'] as const,
  secondary: ['#6C86FF', '#4263EB'] as const,
  mystery: ['#F7F8FA', '#F7F8FA', '#F1F3F6'] as const,
  candy: ['#FFE24D', '#FFD600', '#FFC400'] as const,
  /** main button: bold yellow (dark label) */
  pill: ['#FFE24D', '#FFD600', '#FFC400'] as const,
  rose: ['#FF8A8E', '#FF5A5F', '#F03E44'] as const,
  gold: ['#FFE08A', '#FFC83D', '#F5B100'] as const,
  orange: ['#FFB26B', '#FF8A3D', '#F97316'] as const,
  blueBtn: ['#6C86FF', '#4263EB', '#3150D4'] as const,
  green: ['#4ADE80', '#22C55E', '#16A34A'] as const,
  sky: ['#FFFFFF', '#FFFBE8'] as const,
  cardSheen: ['rgba(255,214,0,0.06)', 'rgba(255,255,255,0)'] as const,
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

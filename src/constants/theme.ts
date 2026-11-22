import { Platform } from 'react-native';

/**
 * THE UNKNOWN — "Sunlight Social": bold yellow premium.
 * Warm ivory & soft cream, sunshine yellow, soft coral, deep slate text. No dark surfaces.
 * (Legacy key names such as `violet` are kept so every screen picks up the new palette.)
 */
export const colors = {
  /** Warm ivory page, soft cream sections, pure white cards. */
  bg: '#FFFEFA',
  bgSecondary: '#FFF8E7',
  card: '#FFFFFF',
  elevated: '#FFF8E7',
  cream: '#FFF8E7',
  blush: '#FFF6D6',
  ivory: '#FFFEFA',
  hairline: '#F0F1F5',
  hairlineStrong: '#E8EAF0',
  border: '#E8EAF0',
  white: '#FFFFFF',
  surface: 'rgba(255,255,255,0.94)',
  surfaceBorder: '#E8EAF0',

  /** Sunshine yellow (primary) — always with slate text on top. */
  primary: '#FFD633',
  primaryDeep: '#FFC800',
  primarySoft: '#FFF1B8',
  onPrimary: '#25324A',
  /** Soft coral (secondary accent: icons, links, hearts). */
  coral: '#FF806B',
  coralSoft: '#FFD3C9',
  sky: '#EAF6FF',
  skyDeep: '#7FB8DD',

  /* legacy names, remapped so every screen follows the new identity */
  violet: '#FF806B',
  violetDeep: '#25324A',
  violetSoft: '#FFB4A4',
  plum: '#25324A',
  rose: '#FF806B',
  roseSoft: '#FFD3C9',
  gold: '#E5A800',
  goldSoft: '#FFF1B8',

  blue: '#4A9CC9',
  cyan: '#62C4D9',

  text: '#25324A',
  textSecondary: '#5E6A7E',
  /** body secondary per spec */
  textMuted: '#7C8799',

  success: '#34C98A',
  warning: '#E59A1A',
  danger: '#E5484D',

  overlay: 'rgba(37,50,74,0.4)',
  violetGlow: 'rgba(255,214,51,0.45)',
  violetTint: 'rgba(255,214,51,0.18)',
  blueTint: 'rgba(74,156,201,0.12)',
} as const;

export const gradients = {
  primary: ['#FFE266', '#FFD633'] as const,
  secondary: ['#FF9A85', '#FF806B'] as const,
  /** page background wash */
  mystery: ['#FFFEFA', '#FFFBEF', '#F7F4EA'] as const,
  candy: ['#FFB547', '#FF806B', '#F05A40'] as const,
  /** the main button: sunshine yellow (slate label) */
  pill: ['#FFE466', '#FFD633', '#F7C92B'] as const,
  rose: ['#FF9A85', '#FF806B', '#F05A40'] as const,
  gold: ['#FFF1B8', '#FFD633', '#FFC800'] as const,
  orange: ['#FF9A85', '#FF806B', '#F05A40'] as const,
  blueBtn: ['#FFE466', '#FFD633', '#F7C92B'] as const,
  green: ['#3DCB95', '#34C98A', '#17936A'] as const,
  sky: ['#EAF6FF', '#CFE8F7'] as const,
  cardSheen: ['rgba(255,214,51,0.10)', 'rgba(255,255,255,0)'] as const,
};

/** Accent colour per post type. */
export const typeAccent: Record<string, readonly [string, string]> = {
  thought: ['#FFD633', '#FFB547'],
  question: ['#4A9CC9', '#7FB8DD'],
  secret: ['#25324A', '#5E6A7E'],
  story: ['#FF806B', '#FF9A85'],
  advice: ['#34C98A', '#62C4D9'],
  debate: ['#E5484D', '#FF806B'],
  dream: ['#7FB8DD', '#CFE8F7'],
  challenge: ['#FFC800', '#FF806B'],
  travel: ['#4A9CC9', '#62C4D9'],
  business: ['#E5A800', '#25324A'],
};

export const glass = {
  fill: ['rgba(255,255,255,0.98)', 'rgba(255,254,250,0.96)'] as const,
  border: ['rgba(255,214,51,0.45)', 'rgba(255,128,107,0.15)', 'rgba(37,50,74,0.06)'] as const,
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

import { Platform } from 'react-native';

/**
 * THE UNKNOWN — bright premium identity.
 * Warm ivory & soft cream, sunshine yellow, soft coral, deep slate text. No dark surfaces.
 * (Legacy key names such as `violet` are kept so every screen picks up the new palette.)
 */
export const colors = {
  /** Warm ivory page, soft cream sections, pure white cards. */
  bg: '#FFFDF7',
  bgSecondary: '#F3F1E9',
  card: '#FFFFFF',
  elevated: '#F3F1E9',
  cream: '#F3F1E9',
  blush: '#FFF6D6',
  ivory: '#FFFDF7',
  hairline: 'rgba(36,48,71,0.07)',
  hairlineStrong: 'rgba(36,48,71,0.12)',
  white: '#FFFFFF',
  surface: 'rgba(255,255,255,0.94)',
  surfaceBorder: 'rgba(36,48,71,0.08)',

  /** Sunshine yellow (primary) — always with slate text on top. */
  primary: '#FFD83D',
  primaryDeep: '#F5C518',
  primarySoft: '#FFF1B8',
  onPrimary: '#243047',
  /** Soft coral (secondary accent: icons, links, hearts). */
  coral: '#FF775E',
  coralSoft: '#FFD3C9',
  sky: '#CFE8F7',
  skyDeep: '#7FB8DD',

  /* legacy names, remapped so every screen follows the new identity */
  violet: '#FF775E',
  violetDeep: '#243047',
  violetSoft: '#FFB4A4',
  plum: '#243047',
  rose: '#FF775E',
  roseSoft: '#FFD3C9',
  gold: '#E5A800',
  goldSoft: '#FFF1B8',

  blue: '#4A9CC9',
  cyan: '#62C4D9',

  text: '#243047',
  textSecondary: '#55627A',
  textMuted: '#8290A3',

  success: '#22B07D',
  warning: '#E59A1A',
  danger: '#E5484D',

  overlay: 'rgba(36,48,71,0.4)',
  violetGlow: 'rgba(255,216,61,0.45)',
  violetTint: 'rgba(255,216,61,0.18)',
  blueTint: 'rgba(74,156,201,0.12)',
} as const;

export const gradients = {
  primary: ['#FFE266', '#FFD83D'] as const,
  secondary: ['#FF9A85', '#FF775E'] as const,
  /** page background wash */
  mystery: ['#FFFDF7', '#FFFBEF', '#F7F4EA'] as const,
  candy: ['#FFB547', '#FF775E', '#F05A40'] as const,
  /** the main button: sunshine yellow (slate label) */
  pill: ['#FFE466', '#FFD83D', '#F7C92B'] as const,
  rose: ['#FF9A85', '#FF775E', '#F05A40'] as const,
  gold: ['#FFF1B8', '#FFD83D', '#F5C518'] as const,
  orange: ['#FF9A85', '#FF775E', '#F05A40'] as const,
  blueBtn: ['#FFE466', '#FFD83D', '#F7C92B'] as const,
  green: ['#3DCB95', '#22B07D', '#17936A'] as const,
  sky: ['#E6F4FC', '#CFE8F7'] as const,
  cardSheen: ['rgba(255,216,61,0.10)', 'rgba(255,255,255,0)'] as const,
};

/** Accent colour per post type. */
export const typeAccent: Record<string, readonly [string, string]> = {
  thought: ['#FFD83D', '#FFB547'],
  question: ['#4A9CC9', '#7FB8DD'],
  secret: ['#243047', '#55627A'],
  story: ['#FF775E', '#FF9A85'],
  advice: ['#22B07D', '#62C4D9'],
  debate: ['#E5484D', '#FF775E'],
  dream: ['#7FB8DD', '#CFE8F7'],
  challenge: ['#F5C518', '#FF775E'],
  travel: ['#4A9CC9', '#62C4D9'],
  business: ['#E5A800', '#243047'],
};

export const glass = {
  fill: ['rgba(255,255,255,0.98)', 'rgba(255,253,247,0.96)'] as const,
  border: ['rgba(255,216,61,0.45)', 'rgba(255,119,94,0.15)', 'rgba(36,48,71,0.06)'] as const,
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
  ios: { shadowColor: '#243047', shadowOpacity: 0.08, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } },
  android: { elevation: 5, shadowColor: '#243047' },
  default: { boxShadow: '0 10px 28px rgba(36,48,71,0.08)' } as object,
});

export const glow = (color: string = colors.violet) =>
  Platform.select({
    ios: { shadowColor: color, shadowOpacity: 0.45, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
    android: { elevation: 8, shadowColor: color },
    default: { boxShadow: `0 8px 22px ${color}55` } as object,
  });

import { useColorScheme as useSystemColorScheme } from 'react-native'
import { useThemeStore } from './store/theme.store'

// ── Palettes ──────────────────────────────────────────────────────────
// Both palettes share keys exactly. New tokens must be added to both.

const LIGHT_PALETTE = {
  bg:               '#FFFFFF',
  surface:          '#FFFFFF',
  surfaceElevated:  '#FAFAFA',
  surfaceHighlight: '#F2F2F7',
  border:           '#E5E5EA',

  primary:     '#F97316',
  primaryDark: '#EA580C',
  primaryFade: 'rgba(249,115,22,0.12)',

  textPrimary:   '#1C1C1E',
  textSecondary: '#6C6C70',
  textTertiary:  '#AEAEB2',
  textInverse:   '#FFFFFF',

  success:     '#22C55E',
  successFade: 'rgba(34,197,94,0.1)',
  error:       '#EF4444',
  errorFade:   'rgba(239,68,68,0.1)',
  warning:     '#F59E0B',

  overlay:     'rgba(0,0,0,0.6)',
  transparent: 'transparent',
} as const

const DARK_PALETTE: typeof LIGHT_PALETTE = {
  bg:               '#0F0F12',
  surface:          '#17171B',
  surfaceElevated:  '#1F1F24',
  surfaceHighlight: '#1F1F24',
  border:           '#2A2A30',

  primary:     '#F97316',
  primaryDark: '#FB923C',
  primaryFade: 'rgba(249,115,22,0.18)',

  textPrimary:   '#F5F5F7',
  textSecondary: '#A1A1A6',
  textTertiary:  '#6E6E73',
  textInverse:   '#0F0F12',

  success:     '#22C55E',
  successFade: 'rgba(34,197,94,0.18)',
  error:       '#F87171',
  errorFade:   'rgba(248,113,113,0.18)',
  warning:     '#FBBF24',

  overlay:     'rgba(0,0,0,0.75)',
  transparent: 'transparent',
}

// Static export — kept for legacy screens that import `COLORS` directly.
// New screens should use `useColors()` to get the active palette.
export const COLORS = LIGHT_PALETTE

// Hook returning the active palette based on user preference + system scheme.
export function useColors(): typeof LIGHT_PALETTE {
  const preference = useThemeStore((s) => s.preference)
  const systemScheme = useSystemColorScheme()
  const effective = preference === 'system' ? (systemScheme ?? 'light') : preference
  return effective === 'dark' ? DARK_PALETTE : LIGHT_PALETTE
}

export { LIGHT_PALETTE, DARK_PALETTE }

export const SPACING = {
  xs:   4,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  xxl:  24,
  xxxl: 32,
} as const

export const RADIUS = {
  xs:   6,
  sm:   10,
  md:   14,
  lg:   18,
  xl:   24,
  full: 999,
} as const

export const FONT = {
  xs:   11,
  sm:   13,
  md:   15,
  lg:   17,
  xl:   20,
  xxl:  24,
  xxxl: 30,
} as const

export const FONTS = {
  regular:   'Poppins_400Regular',
  medium:    'Poppins_500Medium',
  semibold:  'Poppins_600SemiBold',
  bold:      'Poppins_700Bold',
  extrabold: 'Poppins_800ExtraBold',
  black:     'Poppins_900Black',
} as const

export const SHADOW = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
} as const

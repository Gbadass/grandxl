export const colors = {
  // Brand
  primary: '#E84B3A',
  primaryDark: '#C73E2F',
  secondary: '#FFC107',

  // Semantic
  success: '#22C55E',
  error: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',

  // Neutrals
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray400: '#9CA3AF',
  gray600: '#4B5563',
  gray800: '#1F2937',
  gray900: '#111827',

  // Base
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
} as const

export type ColorToken = keyof typeof colors

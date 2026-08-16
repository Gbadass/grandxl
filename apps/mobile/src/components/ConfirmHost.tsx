import { useEffect, useRef } from 'react'
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useConfirmStore, type ConfirmOptions, type ConfirmVariant } from '../lib/confirm'
import { COLORS, SPACING, RADIUS, FONT, FONTS, SHADOW } from '../theme'

type IoniconsName = React.ComponentProps<typeof Ionicons>['name']

const ICONS: Record<NonNullable<ConfirmOptions['icon']>, IoniconsName> = {
  warning: 'warning-outline',
  info:    'information-circle-outline',
  check:   'checkmark-circle-outline',
  phone:   'call-outline',
  trash:   'trash-outline',
}

const VARIANT_COLORS: Record<ConfirmVariant, { bg: string; fg: string }> = {
  default:     { bg: COLORS.primary, fg: '#fff' },
  destructive: { bg: COLORS.error,   fg: '#fff' },
  success:     { bg: COLORS.success, fg: '#fff' },
}

const ICON_TINT: Record<ConfirmVariant, { bg: string; fg: string }> = {
  default:     { bg: COLORS.primaryFade, fg: COLORS.primary },
  destructive: { bg: COLORS.errorFade,   fg: COLORS.error   },
  success:     { bg: COLORS.successFade, fg: COLORS.success },
}

/**
 * Mount once at the app root. Reads from useConfirmStore and renders a single
 * confirm/alert modal. Resolves the awaiting promise on Confirm / Cancel / backdrop.
 */
export function ConfirmHost() {
  const { open, options, resolveWith } = useConfirmStore()
  const opacity = useRef(new Animated.Value(0)).current
  const scale   = useRef(new Animated.Value(0.94)).current

  useEffect(() => {
    if (open) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.spring(scale,   { toValue: 1, tension: 280, friction: 22, useNativeDriver: true }),
      ]).start()
    } else {
      opacity.setValue(0)
      scale.setValue(0.94)
    }
  }, [open, opacity, scale])

  if (!options) return null

  const variant      = options.variant ?? 'default'
  const mode         = options.mode ?? 'confirm'
  const confirmLabel = options.confirmLabel ?? (mode === 'alert' ? 'OK' : 'Confirm')
  const cancelLabel  = options.cancelLabel  ?? 'Cancel'
  const cta          = VARIANT_COLORS[variant]
  const tint         = ICON_TINT[variant]
  const iconName     = options.icon ? ICONS[options.icon] : null

  return (
    <Modal
      transparent
      visible={open}
      animationType="none"
      onRequestClose={() => resolveWith(false)}
    >
      <Animated.View style={[s.backdrop, { opacity }]} pointerEvents="auto">
        <Pressable style={StyleSheet.absoluteFill} onPress={() => resolveWith(false)} />
        <Animated.View style={[s.card, { transform: [{ scale }] }]}>
          {iconName && (
            <View style={[s.iconWrap, { backgroundColor: tint.bg }]}>
              <Ionicons name={iconName} size={28} color={tint.fg} />
            </View>
          )}

          <Text style={s.title}>{options.title}</Text>
          {options.message ? <Text style={s.message}>{options.message}</Text> : null}

          <View style={mode === 'alert' ? s.actionsSingle : s.actionsRow}>
            {mode === 'confirm' && (
              <Pressable
                style={({ pressed }) => [s.btn, s.btnCancel, pressed && s.btnPressed]}
                onPress={() => resolveWith(false)}
              >
                <Text style={s.btnCancelText}>{cancelLabel}</Text>
              </Pressable>
            )}
            <Pressable
              style={({ pressed }) => [
                s.btn,
                { backgroundColor: cta.bg },
                pressed && s.btnPressed,
              ]}
              onPress={() => resolveWith(true)}
            >
              <Text style={[s.btnConfirmText, { color: cta.fg }]}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  )
}

const s = StyleSheet.create({
  backdrop: {
    flex:            1,
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: SPACING.lg,
  },
  card: {
    width:           '100%',
    maxWidth:        380,
    backgroundColor: COLORS.bg,
    borderRadius:    RADIUS.xl,
    paddingVertical: SPACING.xxl,
    paddingHorizontal: SPACING.xl,
    alignItems:      'center',
    ...SHADOW.md,
  },
  iconWrap: {
    width:           56,
    height:          56,
    borderRadius:    28,
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    SPACING.md,
  },
  title: {
    fontSize:   FONT.lg,
    fontFamily: FONTS.bold,
    color:      COLORS.textPrimary,
    textAlign:  'center',
  },
  message: {
    marginTop:  SPACING.sm,
    fontSize:   FONT.sm,
    fontFamily: FONTS.regular,
    color:      COLORS.textSecondary,
    textAlign:  'center',
    lineHeight: FONT.sm * 1.5,
  },
  actionsRow: {
    flexDirection: 'row',
    gap:           SPACING.sm,
    marginTop:     SPACING.xl,
    alignSelf:     'stretch',
  },
  actionsSingle: {
    marginTop:     SPACING.xl,
    alignSelf:     'stretch',
  },
  btn: {
    flex:            1,
    paddingVertical: 14,
    borderRadius:    RADIUS.full,
    alignItems:      'center',
    justifyContent:  'center',
  },
  btnCancel: {
    backgroundColor: COLORS.surfaceHighlight,
  },
  btnCancelText: {
    fontSize:   FONT.md,
    fontFamily: FONTS.semibold,
    color:      COLORS.textPrimary,
  },
  btnConfirmText: {
    fontSize:   FONT.md,
    fontFamily: FONTS.bold,
  },
  btnPressed: { opacity: 0.85 },
})

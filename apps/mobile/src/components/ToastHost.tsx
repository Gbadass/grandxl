import { useEffect, useRef } from 'react'
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useToastStore, type ToastItem, type ToastVariant } from '../lib/toast'
import { SPACING, RADIUS, FONT, FONTS, SHADOW } from '../theme'

type IoniconsName = React.ComponentProps<typeof Ionicons>['name']

const VARIANT_ICON: Record<ToastVariant, IoniconsName> = {
  success: 'checkmark-circle',
  error:   'close-circle',
  warning: 'warning',
  info:    'information-circle',
}

const VARIANT_TONE: Record<ToastVariant, { bg: string; border: string; icon: string; text: string }> = {
  success: { bg: '#F0FDF4', border: '#BBF7D0', icon: '#16A34A', text: '#14532D' },
  error:   { bg: '#FEF2F2', border: '#FECACA', icon: '#DC2626', text: '#7F1D1D' },
  warning: { bg: '#FFFBEB', border: '#FDE68A', icon: '#D97706', text: '#78350F' },
  info:    { bg: '#EFF6FF', border: '#BFDBFE', icon: '#2563EB', text: '#1E3A8A' },
}

/**
 * Mount once at the app root. Renders all active toasts stacked at the top,
 * animating in/out and auto-dismissing per their duration.
 */
export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts)
  const insets = useSafeAreaInsets()

  return (
    <View
      pointerEvents="box-none"
      style={[s.container, { top: insets.top + 8 }]}
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} item={t} />
      ))}
    </View>
  )
}

function ToastCard({ item }: { item: ToastItem }) {
  const dismiss = useToastStore((s) => s.dismiss)

  const translateY = useRef(new Animated.Value(-40)).current
  const opacity    = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 220,
        friction: 18,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start()

    if (item.duration > 0) {
      const timer = setTimeout(() => animateOut(), item.duration)
      return () => clearTimeout(timer)
    }
    return undefined
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function animateOut() {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -30,
        duration: 180,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => dismiss(item.id))
  }

  const tone = VARIANT_TONE[item.variant]
  const iconName = VARIANT_ICON[item.variant]

  return (
    <Animated.View
      style={[
        s.card,
        { backgroundColor: tone.bg, borderColor: tone.border },
        { transform: [{ translateY }], opacity },
      ]}
    >
      <Pressable
        onPress={animateOut}
        style={s.cardInner}
        accessibilityRole="alert"
      >
        <Ionicons name={iconName} size={20} color={tone.icon} style={s.icon} />
        <Text
          style={[s.message, { color: tone.text }]}
          numberOfLines={3}
        >
          {item.message}
        </Text>
        {item.action && (
          <Pressable
            onPress={() => { item.action?.onPress(); animateOut() }}
            hitSlop={6}
            style={s.actionBtn}
          >
            <Text style={[s.actionText, { color: tone.icon }]}>
              {item.action.label}
            </Text>
          </Pressable>
        )}
      </Pressable>
    </Animated.View>
  )
}

const s = StyleSheet.create({
  container: {
    position:  'absolute',
    left:      SPACING.lg,
    right:     SPACING.lg,
    zIndex:    9999,
    gap:       SPACING.sm,
  },
  card: {
    borderRadius:    RADIUS.lg,
    borderWidth:     1,
    ...SHADOW.md,
  },
  cardInner: {
    flexDirection:   'row',
    alignItems:      'center',
    paddingVertical: 12,
    paddingHorizontal: SPACING.md,
    gap:             SPACING.sm,
  },
  icon: { flexShrink: 0 },
  message: {
    flex:       1,
    fontSize:   FONT.sm,
    fontFamily: FONTS.semibold,
    lineHeight: FONT.sm * 1.4,
  },
  actionBtn: {
    paddingHorizontal: 6,
    paddingVertical:   2,
  },
  actionText: {
    fontSize:   FONT.sm,
    fontFamily: FONTS.bold,
  },
})


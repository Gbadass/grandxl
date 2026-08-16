import { Pressable, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../theme'

interface Props {
  onPress?: () => void
  color?: string
  light?: boolean  // white bg version for dark headers
}

export function BackButton({ onPress, color, light = false }: Props) {
  const router = useRouter()
  const iconColor = color ?? (light ? '#fff' : COLORS.textPrimary)
  const bgColor   = light ? 'rgba(255,255,255,0.2)' : COLORS.surfaceHighlight

  return (
    <Pressable
      onPress={onPress ?? (() => router.back())}
      style={[s.btn, { backgroundColor: bgColor }]}
      hitSlop={8}
    >
      <Ionicons name="arrow-back" size={20} color={iconColor} />
    </Pressable>
  )
}

const s = StyleSheet.create({
  btn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
})

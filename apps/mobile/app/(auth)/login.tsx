import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Pressable,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import { AxiosError } from 'axios'
import { authApi } from '@grandxl/api-client'
import type { ApiError } from '@grandxl/types'
import { UserRole } from '@grandxl/types'
import { useAuthStore } from '../../src/store/auth.store'
import { SECURE_KEY_ACCESS, SECURE_KEY_REFRESH } from '../../src/lib/axios'
import { toast } from '../../src/lib/toast'
import { COLORS, SPACING, RADIUS, FONT } from '../../src/theme'

export default function LoginScreen() {
  const router = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [focusedField, setFocusedField] = useState<string | null>(null)

  async function handleLogin() {
    if (!identifier.trim() || !password.trim()) {
      toast.warning('Missing fields: Please enter your phone/email and password')
      return
    }

    setLoading(true)
    try {
      const isEmail = identifier.includes('@')
      const res = await authApi.login({
        [isEmail ? 'email' : 'phone']: identifier.trim(),
        password,
      })
      const { accessToken, refreshToken, user } = res.data.data

      if (accessToken) await SecureStore.setItemAsync(SECURE_KEY_ACCESS, accessToken)
      if (refreshToken) await SecureStore.setItemAsync(SECURE_KEY_REFRESH, refreshToken)

      setAuth(user, accessToken)
      router.replace(user.roles?.includes(UserRole.RIDER) ? '/(rider)' : '/(customer)' as never)
    } catch (err) {
      const msg =
        err instanceof AxiosError
          ? ((err.response?.data as ApiError | undefined)?.message ?? 'Login failed')
          : 'Login failed'
      toast.error(`Login failed: ${msg}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo mark */}
          <View style={styles.logoWrap}>
            <View style={styles.logoBox}>
              <Text style={styles.logoChar}>G</Text>
            </View>
            <Text style={styles.logoName}>GrandXL</Text>
          </View>

          {/* Heading */}
          <View style={styles.headingWrap}>
            <Text style={styles.heading}>Welcome back</Text>
            <Text style={styles.subheading}>Sign in to your account</Text>
          </View>

          {/* Fields */}
          <View style={styles.form}>
            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Phone or email</Text>
              <TextInput
                style={[styles.input, focusedField === 'id' && styles.inputFocused]}
                value={identifier}
                onChangeText={setIdentifier}
                placeholder="08012345678 or you@example.com"
                placeholderTextColor={COLORS.textTertiary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                onFocus={() => setFocusedField('id')}
                onBlur={() => setFocusedField(null)}
              />
            </View>

            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordWrap}>
                <TextInput
                  style={[styles.input, styles.passwordInput, focusedField === 'pw' && styles.inputFocused]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Your password"
                  placeholderTextColor={COLORS.textTertiary}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  onFocus={() => setFocusedField('pw')}
                  onBlur={() => setFocusedField(null)}
                />
                <Pressable
                  onPress={() => setShowPassword((v) => !v)}
                  style={styles.eyeBtn}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={COLORS.textTertiary}
                  />
                </Pressable>
              </View>
            </View>

            <Pressable
              onPress={() => router.push('/(auth)/forgot-password')}
              style={styles.forgotWrap}
            >
              <Text style={styles.forgotText}>Forgot password?</Text>
            </Pressable>
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Sign in</Text>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Register link */}
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>New to GrandXL? </Text>
            <Pressable onPress={() => router.push('/(auth)/register')}>
              <Text style={styles.footerLink}>Create an account</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.xxxl,
  },

  // Logo
  logoWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xxxl + SPACING.lg,
  },
  logoBox: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoChar: {
    color: '#fff',
    fontWeight: '900',
    fontSize: FONT.xl,
  },
  logoName: {
    color: COLORS.textPrimary,
    fontWeight: '800',
    fontSize: FONT.xl,
    letterSpacing: -0.5,
  },

  // Heading
  headingWrap: {
    marginBottom: SPACING.xxxl,
  },
  heading: {
    fontSize: FONT.xxxl,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
  },
  subheading: {
    fontSize: FONT.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },

  // Form
  form: {
    gap: SPACING.lg,
    marginBottom: SPACING.xxl,
  },
  fieldWrap: {
    gap: SPACING.xs,
  },
  label: {
    fontSize: FONT.sm,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    fontSize: FONT.md,
    color: COLORS.textPrimary,
  },
  inputFocused: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryFade,
  },
  passwordWrap: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 52,
  },
  eyeBtn: {
    position: 'absolute',
    right: SPACING.md,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  forgotWrap: {
    alignSelf: 'flex-end',
  },
  forgotText: {
    color: COLORS.primary,
    fontSize: FONT.sm,
    fontWeight: '600',
  },

  // Button
  btn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: FONT.md,
    letterSpacing: 0.3,
  },

  // Divider
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: SPACING.xxl,
    gap: SPACING.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    color: COLORS.textTertiary,
    fontSize: FONT.sm,
  },

  // Footer
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    color: COLORS.textSecondary,
    fontSize: FONT.md,
  },
  footerLink: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: FONT.md,
  },
})

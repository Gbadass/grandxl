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
  Switch,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import { AxiosError } from 'axios'
import { authApi } from '@grandxl/api-client'
import { UserRole } from '@grandxl/types'
import type { ApiError } from '@grandxl/types'
import { useAuthStore } from '../../src/store/auth.store'
import { SECURE_KEY_ACCESS, SECURE_KEY_REFRESH } from '../../src/lib/axios'
import { toast } from '../../src/lib/toast'
import { COLORS, SPACING, RADIUS, FONT, FONTS } from '../../src/theme'

export default function RegisterScreen() {
  const router = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    password: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [isRider, setIsRider] = useState(false)
  const [loading, setLoading] = useState(false)
  const [focusedField, setFocusedField] = useState<string | null>(null)

  function update(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleRegister() {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast.warning('Missing fields: Please enter your full name')
      return
    }
    if (!form.phone.trim()) {
      toast.warning('Missing fields: Phone number is required')
      return
    }
    if (!form.password.trim() || form.password.length < 8) {
      toast.warning('Weak password: Password must be at least 8 characters')
      return
    }

    setLoading(true)
    try {
      const res = await authApi.register({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim(),
        ...(form.email.trim() ? { email: form.email.trim() } : {}),
        password: form.password,
        consentGiven: true,
        role: isRider ? UserRole.RIDER : UserRole.CUSTOMER,
      })
      const { accessToken, refreshToken, user } = res.data.data

      if (accessToken) await SecureStore.setItemAsync(SECURE_KEY_ACCESS, accessToken)
      if (refreshToken) await SecureStore.setItemAsync(SECURE_KEY_REFRESH, refreshToken)

      setAuth(user, accessToken)
      router.replace(isRider ? '/(rider-onboarding)/setup' : '/(customer)' as never)
    } catch (err) {
      const msg =
        err instanceof AxiosError
          ? ((err.response?.data as ApiError | undefined)?.message ?? 'Registration failed')
          : 'Registration failed'
      toast.error(`Registration failed: ${msg}`)
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = (field: string) => [
    styles.input,
    focusedField === field && styles.inputFocused,
  ]

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
          {/* Back */}
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </Pressable>

          {/* Heading */}
          <View style={styles.headingWrap}>
            <Text style={styles.heading}>Create account</Text>
            <Text style={styles.subheading}>
              Join GrandXL — food delivered fast.
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.row}>
              <View style={[styles.fieldWrap, { flex: 1 }]}>
                <Text style={styles.label}>First name</Text>
                <TextInput
                  style={inputStyle('first')}
                  value={form.firstName}
                  onChangeText={(v) => update('firstName', v)}
                  placeholder="Emeka"
                  placeholderTextColor={COLORS.textTertiary}
                  autoCapitalize="words"
                  onFocus={() => setFocusedField('first')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>
              <View style={[styles.fieldWrap, { flex: 1 }]}>
                <Text style={styles.label}>Last name</Text>
                <TextInput
                  style={inputStyle('last')}
                  value={form.lastName}
                  onChangeText={(v) => update('lastName', v)}
                  placeholder="Okafor"
                  placeholderTextColor={COLORS.textTertiary}
                  autoCapitalize="words"
                  onFocus={() => setFocusedField('last')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>
            </View>

            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Phone number</Text>
              <TextInput
                style={inputStyle('phone')}
                value={form.phone}
                onChangeText={(v) => update('phone', v)}
                placeholder="+2348012345678"
                placeholderTextColor={COLORS.textTertiary}
                keyboardType="phone-pad"
                onFocus={() => setFocusedField('phone')}
                onBlur={() => setFocusedField(null)}
              />
            </View>

            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Email <Text style={styles.optional}>(optional)</Text></Text>
              <TextInput
                style={inputStyle('email')}
                value={form.email}
                onChangeText={(v) => update('email', v)}
                placeholder="you@example.com"
                placeholderTextColor={COLORS.textTertiary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
              />
            </View>

            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordWrap}>
                <TextInput
                  style={[...inputStyle('pw'), styles.passwordInput]}
                  value={form.password}
                  onChangeText={(v) => update('password', v)}
                  placeholder="Min 8 characters"
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
                  <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁️'}</Text>
                </Pressable>
              </View>
            </View>

            <Text style={styles.consent}>
              By creating an account you agree to our{' '}
              <Text style={{ color: COLORS.primary }}>Terms of Service</Text> and{' '}
              <Text style={{ color: COLORS.primary }}>Privacy Policy</Text>.
            </Text>
          </View>

          {/* Rider toggle */}
          <View style={styles.riderToggle}>
            <View style={styles.riderToggleLeft}>
              <Text style={styles.riderToggleTitle}>I want to deliver</Text>
              <Text style={styles.riderToggleSub}>Sign up as a GrandXL rider</Text>
            </View>
            <Switch
              value={isRider}
              onValueChange={setIsRider}
              trackColor={{ false: COLORS.border, true: COLORS.primary }}
              thumbColor="#fff"
            />
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Create account</Text>
            )}
          </TouchableOpacity>

          {/* Login link */}
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Pressable onPress={() => router.replace('/(auth)/login')}>
              <Text style={styles.footerLink}>Sign in</Text>
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
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xxxl,
  },

  backBtn: {
    alignSelf: 'flex-start',
    marginBottom: SPACING.xl,
    paddingVertical: SPACING.xs,
  },
  backText: {
    color: COLORS.textSecondary,
    fontSize: FONT.md,
    fontWeight: '600',
  },

  headingWrap: {
    marginBottom: SPACING.xxl,
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

  form: {
    gap: SPACING.lg,
    marginBottom: SPACING.xxl,
  },
  row: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  fieldWrap: {
    gap: SPACING.xs,
  },
  label: {
    fontSize: FONT.sm,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  optional: {
    fontWeight: '400',
    color: COLORS.textTertiary,
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
  eyeIcon: { fontSize: 18 },
  consent: {
    fontSize: FONT.xs,
    color: COLORS.textTertiary,
    lineHeight: 18,
  },

  btn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: FONT.md,
    letterSpacing: 0.3,
  },

  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.xxl,
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

  riderToggle: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surfaceHighlight,
    borderRadius:   RADIUS.md,
    padding:        SPACING.lg,
    marginBottom:   SPACING.xxl,
  },
  riderToggleLeft: { gap: 2 },
  riderToggleTitle: {
    fontSize:   FONT.md,
    fontFamily: FONTS.semibold,
    color:      COLORS.textPrimary,
  },
  riderToggleSub: {
    fontSize:   FONT.sm,
    fontFamily: FONTS.regular,
    color:      COLORS.textSecondary,
  },
})

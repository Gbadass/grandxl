import { useState, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import { AxiosError } from 'axios'
import { authApi } from '@grandxl/api-client'
import type { ApiError } from '@grandxl/types'
import { UserRole } from '@grandxl/types'
import { useAuthStore } from '../../src/store/auth.store'
import { SECURE_KEY_ACCESS, SECURE_KEY_REFRESH } from '../../src/lib/axios'
import { toast } from '../../src/lib/toast'

export default function VerifyOtpScreen() {
  const router = useRouter()
  const { phone } = useLocalSearchParams<{ phone: string }>()
  const setAuth = useAuthStore((s) => s.setAuth)

  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [countdown, setCountdown] = useState(60)

  useEffect(() => {
    if (phone) void sendOtp()
  }, [])

  useEffect(() => {
    if (countdown <= 0) return
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  async function sendOtp() {
    if (!phone) return
    setSending(true)
    try {
      await authApi.sendOtp({ phone })
      setCountdown(60)
    } catch {
      toast.error('Failed to send OTP. Please try again.')
    } finally {
      setSending(false)
    }
  }

  async function handleVerify() {
    if (otp.length !== 6) {
      toast.warning('Please enter the 6-digit OTP')
      return
    }

    setLoading(true)
    try {
      const res = await authApi.verifyOtp({ phone: phone ?? '', otp })
      const { accessToken, refreshToken, user } = res.data.data

      if (accessToken) await SecureStore.setItemAsync(SECURE_KEY_ACCESS, accessToken)
      if (refreshToken) await SecureStore.setItemAsync(SECURE_KEY_REFRESH, refreshToken)

      setAuth(user, accessToken)

      const dest = user.roles?.includes(UserRole.RIDER) ? '/(rider)' : '/(customer)'
      router.replace(dest as never)
    } catch (err) {
      const msg =
        err instanceof AxiosError
          ? ((err.response?.data as ApiError | undefined)?.message ?? 'Invalid OTP')
          : 'Invalid OTP'
      toast.error(`Verification failed: ${msg}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
      <View style={styles.container}>
        <Text style={styles.title}>Verify your phone</Text>
        <Text style={styles.subtitle}>
          We sent a 6-digit code to{'\n'}
          <Text style={styles.phone}>{phone}</Text>
        </Text>

        <Text style={styles.label}>Enter OTP</Text>
        <TextInput
          style={styles.input}
          value={otp}
          onChangeText={(v) => setOtp(v.replace(/\D/g, '').slice(0, 6))}
          placeholder="123456"
          keyboardType="number-pad"
          maxLength={6}
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleVerify}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Verify</Text>
          )}
        </TouchableOpacity>

        <View style={styles.resend}>
          {countdown > 0 ? (
            <Text style={styles.countdownText}>Resend OTP in {countdown}s</Text>
          ) : (
            <TouchableOpacity onPress={sendOtp} disabled={sending}>
              <Text style={styles.link}>{sending ? 'Sending…' : 'Resend OTP'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#f9fafb' },
  container: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 26, fontWeight: '700', color: '#111827', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#6b7280', marginBottom: 32, lineHeight: 22 },
  phone: { fontWeight: '600', color: '#374151' },
  label: { fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 6 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 24,
    letterSpacing: 8,
    marginBottom: 24,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#f97316',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  resend: { alignItems: 'center', marginTop: 20 },
  countdownText: { color: '#9ca3af', fontSize: 14 },
  link: { color: '#f97316', fontWeight: '600', fontSize: 14 },
})

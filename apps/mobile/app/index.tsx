import { useEffect, useRef } from 'react'
import { View, Image, Text, Animated, StyleSheet, Dimensions } from 'react-native'
import { useRouter } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import { useAuthStore } from '../src/store/auth.store'
import { UserRole } from '@grandxl/types'
import { SECURE_KEY_LAST_MODE } from '../src/lib/axios'
import { FONTS } from '../src/theme'

const { width: W } = Dimensions.get('window')
const NAVY = '#1A2240'

export default function SplashScreen() {
  const router = useRouter()
  const { isAuthenticated, user, isInitializing } = useAuthStore()

  // Two gates: animation must finish AND auth must resolve before navigating
  const animDone  = useRef(false)
  const authReady = useRef(false)

  const logoScale      = useRef(new Animated.Value(0.75)).current
  const logoOpacity    = useRef(new Animated.Value(0)).current
  const taglineY       = useRef(new Animated.Value(18)).current
  const taglineOpacity = useRef(new Animated.Value(0)).current
  const screenOpacity  = useRef(new Animated.Value(1)).current

  function tryNavigate() {
    if (!animDone.current || !authReady.current) return

    Animated.timing(screenOpacity, {
      toValue: 0,
      duration: 320,
      useNativeDriver: true,
    }).start(async () => {
      const { isAuthenticated: authed, user: u } = useAuthStore.getState()

      // Guests and rider-less customers go to /(customer)
      if (!authed || !u?.roles?.includes(UserRole.RIDER)) {
        router.replace('/(customer)/' as never)
        return
      }

      // User has the RIDER role. If they also have CUSTOMER, honor their last-used mode.
      const dualRole = u.roles?.includes(UserRole.CUSTOMER)
      if (!dualRole) {
        router.replace('/(rider)/' as never)
        return
      }

      const last = await SecureStore.getItemAsync(SECURE_KEY_LAST_MODE)
      router.replace((last === 'customer' ? '/(customer)/' : '/(rider)/') as never)
    })
  }

  // Gate 1 — play animation, set animDone when complete
  useEffect(() => {
    Animated.parallel([
      Animated.spring(logoScale, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
      Animated.timing(logoOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start(() => {
      Animated.parallel([
        Animated.timing(taglineY,       { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(taglineOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start(() => {
        setTimeout(() => {
          animDone.current = true
          tryNavigate()
        }, 850)
      })
    })
  }, [])

  // Gate 2 — watch auth initialization, set authReady when resolved
  useEffect(() => {
    if (!isInitializing) {
      authReady.current = true
      tryNavigate()
    }
  }, [isInitializing])

  return (
    <Animated.View style={[styles.container, { opacity: screenOpacity }]}>
      <Animated.View
        style={[
          styles.logoWrap,
          { opacity: logoOpacity, transform: [{ scale: logoScale }] },
        ]}
      >
        <Image
          source={require('../src/assets/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.taglineWrap,
          { opacity: taglineOpacity, transform: [{ translateY: taglineY }] },
        ]}
      >
        <Text style={styles.tagline}>Bringing Restaurants Home</Text>
      </Animated.View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: NAVY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: W * 0.62,
    height: W * 0.62,
  },
  taglineWrap: {
    marginTop: 4,
  },
  tagline: {
    fontSize: 16,
    fontFamily: FONTS.semibold,
    color: 'rgba(255,255,255,0.82)',
    letterSpacing: 0.3,
  },
})

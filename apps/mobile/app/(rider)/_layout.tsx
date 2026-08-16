import { useEffect } from 'react'
import { Tabs, useRouter } from 'expo-router'
import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useQuery } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import * as Notifications from 'expo-notifications'
import { ridersApi } from '@grandxl/api-client'
import { useAuthStore } from '../../src/store/auth.store'
import { COLORS, FONTS } from '../../src/theme'

type IoniconsName = React.ComponentProps<typeof Ionicons>['name']

function TabIcon({ focused, label, icon, iconFocused }: {
  focused: boolean; label: string; icon: IoniconsName; iconFocused: IoniconsName
}) {
  return (
    <View style={s.tabItem}>
      <Ionicons name={focused ? iconFocused : icon} size={22} color={focused ? COLORS.primary : COLORS.textTertiary} />
      <Text style={[s.label, focused && s.labelActive]} numberOfLines={1}>{label}</Text>
    </View>
  )
}

// Request notification permission once when the rider layout mounts.
// On Android 13+ POST_NOTIFICATIONS is a runtime permission — without it,
// neither push notifications nor the foreground service notification will appear.
async function requestNotificationPermission() {
  const { status } = await Notifications.requestPermissionsAsync()
  if (status !== 'granted') return
  await Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  })
}

export default function RiderLayout() {
  const router = useRouter()
  const { isAuthenticated } = useAuthStore()

  useEffect(() => {
    void requestNotificationPermission()
  }, [])

  const { data: rider, isError, error } = useQuery({
    queryKey: ['riderProfile'],
    queryFn:  () => ridersApi.getProfile().then((r) => r.data.data),
    enabled:  isAuthenticated,
    staleTime: 30_000,
    retry: false,
  })

  useEffect(() => {
    if (isError) {
      const status = (error as AxiosError)?.response?.status
      if (status === 404) {
        // No rider profile yet — start onboarding from vehicle step
        router.replace('/(rider-onboarding)/setup')
      } else if (status === 401) {
        // Token expired — go to login, not setup
        router.replace('/(auth)/login')
      }
      // Network/5xx errors: stay put, don't lose the rider's progress
      return
    }
    // Profile exists but not verified → pending screen
    if (rider && !rider.isVerified) {
      router.replace('/(rider-onboarding)/pending')
    }
  }, [rider, isError, error, router])

  return (
    <Tabs screenOptions={{ headerShown: false, tabBarStyle: s.tabBar, tabBarShowLabel: false }}>
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} label="Jobs" icon="list-outline" iconFocused="list" />
          ),
        }}
      />
      <Tabs.Screen
        name="active"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} label="Active" icon="navigate-circle-outline" iconFocused="navigate-circle" />
          ),
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} label="Earn" icon="wallet-outline" iconFocused="wallet" />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} label="Profile" icon="person-outline" iconFocused="person" />
          ),
        }}
      />
      {/* Reachable via router.push only — not a tab. */}
      <Tabs.Screen name="payouts" options={{ href: null }} />
    </Tabs>
  )
}

const s = StyleSheet.create({
  tabBar: {
    backgroundColor: COLORS.surface,
    borderTopColor:  COLORS.border,
    borderTopWidth:  1,
    height:          60,
    paddingBottom:   8,
    paddingTop:      6,
  },
  tabItem:     { alignItems: 'center', gap: 2 },
  label:       { fontSize: 9, color: COLORS.textTertiary, fontFamily: FONTS.medium },
  labelActive: { color: COLORS.primary, fontFamily: FONTS.semibold },
})

import { useEffect, useState } from 'react'
import { AppState, type AppStateStatus, Platform } from 'react-native'
import { Stack } from 'expo-router'
import { QueryClientProvider, focusManager } from '@tanstack/react-query'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import * as Notifications from 'expo-notifications'
import * as Font from 'expo-font'
import * as SplashScreen from 'expo-splash-screen'
import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
  Poppins_900Black,
} from '@expo-google-fonts/poppins'
import { queryClient } from '../src/lib/queryClient'
import { AuthProvider } from '../src/features/auth/AuthProvider'
import { usePushNotifications } from '../src/hooks/usePushNotifications'
import { ConfirmHost } from '../src/components/ConfirmHost'
import { ToastHost } from '../src/components/ToastHost'
// Side-effect import — initializes i18next once at app boot.
import '../src/i18n'

SplashScreen.preventAutoHideAsync()

Notifications.setNotificationHandler({
  // expo-notifications 0.31+: shouldShowAlert was split into Banner + List.
  // Without these, foreground pushes arrive silently and the user sees nothing.
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList:   true,
    shouldPlaySound:  true,
    shouldSetBadge:   true,
  }),
})

export default function RootLayout() {
  const [fontsLoaded, setFontsLoaded] = useState(false)

  useEffect(() => {
    Font.loadAsync({
      Poppins_400Regular,
      Poppins_500Medium,
      Poppins_600SemiBold,
      Poppins_700Bold,
      Poppins_800ExtraBold,
      Poppins_900Black,
    }).then(() => {
      setFontsLoaded(true)
      SplashScreen.hideAsync()
    })
  }, [])

  // Refetch React Query data when the app returns to the foreground so things
  // like restaurant open/closed state pick up changes the owner made while away.
  useEffect(() => {
    function onAppStateChange(status: AppStateStatus) {
      if (Platform.OS !== 'web') focusManager.setFocused(status === 'active')
    }
    const sub = AppState.addEventListener('change', onAppStateChange)
    return () => sub.remove()
  }, [])

  usePushNotifications()

  if (!fontsLoaded) return null

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </AuthProvider>
        <ConfirmHost />
        <ToastHost />
      </QueryClientProvider>
    </SafeAreaProvider>
  )
}

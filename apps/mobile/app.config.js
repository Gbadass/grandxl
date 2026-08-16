module.exports = {
  expo: {
    name: 'GrandXL',
    slug: 'grandxl',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './src/assets/icon.png',
    userInterfaceStyle: 'dark',
    splash: {
      image: './src/assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#111114',
    },
    ios: {
      bundleIdentifier: 'com.grandxl.app',
      supportsTablet: false,
      // Universal links — needs apple-app-site-association at the domain.
      // Enable once grandxl.com is provisioned with the AASA file.
      // associatedDomains: ['applinks:grandxl.com', 'applinks:*.grandxl.com'],
      config: {
        googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? '',
      },
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          'GrandXL needs your location to find restaurants near you and track your delivery.',
        NSLocationAlwaysAndWhenInUseUsageDescription:
          'GrandXL needs your location to find restaurants near you and for delivery tracking.',
        NSLocationAlwaysUsageDescription:
          'GrandXL riders need background location so we can track deliveries in real time.',
        NSPhotoLibraryUsageDescription:
          'GrandXL needs access to your photos to let you set a profile picture.',
        NSCameraUsageDescription:
          'GrandXL needs camera access to let you take a profile photo.',
        UIBackgroundModes: ['location', 'fetch'],
        // Schemes we probe with `Linking.canOpenURL` — without this list iOS
        // returns false even when the app is installed.
        LSApplicationQueriesSchemes: ['comgooglemaps', 'googlemaps', 'waze'],
      },
    },
    android: {
      package: 'com.grandxl.app',
      googleServicesFile: './google-services.json',
      adaptiveIcon: {
        foregroundImage: './src/assets/adaptive-icon.png',
        backgroundColor: '#E84B3A',
      },
      // App links — autoVerify requires an /.well-known/assetlinks.json file
      // hosted at the domain. Enable once grandxl.com is set up.
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: true,
          data: [
            { scheme: 'https', host: 'grandxl.com' },
            { scheme: 'https', host: '*.grandxl.com' },
          ],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? '',
        },
      },
      permissions: [
        'ACCESS_FINE_LOCATION',
        'ACCESS_COARSE_LOCATION',
        'ACCESS_BACKGROUND_LOCATION',
        'FOREGROUND_SERVICE',
        'RECEIVE_BOOT_COMPLETED',
        'VIBRATE',
        'READ_MEDIA_IMAGES',
        'READ_MEDIA_VIDEO',
        'READ_EXTERNAL_STORAGE',
        'WRITE_EXTERNAL_STORAGE',
        'CAMERA',
      ],
    },
    plugins: [
      'expo-router',
      'expo-font',
      'expo-secure-store',
      [
        'expo-location',
        {
          locationAlwaysAndWhenInUsePermission:
            'GrandXL needs your location to find restaurants near you and for delivery tracking.',
          isIosBackgroundLocationEnabled: true,
          isAndroidBackgroundLocationEnabled: true,
          isAndroidForegroundServiceEnabled: true,
        },
      ],
      [
        'expo-notifications',
        {
          icon: './src/assets/notification-icon.png',
          color: '#E84B3A',
        },
      ],
      'expo-task-manager',
      [
        'expo-image-picker',
        {
          photosPermission: 'GrandXL needs access to your photos to let you set a profile picture.',
          cameraPermission: 'GrandXL needs camera access to let you take a profile photo.',
        },
      ],
    ],
    extra: {
      apiUrl: process.env.EXPO_PUBLIC_API_URL,
      sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
      eas: {
        // Hardcoded because EAS CLI can't write to dynamic configs.
        // This is public; safe to commit.
        projectId: 'c35d2e16-695a-400d-af56-7d7716530d8e',
      },
    },
    scheme: 'grandxl',
  },
}

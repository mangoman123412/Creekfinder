import type { ExpoConfig } from 'expo/config';

// IMPORTANT: change these two identifiers to ones YOU own before your first store build.
// They must be globally unique and can never be changed after publishing.
const BUNDLE_ID = 'com.creekfinder.app';

const config: ExpoConfig = {
  name: 'CreekFinder',
  slug: 'creekfinder',
  scheme: 'creekfinder',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  backgroundColor: '#F5F1E8',
  assetBundlePatterns: ['**/*'],
  ios: {
    bundleIdentifier: BUNDLE_ID,
    supportsTablet: true,
    buildNumber: '1',
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSLocationWhenInUseUsageDescription:
        'CreekFinder uses your location to save the exact spot of a creek, show your position on the map, find nearby water, and measure distance to your saved places.',
      NSLocationAlwaysAndWhenInUseUsageDescription:
        'CreekFinder can keep recording your hike while your screen is off or the app is in the background, so your trail is complete and you can find your way back. Location is only recorded while you have started tracking.',
      NSCameraUsageDescription: 'CreekFinder uses the camera so you can take photos of the creeks you save.',
      NSPhotoLibraryUsageDescription: 'CreekFinder lets you attach photos from your library to the creeks you save.',
      UIBackgroundModes: ['location'],
    },
    privacyManifests: {
      NSPrivacyAccessedAPITypes: [
        { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp', NSPrivacyAccessedAPITypeReasons: ['C617.1', '0A2A.1', '3B52.1'] },
        { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults', NSPrivacyAccessedAPITypeReasons: ['CA92.1'] },
        { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategorySystemBootTime', NSPrivacyAccessedAPITypeReasons: ['35F9.1'] },
        { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryDiskSpace', NSPrivacyAccessedAPITypeReasons: ['E174.1', '85F4.1'] },
      ],
    },
  },
  android: {
    package: BUNDLE_ID,
    versionCode: 1,
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      monochromeImage: './assets/adaptive-icon-mono.png',
      backgroundColor: '#1F4D3A',
    },
    permissions: [
      'ACCESS_COARSE_LOCATION',
      'ACCESS_FINE_LOCATION',
      'ACCESS_BACKGROUND_LOCATION',
      'FOREGROUND_SERVICE',
      'FOREGROUND_SERVICE_LOCATION',
      'CAMERA',
      'POST_NOTIFICATIONS',
    ],
    blockedPermissions: ['android.permission.SYSTEM_ALERT_WINDOW', 'android.permission.RECORD_AUDIO', 'android.permission.READ_EXTERNAL_STORAGE', 'android.permission.WRITE_EXTERNAL_STORAGE'],
  },
  plugins: [
    'expo-router',
    'expo-dev-client',
    'expo-sqlite',
    'expo-secure-store',
    ['expo-splash-screen', { image: './assets/splash-icon.png', backgroundColor: '#1F4D3A', imageWidth: 220 }],
    [
      'expo-location',
      {
        locationAlwaysAndWhenInUsePermission:
          'CreekFinder can keep recording your hike while your screen is off, so your trail is complete and you can find your way back.',
        locationWhenInUsePermission: 'CreekFinder uses your location to save creeks, show your position, and find nearby water.',
        isAndroidBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: true,
        isIosBackgroundLocationEnabled: true,
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'CreekFinder lets you attach photos from your library to the creeks you save.',
        cameraPermission: 'CreekFinder uses the camera so you can take photos of the creeks you save.',
        microphonePermission: false,
      },
    ],
    '@maplibre/maplibre-react-native',
    ['expo-build-properties', { android: { minSdkVersion: 24 }, ios: { deploymentTarget: '16.4' } }],
  ],
  experiments: { typedRoutes: true },
  extra: {
    eas: { projectId: process.env.EAS_PROJECT_ID ?? '' },
  },
};

export default config;

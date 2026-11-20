import '../src/lib/tracking'; // registers the background GPS task at startup
import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Inter_400Regular, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold } from '@expo-google-fonts/inter';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider, useApp } from '../src/state/app';
import { ThemeProvider, useTheme } from '../src/state/theme';
import { getDb } from '../src/db/local';
import { resumeIfNeeded } from '../src/lib/tracking';
import { colors } from '../src/theme';
import { AlertHost } from '../src/components/AlertHost';

SplashScreen.preventAutoHideAsync().catch(() => {});

function Gate({ fontsReady }: { fontsReady: boolean }) {
  const { ready } = useApp();
  const { dark } = useTheme();
  useEffect(() => {
    void getDb().then(() => resumeIfNeeded()).finally(() => { if (ready && fontsReady) void SplashScreen.hideAsync(); });
  }, [ready, fontsReady]);
  const header = { headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.primary, headerTitleStyle: { fontFamily: 'Inter_700Bold', color: colors.ink }, headerShadowVisible: false, contentStyle: { backgroundColor: colors.bg } };
  const bare = { headerShown: false } as const;
  return (
    <>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ ...header, animation: 'slide_from_right' }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="creek" options={{ ...bare, animation: 'fade_from_bottom' }} />
        <Stack.Screen name="save" options={{ title: 'Save this creek', presentation: 'modal' }} />
        <Stack.Screen name="auth" options={{ title: 'Account', presentation: 'modal' }} />
        <Stack.Screen name="premium" options={{ title: 'CreekFinder Premium', presentation: 'modal' }} />
        <Stack.Screen name="alerts" options={{ title: 'Alerts & notifications' }} />
        <Stack.Screen name="settings" options={{ headerShown: false }} />
        <Stack.Screen name="editor" options={{ title: 'Design editor' }} />
        <Stack.Screen name="marketplace" options={{ title: 'Marketplace' }} />
        <Stack.Screen name="folders" options={{ title: 'Folders' }} />
        <Stack.Screen name="trips" options={{ title: 'Trip planner' }} />
        <Stack.Screen name="navigate" options={{ title: '', headerTransparent: true }} />
        <Stack.Screen name="track" options={{ title: '', headerTransparent: true }} />
        <Stack.Screen name="adventures" options={{ title: 'Adventure history' }} />
        <Stack.Screen name="adventure/[id]" options={{ title: 'Adventure' }} />
        <Stack.Screen name="offline" options={{ title: 'Offline maps' }} />
        <Stack.Screen name="safety" options={{ title: 'Safety' }} />
        <Stack.Screen name="legal/privacy" options={{ title: 'Privacy policy' }} />
        <Stack.Screen name="legal/terms" options={{ title: 'Terms of service' }} />
      </Stack>
    </>
  );
}

export default function Root() {
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold });
  const fontsReady = fontsLoaded || !!fontError;
  if (!fontsReady) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppProvider>
          <ThemeProvider>
            {(scheme) => (
              <React.Fragment key={scheme}>
                <Gate fontsReady={fontsReady} />
                <AlertHost />
              </React.Fragment>
            )}
          </ThemeProvider>
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

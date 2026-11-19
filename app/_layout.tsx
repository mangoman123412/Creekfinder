import '../src/lib/tracking'; // registers the background GPS task at startup
import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider, useApp } from '../src/state/app';
import { getDb } from '../src/db/local';
import { resumeIfNeeded } from '../src/lib/tracking';
import { colors } from '../src/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

function Gate() {
  const { ready } = useApp();
  useEffect(() => {
    void getDb().then(() => resumeIfNeeded()).finally(() => { if (ready) void SplashScreen.hideAsync(); });
  }, [ready]);
  const header = { headerStyle: { backgroundColor: colors.sand }, headerTintColor: colors.forest, headerTitleStyle: { fontWeight: '700' as const }, headerShadowVisible: false };
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={header}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="save" options={{ title: 'Save this creek', presentation: 'modal' }} />
        <Stack.Screen name="auth" options={{ title: 'Account', presentation: 'modal' }} />
        <Stack.Screen name="premium" options={{ title: 'CreekFinder Premium', presentation: 'modal' }} />
        <Stack.Screen name="place/[id]" options={{ title: 'Saved place' }} />
        <Stack.Screen name="public/[id]" options={{ title: 'Shared place' }} />
        <Stack.Screen name="explore-detail" options={{ title: 'Water location' }} />
        <Stack.Screen name="navigate" options={{ title: 'Find it', headerTransparent: true, headerTitle: '' }} />
        <Stack.Screen name="track" options={{ title: 'Track adventure', headerTransparent: true, headerTitle: '' }} />
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
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppProvider>
          <Gate />
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

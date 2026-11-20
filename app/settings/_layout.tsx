import React from 'react';
import { Stack } from 'expo-router';
import { colors } from '../../src/theme';
import { themed } from '../../src/custom/themed';

function SettingsLayout() {
  return (
    <Stack screenOptions={{ headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.primary, headerTitleStyle: { fontFamily: 'Inter_700Bold', color: colors.ink }, headerShadowVisible: false, contentStyle: { backgroundColor: colors.bg }, headerBackTitle: 'Back' }}>
      <Stack.Screen name="index" options={{ title: 'Customize' }} />
      <Stack.Screen name="appearance" options={{ title: 'Appearance' }} />
      <Stack.Screen name="home" options={{ title: 'Home screen' }} />
      <Stack.Screen name="navigation" options={{ title: 'Navigation' }} />
      <Stack.Screen name="map" options={{ title: 'Map customization' }} />
      <Stack.Screen name="details" options={{ title: 'Creek details' }} />
      <Stack.Screen name="saved" options={{ title: 'Saved locations' }} />
      <Stack.Screen name="tracking" options={{ title: 'GPS tracking' }} />
      <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
      <Stack.Screen name="display" options={{ title: 'Fonts & display' }} />
      <Stack.Screen name="accessibility" options={{ title: 'Accessibility' }} />
      <Stack.Screen name="profiles" options={{ title: 'Custom profiles' }} />
      <Stack.Screen name="themes" options={{ title: 'Themes & marketplace' }} />
      <Stack.Screen name="privacy" options={{ title: 'Privacy & security' }} />
      <Stack.Screen name="cloud" options={{ title: 'Cloud sync & backup' }} />
    </Stack>
  );
}
export default themed(SettingsLayout);

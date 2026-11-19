import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../src/theme';

type N = React.ComponentProps<typeof Ionicons>['name'];
const tab = (name: string, title: string, icon: N, iconOff: N) => (
  <Tabs.Screen key={name} name={name} options={{ title, tabBarIcon: ({ color, focused, size }: { color: any; focused: boolean; size: number }) => <Ionicons name={focused ? icon : iconOff} size={size} color={color} /> }} />
);

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false,
        tabBarActiveTintColor: colors.forest, tabBarInactiveTintColor: '#8A958F', tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        tabBarStyle: { backgroundColor: colors.white, borderTopColor: colors.line, height: 62, paddingBottom: 6, paddingTop: 4 },
        headerStyle: { backgroundColor: colors.sand }, headerShadowVisible: false, headerTitleStyle: { fontWeight: '800', color: colors.ink }, sceneStyle: { backgroundColor: colors.sand },
      }}
    >
      {tab('index', 'Home', 'home', 'home-outline')}
      {tab('explore', 'Explore', 'compass', 'compass-outline')}
      {tab('map', 'Map', 'map', 'map-outline')}
      {tab('places', 'My Places', 'bookmark', 'bookmark-outline')}
      {tab('profile', 'Profile', 'person-circle', 'person-circle-outline')}
    </Tabs>
  );
}

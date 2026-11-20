import React from 'react';
import { Platform, View } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Pressy, Text } from '../../src/components/ui';
import { colors, shadow } from '../../src/theme';

type N = React.ComponentProps<typeof Ionicons>['name'];
const META: Record<string, { title: string; on: N; off: N }> = {
  index: { title: 'Home', on: 'home', off: 'home-outline' },
  explore: { title: 'Explore', on: 'compass', off: 'compass-outline' },
  map: { title: 'Map', on: 'map', off: 'map-outline' },
  places: { title: 'My Places', on: 'bookmark', off: 'bookmark-outline' },
  profile: { title: 'Profile', on: 'person-circle', off: 'person-circle-outline' },
};

/** Floating pill tab bar. */
const HREF: Record<string, string> = { index: '/', explore: '/explore', map: '/map', places: '/places', profile: '/profile' };

function TabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: Math.max(insets.bottom, 10) + 4, alignItems: 'center' }}>
      <View style={[{ flexDirection: 'row', backgroundColor: colors.overlay, borderRadius: 34, paddingHorizontal: 8, paddingVertical: 8, width: '92%', maxWidth: 520, justifyContent: 'space-between' }, shadow.float]}>
        {state.routes.map((r: any, i: number) => {
          const m = META[r.name]; if (!m) return null;
          const focused = state.index === i;
          return (
            <Pressy key={r.key} scale={0.9} accessibilityLabel={m.title} onPress={() => { if (focused) return; try { navigation.navigate(r.name); } catch {} router.navigate(HREF[r.name] as any); }}
              style={{ flex: focused ? 1.55 : 1, height: 48, borderRadius: 26, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, backgroundColor: focused ? colors.primary : 'transparent' }}>
              <Ionicons name={focused ? m.on : m.off} size={22} color={focused ? '#fff' : colors.muted} />
              {focused && <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13.5 }}>{m.title}</Text>}
            </Pressy>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs tabBar={(p) => <TabBar {...p} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}>
      <Tabs.Screen name="index" /><Tabs.Screen name="explore" /><Tabs.Screen name="map" /><Tabs.Screen name="places" /><Tabs.Screen name="profile" />
    </Tabs>
  );
}
void Platform;

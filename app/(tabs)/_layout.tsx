import React from 'react';
import { View } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '../../src/custom/Icon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Pressy, Text } from '../../src/components/ui';
import { colors, runtime, shadow } from '../../src/theme';
import { NAV_META, type NavId } from '../../src/custom/schema';
import { useSettings } from '../../src/custom/store';
import { themed } from '../../src/custom/themed';

const TAB_ROUTE: Record<string, NavId> = { index: 'home', explore: 'explore', map: 'map', places: 'places', profile: 'profile' };
const HOMEY: NavId[] = ['home', 'explore', 'map', 'places', 'profile'];

/** The glyph for a nav item: outline when inactive / filled when active (unless the user fixed an icon style). */
export function navGlyph(base: string, active: boolean, style: 'auto' | 'outline' | 'filled'): string {
  const g = (Ionicons as any).glyphMap as Record<string, number>;
  const outline = base.endsWith('-outline') ? base : `${base}-outline`;
  const fill = base.endsWith('-outline') ? base.slice(0, -8) : base;
  const wantOutline = style === 'outline' || (style === 'auto' && !active);
  if (wantOutline && g[outline] != null) return outline;
  return g[fill] != null ? fill : base;
}

function TabBar({ state }: any) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const nav = useSettings().nav;
  const items = nav.items.filter((i) => i.visible);
  const activeRoute = state.routes[state.index]?.name as string;
  const activeId: NavId | null = TAB_ROUTE[activeRoute] ?? null;
  const go = (id: NavId) => { const m = NAV_META[id]; if (id === activeId) return; if (HOMEY.includes(id)) router.navigate(m.href as any); else router.push(m.href as any); };

  const st = nav.style;
  const showLabel = (focused: boolean) => nav.labels === 'always' ? true : nav.labels === 'never' ? false : st === 'floating' ? focused : st === 'compact' ? false : true;
  const iconSize = st === 'expanded' ? 28 : st === 'compact' ? 22 : 23;
  const bottomInset = Math.max(insets.bottom, 10);

  const barStyle =
    st === 'floating' ? { position: 'absolute' as const, left: 0, right: 0, bottom: bottomInset + 4, alignItems: 'center' as const }
    : st === 'compact' ? { position: 'absolute' as const, left: 0, right: 0, bottom: bottomInset, alignItems: 'center' as const }
    : { position: 'absolute' as const, left: 0, right: 0, bottom: 0 };
  const innerStyle =
    st === 'floating' ? [{ flexDirection: 'row' as const, backgroundColor: colors.navBg, borderRadius: 34, padding: 8, width: '92%' as const, maxWidth: 520, justifyContent: 'space-between' as const }, shadow.float]
    : st === 'compact' ? [{ flexDirection: 'row' as const, backgroundColor: colors.navBg, borderRadius: 28, paddingHorizontal: 10, paddingVertical: 6, gap: 6 }, shadow.float]
    : [{ flexDirection: 'row' as const, backgroundColor: colors.navBg, paddingTop: st === 'expanded' ? 12 : 8, paddingBottom: bottomInset, paddingHorizontal: 6, borderTopWidth: 1, borderColor: colors.line, justifyContent: 'space-around' as const }];

  return (
    <View pointerEvents="box-none" style={barStyle} accessibilityRole="tablist">
      <View style={innerStyle}>
        {items.map((it) => {
          const m = NAV_META[it.id]; const focused = it.id === activeId;
          const icon = navGlyph(it.icon ?? m.icon, focused, nav.iconStyle);
          const label = it.label || m.label;
          const lab = showLabel(focused);
          const pill = st === 'floating' || st === 'compact';
          return (
            <Pressy key={it.id} scale={0.9} accessibilityLabel={label} onPress={() => go(it.id)}
              style={pill
                ? { flex: st === 'floating' ? (focused ? 1.55 : 1) : undefined, height: st === 'compact' ? 42 : 48 * runtime.buttonH, minWidth: st === 'compact' ? 46 : undefined, borderRadius: 26, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, paddingHorizontal: st === 'compact' ? 10 : 0, backgroundColor: focused ? colors.primary : 'transparent' }
                : { flex: 1, alignItems: 'center', justifyContent: 'center', gap: st === 'expanded' ? 4 : 2, paddingVertical: 2 }}>
              {!pill && focused && <View style={{ position: 'absolute', top: -8, width: 34, height: 3, borderRadius: 2, backgroundColor: colors.primary }} />}
              <Ionicons name={icon as any} size={iconSize} color={pill ? (focused ? colors.onPrimary : colors.muted) : focused ? colors.primary : colors.muted} />
              {lab && <Text numberOfLines={1} style={{ fontSize: st === 'expanded' ? 12.5 : 11, fontWeight: focused ? '800' : '600', color: pill ? (focused ? colors.onPrimary : colors.muted) : focused ? colors.primary : colors.muted }}>{label}</Text>}
            </Pressy>
          );
        })}
      </View>
    </View>
  );
}

function TabsLayout() {
  return (
    <Tabs tabBar={(p) => <TabBar {...p} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}>
      <Tabs.Screen name="index" /><Tabs.Screen name="explore" /><Tabs.Screen name="map" /><Tabs.Screen name="places" /><Tabs.Screen name="profile" />
    </Tabs>
  );
}
export default themed(TabsLayout);

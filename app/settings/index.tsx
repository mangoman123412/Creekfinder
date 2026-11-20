import React from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '../../src/custom/Icon';
import { Button, Pressy, Text } from '../../src/components/ui';
import { Group2, NavRow } from '../../src/custom/controls';
import { LivePreview } from '../../src/custom/pages';
import { activeProfile, switchProfile, useLibrary, useSettings, allMapPresets, getMapPreset } from '../../src/custom/store';
import { THEME_PRESETS } from '../../src/custom/schema';
import { useApp } from '../../src/state/app';
import { colors, font, radius, shadow } from '../../src/theme';
import { themed } from '../../src/custom/themed';

function Hub() {
  const router = useRouter();
  const lib = useLibrary(); const s = useSettings(); const { user } = useApp();
  const prof = activeProfile();
  const go = (p: string) => () => router.push(p as any);
  const theme = THEME_PRESETS.find((p) => p.id === s.theme.presetId)?.name ?? 'Custom';
  const vis = s.home.widgets.filter((w) => w.visible).length;
  const navN = s.nav.items.filter((i) => i.visible).length;
  const sections = s.detail.sections.filter((x) => x.visible).length;
  const stats = s.tracking.stats.filter((x) => x.visible).length;
  const notif = Object.values(s.notifications.enabled).filter(Boolean).length;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 18, paddingBottom: 120 }}>
      <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
        <View style={{ width: 118 }}><LivePreview width={104} caption={false} /></View>
        <View style={{ flex: 1, gap: 8, minWidth: 0 }}>
          <Text style={font.h1}>Make it yours</Text>
          <Text style={font.small}>Active profile</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Ionicons name={prof.icon as any} size={20} color={colors.primary} /><Text style={{ fontWeight: '800', fontSize: 16 }} numberOfLines={1}>{prof.name}</Text></View>
          <Button small icon="color-wand" title="Open design editor" onPress={go('/editor')} />
        </View>
      </View>
      <Text style={[font.label, { marginTop: 18, marginBottom: 8 }]}>Switch profile instantly</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {lib.profiles.map((p) => (
          <Pressy key={p.id} onPress={() => switchProfile(p.id)} accessibilityLabel={`Switch to ${p.name} profile`} scale={0.95} style={{ marginRight: 10 }}>
            <View style={[{ alignItems: 'center', gap: 5, paddingVertical: 12, width: 86, borderRadius: radius.md, backgroundColor: p.id === lib.activeProfileId ? colors.primary : colors.surface }, shadow.soft]}>
              <Ionicons name={p.icon as any} size={24} color={p.id === lib.activeProfileId ? colors.onPrimary : colors.primary} /><Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '700', color: p.id === lib.activeProfileId ? colors.onPrimary : colors.ink }}>{p.name}</Text>
            </View>
          </Pressy>))}
      </ScrollView>

      <Group2 title="Look & layout">
        <NavRow icon="color-palette" title="Appearance" subtitle={`${theme} · ${s.theme.mode === 'system' ? 'automatic' : s.theme.mode}${Object.keys(s.theme.overrides).length ? ' · custom colours' : ''}`} onPress={go('/settings/appearance')} />
        <NavRow icon="home" title="Home screen" subtitle={`${vis} widgets shown · drag & drop editor`} onPress={go('/settings/home')} />
        <NavRow icon="navigate" title="Navigation" subtitle={`${s.nav.style} bar · ${navN} tabs`} onPress={go('/settings/navigation')} />
        <NavRow icon="text" title="Fonts & display" subtitle={`${Math.round(s.display.textScale * 100)}% text · ${s.display.font} · ${s.display.corners} corners`} onPress={go('/settings/display')} />
        <NavRow icon="accessibility" title="Accessibility" subtitle={[s.a11y.highContrast && 'high contrast', s.a11y.reduceMotion && 'reduced motion', s.a11y.largeTargets && 'large targets'].filter(Boolean).join(' · ') || 'Contrast, motion, touch targets'} onPress={go('/settings/accessibility')} />
      </Group2>
      <Group2 title="Maps & places">
        <NavRow icon="map" title="Map customization" subtitle={`${getMapPreset(s.mapPresetId, lib).name} · ${allMapPresets(lib).length} presets`} onPress={go('/settings/map')} />
        <NavRow icon="water" title="Creek details" subtitle={`${s.detail.layout} layout · ${sections} sections`} onPress={go('/settings/details')} />
        <NavRow icon="folder" title="Saved locations" subtitle={`Sort by ${s.saved.sort} · folders, tags, favorites`} onPress={go('/settings/saved')} />
        <NavRow icon="footsteps" title="GPS tracking" subtitle={`${s.tracking.layout} layout · ${stats} stats`} onPress={go('/settings/tracking')} />
      </Group2>
      <Group2 title="Alerts">
        <NavRow icon="notifications" title="Notifications" subtitle={`${notif} of 8 types on${s.notifications.quiet.enabled ? ` · quiet ${s.notifications.quiet.from}–${s.notifications.quiet.to}` : ''}`} onPress={go('/settings/notifications')} />
      </Group2>
      <Group2 title="Share & sync">
        <NavRow icon="people-circle" title="Custom profiles" subtitle={`${lib.profiles.length} profiles · Explorer, Fishing, Hiking, Minimal…`} onPress={go('/settings/profiles')} />
        <NavRow icon="storefront" title="Themes & marketplace" subtitle={`${lib.themes.length} saved themes · share & download designs`} onPress={go('/settings/themes')} />
        <NavRow icon="cloud-upload" title="Cloud sync & backup" subtitle={user ? 'Signed in — settings sync to your account' : 'Sign in to sync across devices'} onPress={go('/settings/cloud')} />
        <NavRow icon="lock-closed" title="Privacy & security" subtitle={`New places are ${s.privacy.defaultVisibility}`} onPress={go('/settings/privacy')} />
      </Group2>
    </ScrollView>
  );
}
export default themed(Hub);

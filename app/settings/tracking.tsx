import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '../../src/custom/Icon';
import { Button, Pressy, Text } from '../../src/components/ui';
import { DragList, Group2, MoveButtons, SettingsPage, SwitchRow } from '../../src/custom/controls';
import { TRACK_META } from '../../src/custom/schema';
import { mutate, resetSection, useSettings } from '../../src/custom/store';
import { colors, font, radius, shadow } from '../../src/theme';
import { themed } from '../../src/custom/themed';

const LAYOUTS = [
  { id: 'classic', title: 'Classic', icon: 'map', blurb: 'Map with your stats in a panel below.' },
  { id: 'dashboard', title: 'Dashboard', icon: 'grid', blurb: 'Big stat tiles on top, small map underneath.' },
  { id: 'mapfocus', title: 'Map focus', icon: 'navigate', blurb: 'Full-screen map with a few stat chips.' },
  { id: 'minimal', title: 'Distraction-free', icon: 'eye-off', blurb: 'Black screen, two huge numbers, one button.' },
] as const;

function Tracking() {
  const t = useSettings().tracking; const router = useRouter();
  return (
    <SettingsPage onReset={() => resetSection('tracking')} resetLabel="Reset tracking screen">
      <Text style={[font.label, { marginBottom: 8, marginLeft: 4 }]}>Tracking screen layout</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {LAYOUTS.map((l) => (
          <Pressy key={l.id} onPress={() => mutate((d) => { d.tracking.layout = l.id; })} accessibilityLabel={`${l.title} layout`} scale={0.97} style={{ width: '48%', flexGrow: 1 }}>
            <View style={[{ padding: 14, borderRadius: radius.md, backgroundColor: t.layout === l.id ? colors.primary : colors.surface, gap: 6, minHeight: 118 }, shadow.soft]}>
              <Ionicons name={l.icon as any} size={24} color={t.layout === l.id ? colors.onPrimary : colors.primary} />
              <Text style={{ fontWeight: '800', color: t.layout === l.id ? colors.onPrimary : colors.ink }}>{l.title}</Text>
              <Text style={{ fontSize: 12, color: t.layout === l.id ? colors.onPrimary : colors.muted }}>{l.blurb}</Text>
            </View>
          </Pressy>))}
      </View>
      <Text style={[font.label, { marginTop: 22, marginBottom: 8, marginLeft: 4 }]}>Statistics — show, hide and reorder</Text>
      <DragList data={t.stats} onReorder={(next) => mutate((d) => { d.tracking.stats = next; })} renderRow={(st, i, handle, move) => (
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: st.visible ? colors.waterTint : colors.surface2, alignItems: 'center', justifyContent: 'center' }}><Ionicons name={TRACK_META[st.id].icon as any} size={17} color={st.visible ? colors.water : colors.faint} /></View>
          <Text style={{ flex: 1, fontWeight: '700', opacity: st.visible ? 1 : 0.5 }}>{TRACK_META[st.id].title}</Text>
          <MoveButtons index={i} count={t.stats.length} move={move} />
          <Pressy onPress={() => mutate((d) => { const x = d.tracking.stats.find((y) => y.id === st.id); if (x) x.visible = !x.visible; })} accessibilityLabel={`${st.visible ? 'Hide' : 'Show'} ${TRACK_META[st.id].title}`} hitSlop={6}><Ionicons name={st.visible ? 'eye' : 'eye-off'} size={22} color={st.visible ? colors.primary : colors.faint} /></Pressy>
          {handle}
        </View>)} />
      <Text style={[font.small, { marginTop: 8 }]}>Distraction-free mode shows your first two selected statistics. You can also toggle it live on the tracking screen (eye button).</Text>
      <Group2 title="While recording"><SwitchRow icon="sunny" title="Keep the screen awake" subtitle="Recommended on the web app, where trails only record while the app is open" value={t.keepAwake} onChange={(v) => mutate((d) => { d.tracking.keepAwake = v; })} /></Group2>
      <View style={{ marginTop: 14 }}><Button icon="footsteps" title="Open the tracking screen" variant="secondary" onPress={() => router.push('/track')} /></View>
    </SettingsPage>
  );
}
export default themed(Tracking);

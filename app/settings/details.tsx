import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '../../src/custom/Icon';
import { Alert } from '../../src/lib/alert';
import { Banner, Button, Pressy, Text } from '../../src/components/ui';
import { DragList, Group2, MoveButtons, SegmentRow, SettingsPage } from '../../src/custom/controls';
import { DEFAULTS, DETAIL_META } from '../../src/custom/schema';
import { mutate, resetSection, useSettings } from '../../src/custom/store';
import { colors, font } from '../../src/theme';
import { themed } from '../../src/custom/themed';

const LAYOUT_BLURB = { compact: 'Short: key facts as tiles, 2 items per list, smaller header.', standard: 'Balanced: fact rows with sources, 4 items per list.', detailed: 'Everything: sources on every fact, 8 items per list, extra plants and notes.' } as const;

function Details() {
  const s = useSettings(); const router = useRouter(); const d = s.detail;
  const shown = d.sections.filter((x) => x.visible).length;
  return (
    <SettingsPage onReset={() => resetSection('detail')} resetLabel="Reset creek details">
      <Banner tone="info" icon="water">This is your <Text style={{ fontWeight: '800' }}>Custom Creek Profile</Text> — it decides what every creek page shows, and in what order.</Banner>
      <Group2 title="Default layout" footer={LAYOUT_BLURB[d.layout]}>
        <SegmentRow options={[{ id: 'compact', label: 'Compact' }, { id: 'standard', label: 'Standard' }, { id: 'detailed', label: 'Detailed' }]} value={d.layout} onChange={(v) => mutate((x) => { x.detail.layout = v; })} />
      </Group2>
      <Text style={[font.label, { marginTop: 22, marginBottom: 8, marginLeft: 4 }]}>Sections — {shown} of {d.sections.length} shown · drag to reorder</Text>
      <DragList data={d.sections} onReorder={(next) => mutate((x) => { x.detail.sections = next; })} renderRow={(sec, i, handle, move) => { const m = DETAIL_META[sec.id]; return (
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: sec.visible ? colors.waterTint : colors.surface2, alignItems: 'center', justifyContent: 'center' }}><Ionicons name={m.icon as any} size={17} color={sec.visible ? colors.water : colors.faint} /></View>
          <Text style={{ flex: 1, fontWeight: '700', opacity: sec.visible ? 1 : 0.5 }} numberOfLines={1}>{m.title}</Text>
          <MoveButtons index={i} count={d.sections.length} move={move} />
          <Pressy onPress={() => mutate((x) => { const t = x.detail.sections.find((y) => y.id === sec.id); if (t) t.visible = !t.visible; })} accessibilityLabel={`${sec.visible ? 'Hide' : 'Show'} ${m.title}`} hitSlop={6}><Ionicons name={sec.visible ? 'eye' : 'eye-off'} size={22} color={sec.visible ? colors.primary : colors.faint} /></Pressy>
          {handle}
        </View>); }} />
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
        <Button small variant="secondary" icon="eye" title="Show all" style={{ flex: 1 }} onPress={() => mutate((x) => { x.detail.sections.forEach((t) => { t.visible = true; }); })} />
        <Button small variant="secondary" icon="refresh" title="Default order" style={{ flex: 1 }} onPress={() => Alert.alert('Restore default order?', undefined, [{ text: 'Cancel', style: 'cancel' }, { text: 'Restore', onPress: () => mutate((x) => { x.detail.sections = DEFAULTS().detail.sections; }) }])} />
      </View>
      <Text style={[font.small, { marginTop: 10 }]}>Tip: on any creek page you can also switch Compact / Standard / Detailed for just that visit.</Text>
    </SettingsPage>
  );
}
export default themed(Details);

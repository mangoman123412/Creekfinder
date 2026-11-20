import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Alert } from '../../src/lib/alert';
import { Button, Chip, Text } from '../../src/components/ui';
import { Group2, NavRow, SegmentRow, SettingsPage, SwitchRow } from '../../src/custom/controls';
import { allTags, listFolders, listPlaces, parseTags, setPlaceTags } from '../../src/db/local';
import { useDbQuery } from '../../src/state/hooks';
import { mutate, resetSection, useSettings } from '../../src/custom/store';
import { font } from '../../src/theme';
import { themed } from '../../src/custom/themed';

function Saved() {
  const s = useSettings().saved; const router = useRouter();
  const folders = useDbQuery(listFolders, [], []); const places = useDbQuery(() => listPlaces(), [], []); const tags = useDbQuery(allTags, [], [] as string[]);
  const count = (t: string) => places.data.filter((p) => parseTags(p.tags).includes(t)).length;
  const removeTag = (t: string) => Alert.alert(`Remove #${t}?`, `It will be removed from ${count(t)} place(s).`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: async () => { for (const p of places.data) { const l = parseTags(p.tags); if (l.includes(t)) await setPlaceTags(p.id, l.filter((x) => x !== t)); } } }]);
  return (
    <SettingsPage onReset={() => resetSection('saved')} resetLabel="Reset sorting & view">
      <Group2 title="Organization"><NavRow icon="folder-open" title="Folders" subtitle={`${folders.data.length} folders · names, icons, colours, nesting, private collections`} onPress={() => router.push('/folders')} /></Group2>
      <Group2 title="Default sorting" footer="Places with no value for the chosen sort (for example no rating) always appear last.">
        <SegmentRow title="Sort by" options={[{ id: 'date', label: 'Date' }, { id: 'distance', label: 'Distance' }, { id: 'name', label: 'Name' }, { id: 'rating', label: 'Rating' }, { id: 'elevation', label: 'Elev.' }]} value={s.sort} onChange={(v) => mutate((d) => { d.saved.sort = v; })} />
        <SegmentRow title="Direction" options={[{ id: 'asc', label: 'Ascending ↑' }, { id: 'desc', label: 'Descending ↓' }]} value={s.dir} onChange={(v) => mutate((d) => { d.saved.dir = v; })} />
        <SegmentRow title="List style" options={[{ id: 'cards', label: 'Photo cards' }, { id: 'compact', label: 'Compact list' }]} value={s.view} onChange={(v) => mutate((d) => { d.saved.view = v; })} />
        <SwitchRow icon="heart" title="Favorites first" subtitle="Keep favorites at the top whatever the sort" value={s.showFavoritesFirst} onChange={(v) => mutate((d) => { d.saved.showFavoritesFirst = v; })} />
      </Group2>
      <Group2 title={`Your tags (${tags.data.length})`} footer="Add tags when you save or edit a place, then filter by them in My Places.">
        <View style={{ padding: 14, flexDirection: 'row', flexWrap: 'wrap' }}>{tags.data.length === 0 ? <Text style={font.small}>No tags yet.</Text> : tags.data.map((t) => <Chip key={t} label={`#${t} (${count(t)}) ✕`} onPress={() => removeTag(t)} />)}</View>
      </Group2>
      <View style={{ marginTop: 14 }}><Button variant="secondary" icon="bookmark" title="Open My Places" onPress={() => router.push('/(tabs)/places')} /></View>
    </SettingsPage>
  );
}
export default themed(Saved);

import React, { useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '../src/custom/Icon';
import { Alert } from '../src/lib/alert';
import { Button, Card, Chip, Empty, Field, Pressy, Text } from '../src/components/ui';
import { DragList, MoveButtons } from '../src/custom/controls';
import { deleteTrip, listPlaces, listTrips, saveTrip, type Trip, type TripStop } from '../src/db/local';
import { useDbQuery } from '../src/state/hooks';
import { guideHref } from '../src/lib/nav';
import { colors, font, radius, shadow } from '../src/theme';
import { themed } from '../src/custom/themed';
import type { Place } from '../src/types';

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const inDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
const nextSat = () => { const d = new Date(); d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7)); return iso(d); };
interface Draft { id?: string; name: string; date: string; notes: string; stops: (TripStop & { id: string })[] }

/** Trip planner: name, date, ordered stops from your saved places, notes. Reminders come from Notifications settings. */
function Trips() {
  const router = useRouter();
  const trips = useDbQuery(listTrips, [], [] as Trip[]);
  const places = useDbQuery(() => listPlaces(), [], [] as Place[]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const today = iso(new Date());
  const startNew = () => setDraft({ name: '', date: inDays(1), notes: '', stops: [] });
  const edit = (t: Trip) => setDraft({ id: t.id, name: t.name, date: t.date, notes: t.notes ?? '', stops: t.stops.map((s, i) => ({ ...s, id: `${i}-${s.name}` })) });
  const save = async () => {
    if (!draft) return;
    if (!draft.name.trim()) { Alert.alert('Name your trip', 'For example “Waterfall weekend”.'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date) || isNaN(new Date(draft.date + 'T12:00').getTime())) { Alert.alert('Check the date', 'Use the format YYYY-MM-DD, or tap a quick date.'); return; }
    await saveTrip({ id: draft.id, name: draft.name, date: draft.date, notes: draft.notes.trim() || null, stops: draft.stops.map(({ id, ...s }) => s) });
    setDraft(null);
  };
  const addStop = (p: Place) => setDraft((d) => d && !d.stops.some((s) => s.placeId === p.id) ? { ...d, stops: [...d.stops, { id: `${Date.now()}-${p.id}`, name: p.name, lat: p.lat, lng: p.lng, placeId: p.id }] } : d);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 18, paddingBottom: 110 }} keyboardShouldPersistTaps="handled">
      <Text style={font.h1}>Trip planner</Text>
      <Text style={[font.small, { marginVertical: 8 }]}>Plan outings with stops from your saved places. Turn on trip reminders in Settings → Notifications.</Text>
      {!draft && <Button icon="add" title="Plan a trip" onPress={startNew} />}
      {draft && (
        <Card style={{ marginTop: 14 }}>
          <Field label="Trip name" value={draft.name} onChangeText={(name) => setDraft({ ...draft, name })} placeholder="Waterfall weekend" maxLength={50} />
          <Field label="Date (YYYY-MM-DD)" value={draft.date} onChangeText={(date) => setDraft({ ...draft, date })} maxLength={10} autoCapitalize="none" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 }}><Chip label="Today" onPress={() => setDraft({ ...draft, date: today })} /><Chip label="Tomorrow" onPress={() => setDraft({ ...draft, date: inDays(1) })} /><Chip label="This weekend" onPress={() => setDraft({ ...draft, date: nextSat() })} /><Chip label="In a week" onPress={() => setDraft({ ...draft, date: inDays(7) })} /></View>
          <Text style={font.label}>Stops (drag to reorder)</Text>
          <View style={{ marginTop: 8, marginBottom: 10 }}>
            {draft.stops.length === 0 ? <Text style={font.small}>No stops yet — add some from your saved places below.</Text> : (
              <DragList data={draft.stops} onReorder={(stops) => setDraft({ ...draft, stops })} renderRow={(s, i, handle, move) => (
                <>
                  <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}><Text style={{ color: colors.onPrimary, fontWeight: '800' }}>{i + 1}</Text></View>
                  <Text style={{ flex: 1, fontWeight: '600' }} numberOfLines={1}>{s.name}</Text>
                  <MoveButtons index={i} count={draft.stops.length} move={move} />
                  <Pressy onPress={() => setDraft({ ...draft, stops: draft.stops.filter((x) => x.id !== s.id) })} accessibilityLabel={`Remove ${s.name}`} hitSlop={8}><Ionicons name="close-circle" size={22} color={colors.danger} /></Pressy>
                  {handle}
                </>)} />)}
          </View>
          <Text style={font.label}>Add from saved places</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 8 }}>{places.data.length === 0 ? <Text style={font.small}>Save a creek first.</Text> : places.data.map((p) => <Chip key={p.id} label={p.name} icon="add" active={draft.stops.some((s) => s.placeId === p.id)} onPress={() => addStop(p)} />)}</ScrollView>
          <Field label="Notes (gear, who's coming, parking…)" value={draft.notes} onChangeText={(notes) => setDraft({ ...draft, notes })} multiline />
          <View style={{ flexDirection: 'row', gap: 10 }}><Button variant="secondary" title="Cancel" style={{ flex: 1 }} onPress={() => setDraft(null)} /><Button title="Save trip" icon="checkmark" style={{ flex: 1 }} onPress={save} /></View>
        </Card>
      )}
      <View style={{ marginTop: 18 }}>
        {trips.data.length === 0 && !draft ? <Empty icon="calendar" title="No trips planned" body="Plan your next outing with stops from your saved places." /> : trips.data.map((t) => (
          <View key={t.id} style={[{ backgroundColor: colors.surface, borderRadius: radius.md, padding: 14, marginBottom: 10, opacity: t.date < today ? 0.65 : 1 }, shadow.soft]}>
            <Text style={font.h3}>{t.name}</Text>
            <Text style={font.small}>{new Date(t.date + 'T12:00').toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}{t.date < today ? ' · past' : t.date === today ? ' · today' : ''}</Text>
            {t.stops.map((s, i) => <Pressy key={i} onPress={() => (s.placeId ? router.push(guideHref({ source: 'saved', id: s.placeId })) : router.push(guideHref({ source: 'osm', name: s.name, kind: 'creek', lat: s.lat, lng: s.lng })))} style={{ paddingVertical: 4 }}><Text style={{ color: colors.primary, fontWeight: '600' }}>{i + 1}. {s.name}</Text></Pressy>)}
            {t.notes ? <Text style={[font.small, { marginTop: 6 }]}>{t.notes}</Text> : null}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              {t.stops[0] && <Button small icon="navigate" title="Go to stop 1" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/navigate', params: { lat: String(t.stops[0].lat), lng: String(t.stops[0].lng), name: t.stops[0].name } })} />}
              <Button small variant="secondary" icon="create" title="Edit" style={{ flex: 1 }} onPress={() => edit(t)} />
              <Button small variant="ghost" icon="trash" title="" onPress={() => Alert.alert('Delete trip?', t.name, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => deleteTrip(t.id) }])} />
            </View>
          </View>))}
      </View>
    </ScrollView>
  );
}
void TextInput;
export default themed(Trips);

import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { Text } from '../src/components/ui';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Chip, Empty, Button } from '../src/components/ui';
import { CreekMap } from '../src/components/CreekMap';
import { listAdventures, getDb } from '../src/db/local';
import { useDbQuery } from '../src/state/hooks';
import { useApp } from '../src/state/app';
import { formatDistance, formatDuration } from '../src/lib/geo';
import { colors, font, space } from '../src/theme';

export default function Adventures() {
  const router = useRouter();
  const { imperial } = useApp();
  const [view, setView] = useState<'list' | 'map'>('list');
  const advs = useDbQuery(listAdventures, [], []);
  const all = useDbQuery(async () => {
    const db = await getDb();
    return db.getAllAsync<{ adventure_id: string; lat: number; lng: number }>(
      `SELECT t.adventure_id, t.lat, t.lng FROM track_points t JOIN adventures a ON a.id=t.adventure_id WHERE a.deleted=0 AND a.status='finished' AND t.seq % 3 = 0 ORDER BY t.adventure_id, t.seq`);
  }, [view], []);
  const lines = useMemo(() => {
    const m = new Map<string, { lat: number; lng: number }[]>();
    for (const r of all.data) { if (!m.has(r.adventure_id)) m.set(r.adventure_id, []); m.get(r.adventure_id)!.push(r); }
    return [...m.values()];
  }, [all.data]);
  const finished = advs.data.filter((a) => a.status === 'finished');
  const first = lines[0]?.[0];

  return (
    <View style={{ flex: 1, backgroundColor: colors.sand }}>
      <View style={{ flexDirection: 'row', padding: space.lg, paddingBottom: 0 }}>
        <Chip label="History" icon="list" active={view === 'list'} onPress={() => setView('list')} />
        <Chip label="Where I've explored" icon="map" active={view === 'map'} onPress={() => setView('map')} />
      </View>
      {view === 'list' ? (
        <FlatList contentContainerStyle={{ padding: space.lg, flexGrow: 1 }} data={finished} keyExtractor={(a) => a.id}
          ListEmptyComponent={<Empty icon="footsteps" title="No adventures yet" body="Start tracking on your next outing and your trail will be saved here — even with no signal." action={<Button small title="Start tracking" onPress={() => router.replace('/track')} />} />}
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push({ pathname: '/adventure/[id]', params: { id: item.id } })} style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Ionicons name="footsteps" size={26} color={colors.forest} />
              <View style={{ flex: 1 }}>
                <Text style={font.h3}>{item.name}</Text>
                <Text style={font.small}>{new Date(item.started_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</Text>
                <Text style={font.small}>{formatDistance(item.distance_m, imperial)} · {formatDuration(item.duration_s)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>)} />
      ) : (
        <View style={{ flex: 1, marginTop: space.md }}>
          {lines.length === 0 ? <Empty icon="map-outline" title="Nothing mapped yet" body="Your recorded trails will all show here." /> : (
            <MultiTrackMap lines={lines} center={first ? [first.lng, first.lat] : undefined} />
          )}
        </View>
      )}
    </View>
  );
}

function MultiTrackMap({ lines, center }: { lines: { lat: number; lng: number }[][]; center?: [number, number] }) {
  return <CreekMap styleKey="standard" showUser={false} multiTrack={lines} initial={center ? { center, zoom: 12 } : undefined} pins={[]} />;
}

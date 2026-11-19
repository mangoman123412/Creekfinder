import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { CameraRef } from '@maplibre/maplibre-react-native';
import { Banner, Chip, Empty, Button } from '../../src/components/ui';
import { CreekMap, type MapPin } from '../../src/components/CreekMap';
import { SourceBadge } from '../../src/components/Bits';
import { useApp } from '../../src/state/app';
import { ensureForegroundPermission, lastKnown } from '../../src/lib/location';
import { geocode, searchCommunity, searchOsmWater, type GeoResult } from '../../src/lib/explore';
import { boundsOfPoints, formatDistance } from '../../src/lib/geo';
import { PLACE_KINDS, kindIcon, kindLabel, type ExploreItem, type PlaceKind } from '../../src/types';
import { colors, font, radius, space } from '../../src/theme';

type Filter = 'all' | PlaceKind;
const FILTERS: { key: Filter; label: string; premium?: boolean }[] = [
  { key: 'all', label: 'All' }, { key: 'waterfall', label: 'Waterfalls' }, { key: 'swimming_hole', label: 'Swimming holes' },
  { key: 'river', label: 'Rivers' }, { key: 'stream', label: 'Streams / creeks' }, { key: 'pond_lake', label: 'Lakes & ponds' }, { key: 'spring', label: 'Springs' },
];

export default function Explore() {
  const router = useRouter();
  const { online, imperial, premium, user } = useApp();
  const cam = useRef<CameraRef>(null);
  const [q, setQ] = useState('');
  const [center, setCenter] = useState<{ lat: number; lng: number; label: string } | null>(null);
  const [items, setItems] = useState<ExploreItem[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<GeoResult[]>([]);
  const [view, setView] = useState<'list' | 'map'>('list');
  const [onlyCommunity, setOnlyCommunity] = useState(false);

  const load = useCallback(async (c: { lat: number; lng: number; label: string }) => {
    setCenter(c); setLoading(true); setError(null); setItems([]);
    try {
      const [osm, com] = await Promise.allSettled([searchOsmWater(c), searchCommunity(c)]);
      const all: ExploreItem[] = [];
      if (com.status === 'fulfilled') all.push(...com.value);
      if (osm.status === 'fulfilled') all.push(...osm.value);
      if (osm.status === 'rejected' && com.status === 'rejected') setError('Could not load locations. Check your connection and try again.');
      all.sort((a, b) => (a.distance_m ?? 0) - (b.distance_m ?? 0));
      setItems(all);
    } finally { setLoading(false); }
  }, []);

  const nearMe = useCallback(async () => {
    setError(null);
    if (!(await ensureForegroundPermission())) { setError('Allow location access to find water near you, or search for a place above.'); return; }
    const l = await lastKnown();
    if (!l) { setError('Waiting for a GPS fix. Move to open sky or search for a place instead.'); return; }
    await load({ lat: l.lat, lng: l.lng, label: 'Near you' });
  }, [load]);

  useEffect(() => { if (online) void nearMe(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const search = async () => {
    if (!q.trim()) return;
    setError(null); setResults([]);
    try {
      const r = await geocode(q);
      if (!r.length) setError(`No place found for “${q}”.`);
      else if (r.length === 1) await pick(r[0]);
      else setResults(r);
    } catch { setError('Search failed. Check your connection.'); }
  };
  const pick = async (r: GeoResult) => {
    setResults([]); setQ(r.name.split(',')[0]);
    await load({ lat: r.lat, lng: r.lng, label: r.name });
    cam.current?.flyTo({ center: [r.lng, r.lat], zoom: 10, duration: 800 });
  };

  const shown = useMemo(() => items.filter((i) => (filter === 'all' || i.kind === filter) && (!onlyCommunity || i.source !== 'osm')), [items, filter, onlyCommunity]);
  const pins: MapPin[] = useMemo(() => shown.map((i) => ({ id: i.key, lat: i.lat, lng: i.lng, name: i.name, group: i.source === 'osm' ? 'osm' : 'community', kind: i.kind })), [shown]);

  const open = (i: ExploreItem) => {
    if (i.placeId) router.push({ pathname: '/public/[id]', params: { id: i.placeId } });
    else router.push({ pathname: '/explore-detail', params: { name: i.name, kind: i.kind, lat: String(i.lat), lng: String(i.lng), osm: i.osmId ?? '', desc: i.description ?? '' } });
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.sand }}>
      <View style={{ paddingHorizontal: space.lg, paddingTop: space.md }}>
        <Text style={font.h1}>Explore</Text>
        <View style={s.search}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput value={q} onChangeText={setQ} onSubmitEditing={search} placeholder="City, state, ZIP code or place" returnKeyType="search" style={{ flex: 1, fontSize: 16 }} autoCorrect={false} />
          <Pressable onPress={nearMe} hitSlop={8} accessibilityLabel="Use my location"><Ionicons name="locate" size={22} color={colors.water} /></Pressable>
        </View>
        {results.length > 0 && (
          <View style={s.dropdown}>
            {results.map((r, i) => <Pressable key={i} onPress={() => pick(r)} style={{ padding: 12 }}><Text numberOfLines={2} style={font.body}>{r.name}</Text></Pressable>)}
          </View>
        )}
        <FlatList horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10, flexGrow: 0 }} data={FILTERS} keyExtractor={(f) => f.key}
          renderItem={({ item }) => <Chip label={item.label} active={filter === item.key} onPress={() => setFilter(item.key)} />} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
          <View style={{ flexDirection: 'row' }}>
            <Chip label="List" icon="list" active={view === 'list'} onPress={() => setView('list')} />
            <Chip label="Map" icon="map" active={view === 'map'} onPress={() => setView('map')} />
          </View>
          <Chip label={premium ? 'Community only' : 'Community only ★'} icon="people" active={onlyCommunity} onPress={() => { if (!premium) { router.push({ pathname: '/premium', params: { reason: 'filters' } }); return; } setOnlyCommunity((v) => !v); }} />
        </View>
      </View>

      {!online && <View style={{ paddingHorizontal: space.lg }}><Banner tone="info" icon="cloud-offline">You're offline. Exploring needs internet — your saved places are still available in My Places and Map.</Banner></View>}
      {error && <View style={{ paddingHorizontal: space.lg }}><Banner tone="warn" icon="alert-circle">{error}</Banner></View>}
      {loading && <ActivityIndicator style={{ margin: space.lg }} color={colors.forest} />}

      {view === 'map' ? (
        <View style={{ flex: 1, marginTop: 8 }}>
          <CreekMap styleKey="standard" cameraRef={cam} pins={pins} showUser attributionBottom={8} initial={center ? { center: [center.lng, center.lat], zoom: 9 } : undefined}
            onPressPin={(p) => { const it = items.find((x) => x.key === p.id); if (it) open(it); }} />
          <Legend />
        </View>
      ) : (
        <FlatList
          contentContainerStyle={{ padding: space.lg, paddingBottom: 40, flexGrow: 1 }} data={shown} keyExtractor={(i) => i.key}
          ListHeaderComponent={shown.length ? (<Text style={[font.small, { marginBottom: 8 }]}>{shown.length} locations · {center?.label?.split(',')[0]}. <Text style={{ fontWeight: '700' }}>Blue/green = community, grey = OpenStreetMap.</Text> Always confirm access and safety yourself.</Text>) : undefined}
          renderItem={({ item }) => <ExploreRow item={item} imperial={imperial} onPress={() => open(item)} />}
          ListEmptyComponent={!loading ? <Empty icon="compass-outline" title="Nothing found yet" body="Try another search or a larger area. Results come from OpenStreetMap and from creeks shared by the CreekFinder community." action={<Button small title="Search near me" onPress={nearMe} />} /> : undefined}
        />
      )}
    </SafeAreaView>
  );
}

function Legend() {
  return (
    <View style={s.legend}>
      {[['Community', colors.water], ['OpenStreetMap', '#7A8F86']].map(([l, c]) => (
        <View key={l} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: c }} /><Text style={{ fontSize: 12, fontWeight: '600' }}>{l}</Text></View>
      ))}
    </View>
  );
}

function ExploreRow({ item, imperial, onPress }: { item: ExploreItem; imperial: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={s.row} accessibilityRole="button" accessibilityLabel={item.name}>
      <View style={[s.icon, { backgroundColor: item.source === 'osm' ? '#ECEFEC' : colors.waterLight }]}><Ionicons name={kindIcon(item.kind) as any} size={22} color={item.source === 'osm' ? colors.muted : colors.water} /></View>
      <View style={{ flex: 1 }}>
        <Text style={font.h3} numberOfLines={1}>{item.name}</Text>
        <Text style={font.small}>{kindLabel(item.kind)}{item.distance_m != null ? `  ·  ${formatDistance(item.distance_m, imperial)}` : ''}{item.avg_rating ? `  ·  ★ ${item.avg_rating.toFixed(1)} (${item.rating_count})` : ''}</Text>
        <SourceBadge source={item.source} />
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: radius.pill, paddingHorizontal: 14, height: 48, marginTop: space.md, borderWidth: 1, borderColor: colors.line },
  dropdown: { backgroundColor: '#fff', borderRadius: radius.md, marginTop: 6, borderWidth: 1, borderColor: colors.line },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', padding: 12, borderRadius: radius.md, marginBottom: 10 },
  icon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  legend: { position: 'absolute', left: 12, top: 12, backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 12, padding: 8, gap: 4 },
});

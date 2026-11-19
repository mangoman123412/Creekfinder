import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { CameraRef } from '@maplibre/maplibre-react-native';
import { Banner, Button, Chip, Empty, Pressy, Skeleton, Text } from '../../src/components/ui';
import { DestinationCard, type CardData } from '../../src/components/Bits';
import { CreekMap, type MapPin } from '../../src/components/CreekMap';
import { useApp } from '../../src/state/app';
import { ensureForegroundPermission, lastKnown } from '../../src/lib/location';
import { enrichItems, geocode, searchCommunity, searchOsmWater, type GeoResult } from '../../src/lib/explore';
import { itemHref } from '../../src/lib/nav';
import { type ExploreItem, type PlaceKind } from '../../src/types';
import { colors, font, radius, shadow, space } from '../../src/theme';

type Filter = 'all' | PlaceKind;
const FILTERS: { key: Filter; label: string; icon: any }[] = [
  { key: 'all', label: 'All', icon: 'apps' }, { key: 'waterfall', label: 'Waterfalls', icon: 'arrow-down-circle' }, { key: 'swimming_hole', label: 'Swimming holes', icon: 'body' },
  { key: 'river', label: 'Rivers', icon: 'git-merge' }, { key: 'stream', label: 'Creeks & streams', icon: 'water' }, { key: 'pond_lake', label: 'Lakes & ponds', icon: 'ellipse' }, { key: 'spring', label: 'Springs', icon: 'sparkles' },
];
const toCard = (i: ExploreItem): CardData => ({ key: i.key, name: i.name, kind: i.kind, photoUrl: i.photo?.url, credit: i.photo?.credit, location: i.town ? `Near ${i.town}` : null, distance_m: i.distance_m, rating: i.avg_rating, ratingCount: i.rating_count, desc: i.description, source: i.source });

export default function Explore() {
  const router = useRouter();
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const { online, imperial, premium } = useApp();
  const cam = useRef<CameraRef>(null);
  const input = useRef<any>(null);
  const [q, setQ] = useState('');
  const [center, setCenter] = useState<{ lat: number; lng: number; label: string } | null>(null);
  const [items, setItems] = useState<ExploreItem[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<GeoResult[]>([]);
  const [view, setView] = useState<'list' | 'map'>('list');
  const [onlyCommunity, setOnlyCommunity] = useState(false);
  const seq = useRef(0);

  const load = useCallback(async (c: { lat: number; lng: number; label: string }) => {
    const my = ++seq.current;
    setCenter(c); setLoading(true); setError(null); setItems([]);
    try {
      const [osm, com] = await Promise.allSettled([searchOsmWater(c), searchCommunity(c)]);
      const all: ExploreItem[] = [];
      if (com.status === 'fulfilled') all.push(...com.value);
      if (osm.status === 'fulfilled') all.push(...osm.value);
      if (osm.status === 'rejected' && com.status === 'rejected') setError('Could not load locations. Check your connection and try again.');
      all.sort((a, b) => (a.distance_m ?? 0) - (b.distance_m ?? 0));
      if (my !== seq.current) return;
      setItems(all); setLoading(false);
      const top = all.slice(0, 40);
      await enrichItems(top, c);          // real photos + nearest town; fills in after first paint
      if (my === seq.current) setItems([...all]);
    } finally { if (my === seq.current) setLoading(false); }
  }, []);

  const nearMe = useCallback(async () => {
    setError(null);
    if (!(await ensureForegroundPermission())) { setError('Allow location access to find water near you, or search for a place above.'); return; }
    const l = await lastKnown();
    if (!l) { setError('Waiting for a GPS fix. Move to open sky or search for a place instead.'); return; }
    await load({ lat: l.lat, lng: l.lng, label: 'Near you' });
  }, [load]);
  useEffect(() => { if (online) void nearMe(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (focus) setTimeout(() => input.current?.focus(), 350); }, [focus]);

  const search = async () => {
    if (!q.trim()) return;
    setError(null); setResults([]);
    try {
      const r = await geocode(q);
      if (!r.length) setError(`No place found for “${q}”.`); else if (r.length === 1) await pick(r[0]); else setResults(r);
    } catch { setError('Search failed. Check your connection.'); }
  };
  const pick = async (r: GeoResult) => {
    setResults([]); setQ(r.name.split(',')[0]);
    cam.current?.flyTo({ center: [r.lng, r.lat], zoom: 10, duration: 800 });
    await load({ lat: r.lat, lng: r.lng, label: r.name });
  };

  const shown = useMemo(() => items.filter((i) => (filter === 'all' || i.kind === filter || (filter === 'stream' && i.kind === 'creek')) && (!onlyCommunity || i.source !== 'osm')), [items, filter, onlyCommunity]);
  const pins: MapPin[] = useMemo(() => shown.map((i) => ({ id: i.key, lat: i.lat, lng: i.lng, name: i.name, group: i.source === 'osm' ? 'osm' : 'community', kind: i.kind })), [shown]);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingHorizontal: 18, paddingTop: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={font.display}>Explore</Text>
          <View style={{ flexDirection: 'row', backgroundColor: colors.surface2, borderRadius: 20, padding: 3 }}>
            {(['list', 'map'] as const).map((v) => (
              <Pressy key={v} onPress={() => setView(v)} accessibilityLabel={`${v} view`} style={{ paddingHorizontal: 14, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 5, backgroundColor: view === v ? colors.primary : 'transparent' }}>
                <Ionicons name={v === 'list' ? 'list' : 'map'} size={15} color={view === v ? '#fff' : colors.muted} /><Text style={{ fontWeight: '700', fontSize: 13, color: view === v ? '#fff' : colors.muted }}>{v === 'list' ? 'List' : 'Map'}</Text>
              </Pressy>))}
          </View>
        </View>
        <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: 28, paddingHorizontal: 18, height: 54, marginTop: 14 }, shadow.soft]}>
          <Ionicons name="search" size={20} color={colors.muted} />
          <TextInput ref={input} value={q} onChangeText={setQ} onSubmitEditing={search} placeholder="City, state, ZIP code or place" placeholderTextColor={colors.faint} returnKeyType="search" autoCorrect={false}
            style={{ flex: 1, fontSize: 16, color: colors.ink, fontFamily: 'Inter_600SemiBold' }} />
          <Pressy onPress={nearMe} accessibilityLabel="Use my location" hitSlop={8}><View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.waterTint, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="locate" size={19} color={colors.water} /></View></Pressy>
        </View>
        {results.length > 0 && (
          <View style={[{ backgroundColor: colors.surface, borderRadius: radius.md, marginTop: 8, overflow: 'hidden' }, shadow.card]}>
            {results.map((r, i) => <Pressy key={i} scale={0.99} onPress={() => pick(r)} style={{ padding: 14, borderTopWidth: i ? 1 : 0, borderColor: colors.line }}><Text numberOfLines={2} style={font.body}>{r.name}</Text></Pressy>)}
          </View>
        )}
        <FlatList horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 14, flexGrow: 0 }} data={FILTERS} keyExtractor={(f) => f.key} renderItem={({ item }) => <Chip label={item.label} icon={item.icon} active={filter === item.key} onPress={() => setFilter(item.key)} />}
          ListFooterComponent={<Chip label={premium ? 'Community only' : 'Community only ★'} icon="people" active={onlyCommunity} onPress={() => { if (!premium) { router.push({ pathname: '/premium', params: { reason: 'filters' } }); return; } setOnlyCommunity((v) => !v); }} />} />
      </View>

      {!online && <View style={{ paddingHorizontal: 18 }}><Banner tone="info" icon="cloud-offline">You're offline. Exploring needs internet — your saved places are still in My Places and Map.</Banner></View>}
      {error && <View style={{ paddingHorizontal: 18 }}><Banner tone="warn" icon="alert-circle">{error}</Banner></View>}

      {view === 'map' ? (
        <View style={{ flex: 1, marginTop: 10, marginHorizontal: 12, marginBottom: 96, borderRadius: radius.lg, overflow: 'hidden' }}>
          <CreekMap styleKey="standard" cameraRef={cam} pins={pins} showUser attributionBottom={8} initial={center ? { center: [center.lng, center.lat], zoom: 9.5 } : undefined}
            onPressPin={(p) => { const it = items.find((x) => x.key === p.id); if (it) router.push(itemHref(it)); }} />
          {loading && <ActivityIndicator style={{ position: 'absolute', top: 14, alignSelf: 'center' }} color={colors.primary} />}
        </View>
      ) : (
        <FlatList
          contentContainerStyle={{ padding: 18, paddingBottom: 130, flexGrow: 1 }} data={shown} keyExtractor={(i) => i.key} showsVerticalScrollIndicator={false}
          ListHeaderComponent={shown.length ? <Text style={[font.small, { marginBottom: 12 }]}>{shown.length} places · {center?.label?.split(',')[0]} · sorted by distance</Text> : undefined}
          renderItem={({ item, index }) => <DestinationCard variant="full" index={index} imperial={imperial} d={toCard(item)} onPress={() => router.push(itemHref(item))} />}
          ListEmptyComponent={loading ? <View style={{ gap: 16 }}>{[0, 1, 2].map((i) => <Skeleton key={i} h={214} r={26} />)}</View> : (
            <Empty icon="compass-outline" title="Nothing found yet" body="Try another search or a larger area. Results come from OpenStreetMap and creeks shared by the CreekFinder community." action={<Button small title="Search near me" onPress={nearMe} />} />)}
          ListFooterComponent={shown.length ? <Text style={[font.small, { marginTop: 4 }]}>Photos: Wikimedia Commons & explorers. Data © OpenStreetMap contributors. Always confirm access and safety yourself.</Text> : undefined}
        />
      )}
    </SafeAreaView>
  );
}

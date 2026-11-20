import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '../../src/custom/Icon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import type { CameraRef } from '@maplibre/maplibre-react-native';
import { Alert } from '../../src/lib/alert';
import { CreekMap, type MapPin } from '../../src/components/CreekMap';
import { Button, IconButton, Pill, Pressy, Text } from '../../src/components/ui';
import { useDbQuery } from '../../src/state/hooks';
import { listPlaces, listVisits } from '../../src/db/local';
import { useApp } from '../../src/state/app';
import { canSaveMore, openDirections } from '../../src/lib/actions';
import { communityInBounds, geocode, searchOsmWater, searchParking } from '../../src/lib/explore';
import { ensureForegroundPermission, lastKnown, getPreciseFix } from '../../src/lib/location';
import { styleAvailable } from '../../src/lib/mapStyles';
import { formatCoords, formatDistance, haversine } from '../../src/lib/geo';
import { guideHref, itemHref } from '../../src/lib/nav';
import { kindLabel, type ExploreItem } from '../../src/types';
import { hasBackend } from '../../src/config';
import { colors, font, radius, shadow, space } from '../../src/theme';
import { themed } from '../../src/custom/themed';
import { allMapPresets, switchMapPreset, updateActiveMapPreset, useLibrary } from '../../src/custom/store';
import { useActiveMapPreset } from '../../src/custom/useMapPrefs';
import { MAP_STYLE_OPTIONS, type MapStyleId } from '../../src/custom/schema';
import { useRouter as _r } from 'expo-router';
void _r;

function MapTab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { premium, imperial, user } = useApp();
  const q = useLocalSearchParams<{ lat?: string; lng?: string; zoom?: string }>();
  const preset = useActiveMapPreset();
  const lib = useLibrary();
  const cam = useRef<CameraRef>(null);
  const [panel, setPanel] = useState(false);
  const [comm, setComm] = useState<ExploreItem[]>([]);
  const [osm, setOsm] = useState<ExploreItem[]>([]);
  const [parking, setParking] = useState<ExploreItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState<MapPin | null>(null);
  const [dropped, setDropped] = useState<{ lat: number; lng: number } | null>(null);
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  const [search, setSearch] = useState('');
  const bounds = useRef<[number, number, number, number] | null>(null);
  const zoomRef = useRef(3);
  const center = useRef<{ lat: number; lng: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastOsm = useRef<{ lat: number; lng: number } | null>(null);
  const lastPark = useRef<{ lat: number; lng: number } | null>(null);

  const places = useDbQuery(() => listPlaces(), [], []);
  const visits = useDbQuery(() => listVisits(300), [], []);
  const S = preset.show;

  const loadLayers = useCallback(async () => {
    if (!bounds.current) return;
    setLoading(true);
    try {
      if (S.community && zoomRef.current >= 7 && hasBackend && user) setComm(await communityInBounds(bounds.current));
      const c = center.current;
      if (S.nearbyWater && zoomRef.current >= 9.5 && c && (!lastOsm.current || haversine(lastOsm.current, c) > 8000)) { lastOsm.current = c; setOsm(await searchOsmWater(c, 15000)); }
      if (S.parking && zoomRef.current >= 12 && c && (!lastPark.current || haversine(lastPark.current, c) > 3000)) { lastPark.current = c; setParking(await searchParking(bounds.current)); }
    } catch {} finally { setLoading(false); }
  }, [S.community, S.nearbyWater, S.parking, user]);
  useEffect(() => { lastOsm.current = null; lastPark.current = null; void loadLayers(); }, [loadLayers]);

  const pins: MapPin[] = useMemo(() => {
    const out: MapPin[] = [];
    if (S.nearbyWater) for (const i of osm.slice(0, 150)) out.push({ id: `o:${i.key}`, lat: i.lat, lng: i.lng, name: i.name, group: 'osm', kind: i.kind });
    if (S.parking) for (const i of parking.slice(0, 120)) out.push({ id: `p:${i.key}`, lat: i.lat, lng: i.lng, name: i.name, group: 'parking' });
    if (S.community) for (const c of comm) if (!places.data.some((p) => p.source_place_id === c.placeId)) out.push({ id: `c:${c.placeId}`, lat: c.lat, lng: c.lng, name: c.name, group: 'community', kind: c.kind });
    if (S.visited) for (const v of visits.data) out.push({ id: `v:${v.id}`, lat: v.lat, lng: v.lng, name: v.name, group: 'visited', kind: v.kind ?? 'creek' });
    if (S.saved) for (const p of places.data) out.push({ id: `s:${p.id}`, lat: p.lat, lng: p.lng, name: p.name, group: 'saved', kind: p.kind });
    if (dropped) out.push({ id: 'dropped', lat: dropped.lat, lng: dropped.lng, name: 'Dropped pin', group: 'target' });
    return out;
  }, [places.data, visits.data, comm, osm, parking, S.saved, S.community, S.nearbyWater, S.parking, S.visited, dropped]);

  const locate = async () => {
    if (!(await ensureForegroundPermission())) { Alert.alert('Location off', 'Allow location access to see yourself on the map.'); return; }
    const f = (await lastKnown()) ?? (await getPreciseFix({ timeoutMs: 6000 }));
    setMe(f);
    cam.current?.flyTo({ center: [f.lng, f.lat], zoom: Math.max(14, preset.defaultZoom), duration: 900 });
  };
  useEffect(() => {
    if (q.lat && q.lng) { setTimeout(() => cam.current?.flyTo({ center: [Number(q.lng), Number(q.lat)], zoom: Number(q.zoom ?? 15), duration: 700 }), 400); return; }
    if (!preset.autoCenter) return;           // user chose not to auto-center
    void (async () => { if (!(await ensureForegroundPermission())) return; const f = await lastKnown(); if (f) { setMe(f); cam.current?.jumpTo({ center: [f.lng, f.lat], zoom: preset.defaultZoom }); } })();
  }, [q.lat, q.lng, preset.autoCenter]); // eslint-disable-line react-hooks/exhaustive-deps

  const pickStyle = (id: MapStyleId) => {
    const opt = MAP_STYLE_OPTIONS.find((o) => o.id === id)!;
    if (!styleAvailable(id)) { Alert.alert('Map key needed', 'Satellite, terrain and topographic maps need a MapTiler key. See docs/SETUP.md.'); return; }
    if (opt.premium && !premium) { router.push({ pathname: '/premium', params: { reason: 'maps' } }); return; }
    updateActiveMapPreset((p) => { p.style = id; });
  };
  const doSearch = async () => {
    if (!search.trim()) return;
    try { const r = await geocode(search); if (!r[0]) { Alert.alert('Not found', `No place found for “${search}”.`); return; } cam.current?.flyTo({ center: [r[0].lng, r[0].lat], zoom: 11, duration: 900 }); }
    catch { Alert.alert('Search failed', 'Searching needs an internet connection.'); }
  };

  const savedSel = sel?.id.startsWith('s:') ? places.data.find((p) => p.id === sel.id.slice(2)) : null;
  const osmSel = sel?.id.startsWith('o:') ? osm.find((i) => i.key === sel.id.slice(2)) : null;
  const visitSel = sel?.id.startsWith('v:') ? visits.data.find((v) => v.id === sel.id.slice(2)) : null;
  const openGuide = () => {
    if (!sel) return;
    if (sel.id.startsWith('s:')) router.push(guideHref({ source: 'saved', id: sel.id.slice(2) }));
    else if (sel.id.startsWith('c:')) router.push(guideHref({ source: 'community', id: sel.id.slice(2) }));
    else if (osmSel) router.push(itemHref(osmSel));
    else if (visitSel) router.push(visitSel.place_id ? guideHref({ source: 'saved', id: visitSel.place_id }) : guideHref({ source: 'osm', name: visitSel.name, kind: visitSel.kind ?? 'creek', lat: visitSel.lat, lng: visitSel.lng }));
    else router.push(guideHref({ source: 'osm', name: sel.name, kind: 'other', lat: sel.lat, lng: sel.lng }));
  };
  const saveHere = async () => { if (dropped && (await canSaveMore(premium, router.push))) router.push({ pathname: '/save', params: { lat: String(dropped.lat), lng: String(dropped.lng) } }); };
  const bottomGap = 104;
  const setShow = (k: keyof typeof S, v: boolean) => {
    if (k === 'community' && v) { if (!hasBackend) { Alert.alert('Community unavailable', 'Connect the backend (docs/SETUP.md) to see shared creeks.'); return; } if (!user) { router.push('/auth'); return; } }
    updateActiveMapPreset((p) => { p.show[k] = v; });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <CreekMap cameraRef={cam} pins={pins} selectedId={sel?.id ?? null} attributionBottom={bottomGap + (sel || dropped ? 150 : 56)}
        onPressPin={(p) => { setSel(p); setDropped(null); setPanel(false); }} onPressMap={() => { setSel(null); setPanel(false); }} onLongPress={(lat, lng) => { setDropped({ lat, lng }); setSel(null); }}
        onRegionChange={(e) => {
          if (e.bounds[2] !== 0) { bounds.current = e.bounds; zoomRef.current = e.zoom; center.current = { lat: e.center[1], lng: e.center[0] }; }
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => { void loadLayers(); }, 700);
        }} />

      <View style={{ position: 'absolute', top: insets.top + 10, left: 14, right: 14 }} pointerEvents="box-none">
        <View style={[{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.overlay, borderRadius: 28, paddingHorizontal: 16, height: 52, gap: 10 }, shadow.float]}>
          <Ionicons name="search" size={19} color={colors.muted} />
          <TextInput value={search} onChangeText={setSearch} onSubmitEditing={doSearch} placeholder="Search city, ZIP or place" placeholderTextColor={colors.faint} returnKeyType="search" autoCorrect={false} style={{ flex: 1, fontSize: 15.5, color: colors.ink }} />
          {loading ? <ActivityIndicator color={colors.primary} /> : <Pressable onPress={locate} hitSlop={8} accessibilityLabel="My location"><Ionicons name="locate" size={22} color={colors.water} /></Pressable>}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }} contentContainerStyle={{ gap: 8 }}>
          {allMapPresets(lib).map((p) => (
            <Pressy key={p.id} onPress={() => switchMapPreset(p.id)} accessibilityLabel={`Map preset ${p.name}`} scale={0.95}
              style={[{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 13, height: 36, borderRadius: 18, backgroundColor: preset.id === p.id ? colors.primary : colors.overlay }, shadow.soft]}>
              <Ionicons name={p.icon as any} size={15} color={preset.id === p.id ? colors.onPrimary : colors.primary} /><Text style={{ fontWeight: '700', fontSize: 12.5, color: preset.id === p.id ? colors.onPrimary : colors.ink }}>{p.name}</Text>
            </Pressy>))}
        </ScrollView>
        <View style={{ alignSelf: 'flex-end', marginTop: 10, gap: 10 }}>
          <IconButton icon="layers" label="Map layers" active={panel} onPress={() => setPanel((v) => !v)} />
          <IconButton icon="footsteps" label="Track a hike" onPress={() => router.push('/track')} />
          <IconButton icon="options" label="Customize map" onPress={() => router.push('/settings/map')} />
        </View>
        {panel && (
          <Animated.View entering={FadeInDown.duration(200)} exiting={FadeOutDown.duration(150)} style={[{ alignSelf: 'flex-end', marginTop: 10, width: 270, backgroundColor: colors.overlay, borderRadius: radius.md, padding: 14, gap: 4 }, shadow.float]}>
            <Text style={font.label}>Map type</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 8 }}>
              {MAP_STYLE_OPTIONS.map((o) => (
                <Pressy key={o.id} onPress={() => pickStyle(o.id)} accessibilityLabel={`${o.label} map`} style={{ width: 76, alignItems: 'center', gap: 3, paddingVertical: 8, borderRadius: 12, backgroundColor: preset.style === o.id ? colors.primary : colors.surface2 }}>
                  <Ionicons name={o.icon as any} size={18} color={preset.style === o.id ? colors.onPrimary : colors.ink} />
                  <Text numberOfLines={1} style={{ fontSize: 10.5, fontWeight: '700', color: preset.style === o.id ? colors.onPrimary : colors.ink }}>{o.label.split(' ')[0]}</Text>
                  {o.premium && !premium && <Ionicons name="lock-closed" size={10} color={colors.amber} />}
                </Pressy>))}
            </View>
            <Text style={font.label}>Show on map</Text>
            <Toggle label="My saved places" dot={colors.markerSaved} on={S.saved} onPress={() => setShow('saved', !S.saved)} />
            <Toggle label="Nearby water (OSM)" dot={colors.markerOsm} on={S.nearbyWater} onPress={() => setShow('nearbyWater', !S.nearbyWater)} />
            <Toggle label="Community creeks" dot={colors.markerCommunity} on={S.community} onPress={() => setShow('community', !S.community)} />
            <Toggle label="Visited places" dot={colors.markerVisited} on={S.visited} onPress={() => setShow('visited', !S.visited)} />
            <Toggle label="Parking areas" dot={colors.markerParking} on={S.parking} onPress={() => setShow('parking', !S.parking)} />
            <Toggle label="Hiking trail routes" dot="#D9562B" on={S.hikingTrails} onPress={() => setShow('hikingTrails', !S.hikingTrails)} />
          </Animated.View>
        )}
      </View>

      {sel && sel.id !== 'dropped' && (
        <Animated.View entering={FadeInDown.duration(250)} style={[{ position: 'absolute', left: 14, right: 14, bottom: bottomGap, backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg }, shadow.float]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1 }}><Text style={font.h2} numberOfLines={1}>{sel.name}</Text><Text style={font.small}>{sel.group === 'parking' ? 'Parking area' : kindLabel(sel.kind ?? 'creek')}{me ? `  ·  ${formatDistance(haversine(me, sel), imperial)} away` : ''}</Text></View>
            <Pill tone={sel.group === 'community' ? 'water' : sel.group === 'saved' ? 'ok' : 'neutral'} label={({ community: 'Community', saved: savedSel?.visibility === 'public' ? 'Saved · shared' : 'Saved', visited: 'Visited', parking: 'Parking', osm: 'OpenStreetMap', target: 'Pin' } as any)[sel.group]} />
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <Button small icon="book" title={sel.group === 'parking' ? 'Details' : 'Open guide'} style={{ flex: 1.3 }} onPress={openGuide} />
            <Button small variant="secondary" icon="navigate" title="Find it" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/navigate', params: { lat: String(sel.lat), lng: String(sel.lng), name: sel.name } })} />
            <Button small variant="secondary" icon="car" title="Drive" style={{ flex: 1 }} onPress={() => openDirections(sel.name, sel.lat, sel.lng)} />
          </View>
        </Animated.View>
      )}
      {dropped && !sel && (
        <Animated.View entering={FadeInDown.duration(250)} style={[{ position: 'absolute', left: 14, right: 14, bottom: bottomGap, backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg }, shadow.float]}>
          <Text style={font.h2}>Dropped pin</Text><Text selectable style={font.small}>{formatCoords(dropped.lat, dropped.lng, 6)}</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <Button small icon="location" title="Save a creek here" style={{ flex: 1.5 }} onPress={saveHere} />
            <Button small variant="secondary" icon="navigate" title="Find it" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/navigate', params: { lat: String(dropped.lat), lng: String(dropped.lng), name: 'Dropped pin' } })} />
            <Button small variant="ghost" title="Clear" onPress={() => setDropped(null)} />
          </View>
        </Animated.View>
      )}
      {!sel && !dropped && (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: bottomGap, alignItems: 'center' }} pointerEvents="box-none">
          <Pressy onPress={async () => { if (await canSaveMore(premium, router.push)) router.push('/save'); }} accessibilityLabel="Save this creek">
            <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: colors.water, paddingHorizontal: 24, height: 54, borderRadius: 27 }, shadow.float]}><Ionicons name="location" size={21} color="#fff" /><Text style={{ color: '#fff', fontWeight: '800', fontSize: 15.5, letterSpacing: 0.4 }}>SAVE THIS CREEK</Text></View>
          </Pressy>
          <Text style={{ color: '#fff', fontSize: 11.5, marginTop: 6, textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 4, fontWeight: '600' }}>Press & hold the map to drop a pin</Text>
        </View>
      )}
    </View>
  );
}

function Toggle({ label, dot, on, onPress }: { label: string; dot: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="switch" accessibilityState={{ checked: on }} accessibilityLabel={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 }}>
      <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: dot }} /><Text style={{ flex: 1, fontSize: 14, fontWeight: '600' }}>{label}</Text>
      <Ionicons name={on ? 'checkbox' : 'square-outline'} size={22} color={on ? colors.primary : colors.faint} />
    </Pressable>
  );
}
export default themed(MapTab);

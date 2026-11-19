import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import type { CameraRef } from '@maplibre/maplibre-react-native';
import { Alert } from '../../src/lib/alert';
import { CreekMap, type MapPin } from '../../src/components/CreekMap';
import { Button, IconButton, Pill, Pressy, Text } from '../../src/components/ui';
import { useDbQuery } from '../../src/state/hooks';
import { listPlaces } from '../../src/db/local';
import { useApp } from '../../src/state/app';
import { canSaveMore, openDirections } from '../../src/lib/actions';
import { communityInBounds, geocode, searchOsmWater } from '../../src/lib/explore';
import { ensureForegroundPermission, lastKnown, getPreciseFix } from '../../src/lib/location';
import { STYLE_OPTIONS, styleAvailable } from '../../src/lib/mapStyles';
import { formatCoords, formatDistance, haversine } from '../../src/lib/geo';
import { guideHref, itemHref } from '../../src/lib/nav';
import { kindLabel, type ExploreItem, type MapStyleKey } from '../../src/types';
import { hasBackend } from '../../src/config';
import { colors, font, radius, shadow, space } from '../../src/theme';

export default function MapTab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { premium, imperial, user } = useApp();
  const q = useLocalSearchParams<{ lat?: string; lng?: string; zoom?: string }>();
  const cam = useRef<CameraRef>(null);
  const [styleKey, setStyleKey] = useState<MapStyleKey>('standard');
  const [panel, setPanel] = useState(false);
  const [showCommunity, setShowCommunity] = useState(false);
  const [showOsm, setShowOsm] = useState(true);
  const [comm, setComm] = useState<ExploreItem[]>([]);
  const [osm, setOsm] = useState<ExploreItem[]>([]);
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

  const places = useDbQuery(() => listPlaces(), [], []);

  const loadLayers = useCallback(async () => {
    if (!bounds.current || zoomRef.current < 9.5) return;
    setLoading(true);
    try {
      if (showCommunity) setComm(await communityInBounds(bounds.current));
      const c = center.current;
      if (showOsm && c && (!lastOsm.current || haversine(lastOsm.current, c) > 8000)) { lastOsm.current = c; setOsm(await searchOsmWater(c, 15000)); }
    } catch {} finally { setLoading(false); }
  }, [showCommunity, showOsm]);
  useEffect(() => { void loadLayers(); }, [loadLayers]);

  const pins: MapPin[] = useMemo(() => {
    const out: MapPin[] = [];
    if (showOsm) for (const i of osm.slice(0, 150)) out.push({ id: `o:${i.key}`, lat: i.lat, lng: i.lng, name: i.name, group: 'osm', kind: i.kind });
    if (showCommunity) for (const c of comm) if (!places.data.some((p) => p.source_place_id === c.placeId)) out.push({ id: `c:${c.placeId}`, lat: c.lat, lng: c.lng, name: c.name, group: 'community', kind: c.kind });
    for (const p of places.data) out.push({ id: `s:${p.id}`, lat: p.lat, lng: p.lng, name: p.name, group: 'saved', kind: p.kind });
    if (dropped) out.push({ id: 'dropped', lat: dropped.lat, lng: dropped.lng, name: 'Dropped pin', group: 'target' });
    return out;
  }, [places.data, comm, osm, showCommunity, showOsm, dropped]);

  const locate = async () => {
    if (!(await ensureForegroundPermission())) { Alert.alert('Location off', 'Allow location access to see yourself on the map.'); return; }
    const f = (await lastKnown()) ?? (await getPreciseFix({ timeoutMs: 6000 }));
    setMe(f);
    cam.current?.flyTo({ center: [f.lng, f.lat], zoom: 15, duration: 900 });
  };
  useEffect(() => {
    if (q.lat && q.lng) { setTimeout(() => cam.current?.flyTo({ center: [Number(q.lng), Number(q.lat)], zoom: Number(q.zoom ?? 15), duration: 700 }), 400); return; }
    void (async () => { if (!(await ensureForegroundPermission())) return; const f = await lastKnown(); if (f) { setMe(f); cam.current?.jumpTo({ center: [f.lng, f.lat], zoom: 12 }); } })();
  }, [q.lat, q.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  const pickStyle = (k: MapStyleKey) => {
    const opt = STYLE_OPTIONS.find((o) => o.key === k)!;
    if (!styleAvailable(k)) { Alert.alert('Map key needed', 'Satellite and terrain maps need a MapTiler key. See docs/SETUP.md.'); return; }
    if (opt.premium && !premium) { router.push({ pathname: '/premium', params: { reason: 'maps' } }); return; }
    setStyleKey(k);
  };
  const doSearch = async () => {
    if (!search.trim()) return;
    try { const r = await geocode(search); if (!r[0]) { Alert.alert('Not found', `No place found for “${search}”.`); return; } cam.current?.flyTo({ center: [r[0].lng, r[0].lat], zoom: 11, duration: 900 }); }
    catch { Alert.alert('Search failed', 'Searching needs an internet connection.'); }
  };

  const savedSel = sel?.id.startsWith('s:') ? places.data.find((p) => p.id === sel.id.slice(2)) : null;
  const osmSel = sel?.id.startsWith('o:') ? osm.find((i) => i.key === sel.id.slice(2)) : null;
  const openGuide = () => {
    if (!sel) return;
    if (sel.id.startsWith('s:')) router.push(guideHref({ source: 'saved', id: sel.id.slice(2) }));
    else if (sel.id.startsWith('c:')) router.push(guideHref({ source: 'community', id: sel.id.slice(2) }));
    else if (osmSel) router.push(itemHref(osmSel));
  };
  const saveHere = async () => { if (dropped && (await canSaveMore(premium, router.push))) router.push({ pathname: '/save', params: { lat: String(dropped.lat), lng: String(dropped.lng) } }); };
  const bottomGap = 104;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <CreekMap
        styleKey={styleKey} cameraRef={cam} pins={pins} selectedId={sel?.id ?? null} attributionBottom={bottomGap + (sel || dropped ? 150 : 56)}
        onPressPin={(p) => { setSel(p); setDropped(null); setPanel(false); }}
        onPressMap={() => { setSel(null); setPanel(false); }}
        onLongPress={(lat, lng) => { setDropped({ lat, lng }); setSel(null); }}
        onRegionChange={(e) => {
          if (e.bounds[2] !== 0) { bounds.current = e.bounds; zoomRef.current = e.zoom; center.current = { lat: e.center[1], lng: e.center[0] }; }
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => { void loadLayers(); }, 700);
        }}
      />

      {/* search + controls */}
      <View style={{ position: 'absolute', top: insets.top + 10, left: 14, right: 14 }} pointerEvents="box-none">
        <View style={[{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.overlay, borderRadius: 28, paddingHorizontal: 16, height: 52, gap: 10 }, shadow.float]}>
          <Ionicons name="search" size={19} color={colors.muted} />
          <TextInput value={search} onChangeText={setSearch} onSubmitEditing={doSearch} placeholder="Search city, ZIP or place" placeholderTextColor={colors.faint} returnKeyType="search" autoCorrect={false}
            style={{ flex: 1, fontSize: 15.5, color: colors.ink, fontFamily: 'Inter_600SemiBold' }} />
          {loading ? <ActivityIndicator color={colors.primary} /> : <Pressable onPress={locate} hitSlop={8} accessibilityLabel="My location"><Ionicons name="locate" size={22} color={colors.water} /></Pressable>}
        </View>
        <View style={{ alignSelf: 'flex-end', marginTop: 10, gap: 10 }}>
          <IconButton icon="layers" label="Map layers" active={panel} onPress={() => setPanel((v) => !v)} />
          <IconButton icon="footsteps" label="Track a hike" onPress={() => router.push('/track')} />
        </View>
        {panel && (
          <Animated.View entering={FadeInDown.duration(200)} exiting={FadeOutDown.duration(150)} style={[{ alignSelf: 'flex-end', marginTop: 10, width: 250, backgroundColor: colors.overlay, borderRadius: radius.md, padding: 14, gap: 4 }, shadow.float]}>
            <Text style={font.label}>Map type</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginVertical: 8 }}>
              {STYLE_OPTIONS.map((o) => (
                <Pressy key={o.key} onPress={() => pickStyle(o.key)} style={{ flex: 1, alignItems: 'center', gap: 4, paddingVertical: 10, borderRadius: 14, backgroundColor: styleKey === o.key ? colors.primary : colors.surface2 }}>
                  <Ionicons name={o.icon as any} size={20} color={styleKey === o.key ? '#fff' : colors.ink} />
                  <Text style={{ fontSize: 11, fontWeight: '700', color: styleKey === o.key ? '#fff' : colors.ink }}>{o.label.split(' ')[0]}</Text>
                  {o.premium && !premium && <Ionicons name="lock-closed" size={11} color={colors.amber} />}
                </Pressy>))}
            </View>
            <Text style={font.label}>Show on map</Text>
            <Toggle label="Nearby water (OSM)" dot="#7A8F86" on={showOsm} onPress={() => setShowOsm((v) => !v)} />
            <Toggle label="Community creeks" dot={colors.water} on={showCommunity} onPress={() => {
              if (!hasBackend) { Alert.alert('Community unavailable', 'Connect the backend (docs/SETUP.md) to see shared creeks.'); return; }
              if (!user) { router.push('/auth'); return; }
              setShowCommunity((v) => !v);
            }} />
            <Toggle label="My saved places" dot={colors.primary} on disabled onPress={() => {}} />
          </Animated.View>
        )}
      </View>

      {/* bottom cards */}
      {sel && sel.id !== 'dropped' && (
        <Animated.View entering={FadeInDown.duration(250)} style={[{ position: 'absolute', left: 14, right: 14, bottom: bottomGap, backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg }, shadow.float]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={font.h2} numberOfLines={1}>{sel.name}</Text>
              <Text style={font.small}>{kindLabel(sel.kind ?? 'creek')}{me ? `  ·  ${formatDistance(haversine(me, sel), imperial)} away` : ''}</Text>
            </View>
            <Pill tone={sel.group === 'community' ? 'water' : sel.group === 'saved' ? 'ok' : 'neutral'} label={sel.group === 'community' ? 'Community' : sel.group === 'saved' ? (savedSel?.visibility === 'public' ? 'Saved · shared' : 'Saved') : 'OpenStreetMap'} />
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <Button small icon="book" title="Open guide" style={{ flex: 1.3 }} onPress={openGuide} />
            <Button small variant="secondary" icon="navigate" title="Find it" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/navigate', params: { lat: String(sel.lat), lng: String(sel.lng), name: sel.name } })} />
            <Button small variant="secondary" icon="car" title="Drive" style={{ flex: 1 }} onPress={() => openDirections(sel.name, sel.lat, sel.lng)} />
          </View>
        </Animated.View>
      )}
      {dropped && !sel && (
        <Animated.View entering={FadeInDown.duration(250)} style={[{ position: 'absolute', left: 14, right: 14, bottom: bottomGap, backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg }, shadow.float]}>
          <Text style={font.h2}>Dropped pin</Text>
          <Text selectable style={font.small}>{formatCoords(dropped.lat, dropped.lng, 6)}</Text>
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
            <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: colors.water, paddingHorizontal: 24, height: 54, borderRadius: 27 }, shadow.float]}>
              <Ionicons name="location" size={21} color="#fff" /><Text style={{ color: '#fff', fontWeight: '800', fontSize: 15.5, letterSpacing: 0.4 }}>SAVE THIS CREEK</Text>
            </View>
          </Pressy>
          <Text style={{ color: '#fff', fontSize: 11.5, marginTop: 6, textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 4, fontWeight: '600' }}>Press & hold the map to drop a pin</Text>
        </View>
      )}
    </View>
  );
}

function Toggle({ label, dot, on, onPress, disabled }: { label: string; dot: string; on: boolean; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 }}>
      <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: dot }} />
      <Text style={{ flex: 1, fontSize: 14, fontWeight: '600' }}>{label}</Text>
      <Ionicons name={on ? 'checkbox' : 'square-outline'} size={22} color={on ? colors.primary : colors.faint} />
    </Pressable>
  );
}

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Alert } from '../../src/lib/alert';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CameraRef } from '@maplibre/maplibre-react-native';
import { CreekMap, type MapPin } from '../../src/components/CreekMap';
import { SaveCreekButton } from '../../src/components/Bits';
import { Button } from '../../src/components/ui';
import { useDbQuery } from '../../src/state/hooks';
import { listPlaces } from '../../src/db/local';
import { useApp } from '../../src/state/app';
import { canSaveMore, openDirections } from '../../src/lib/actions';
import { communityInBounds } from '../../src/lib/explore';
import { ensureForegroundPermission, lastKnown, getPreciseFix } from '../../src/lib/location';
import { STYLE_OPTIONS, styleAvailable } from '../../src/lib/mapStyles';
import { formatCoords, formatDistance, haversine } from '../../src/lib/geo';
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
  const [showStyles, setShowStyles] = useState(false);
  const [community, setCommunity] = useState(false);
  const [commItems, setCommItems] = useState<ExploreItem[]>([]);
  const [loadingComm, setLoadingComm] = useState(false);
  const [sel, setSel] = useState<MapPin | null>(null);
  const [dropped, setDropped] = useState<{ lat: number; lng: number } | null>(null);
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  const bounds = useRef<[number, number, number, number] | null>(null);
  const zoomRef = useRef(3);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const places = useDbQuery(() => listPlaces(), [], []);

  const loadCommunity = useCallback(async () => {
    if (!community || !bounds.current || zoomRef.current < 7) return;
    setLoadingComm(true);
    try { setCommItems(await communityInBounds(bounds.current)); } catch {} finally { setLoadingComm(false); }
  }, [community]);
  useEffect(() => { void loadCommunity(); }, [loadCommunity]);

  const pins: MapPin[] = useMemo(() => {
    const out: MapPin[] = places.data.map((p) => ({ id: `s:${p.id}`, lat: p.lat, lng: p.lng, name: p.name, group: 'saved', kind: p.kind }));
    if (community) for (const c of commItems) if (!places.data.some((p) => p.source_place_id === c.placeId)) out.push({ id: `c:${c.placeId}`, lat: c.lat, lng: c.lng, name: c.name, group: 'community', kind: c.kind });
    if (dropped) out.push({ id: 'dropped', lat: dropped.lat, lng: dropped.lng, name: 'Dropped pin', group: 'target' });
    return out;
  }, [places.data, commItems, community, dropped]);

  const locate = async () => {
    if (!(await ensureForegroundPermission())) { Alert.alert('Location off', 'Allow location access in Settings to see yourself on the map.'); return; }
    const f = (await lastKnown()) ?? (await getPreciseFix({ timeoutMs: 6000 }));
    setMe(f);
    cam.current?.flyTo({ center: [f.lng, f.lat], zoom: 15, duration: 900 });
  };

  useEffect(() => {
    if (q.lat && q.lng) { setTimeout(() => cam.current?.flyTo({ center: [Number(q.lng), Number(q.lat)], zoom: Number(q.zoom ?? 15), duration: 700 }), 400); return; }
    void (async () => {
      if (!(await ensureForegroundPermission())) return;
      const f = await lastKnown();
      if (f) { setMe(f); cam.current?.jumpTo({ center: [f.lng, f.lat], zoom: 12 }); }
    })();
  }, [q.lat, q.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  const pickStyle = (k: MapStyleKey) => {
    const opt = STYLE_OPTIONS.find((o) => o.key === k)!;
    if (!styleAvailable(k)) { Alert.alert('Map key needed', 'Satellite and terrain maps need a MapTiler key. See docs/SETUP.md.'); return; }
    if (opt.premium && !premium) { router.push({ pathname: '/premium', params: { reason: 'maps' } }); return; }
    setStyleKey(k); setShowStyles(false);
  };

  const savedSel = sel?.id.startsWith('s:') ? places.data.find((p) => p.id === sel.id.slice(2)) : null;
  const saveHere = async () => {
    if (!dropped) return;
    if (await canSaveMore(premium, router.push)) router.push({ pathname: '/save', params: { lat: String(dropped.lat), lng: String(dropped.lng) } });
  };

  return (
    <View style={{ flex: 1 }}>
      <CreekMap
        styleKey={styleKey} cameraRef={cam} pins={pins} selectedId={sel?.id ?? null}
        attributionBottom={sel || dropped ? 190 : 100}
        onPressPin={(p) => { setSel(p); setDropped(null); }}
        onPressMap={() => { setSel(null); setShowStyles(false); }}
        onLongPress={(lat, lng) => { setDropped({ lat, lng }); setSel(null); }}
        onRegionChange={(e) => {
          bounds.current = e.bounds; zoomRef.current = e.zoom;
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => { void loadCommunity(); }, 600);
        }}
      />

      <View style={[s.top, { top: insets.top + 8 }]} pointerEvents="box-none">
        <View style={s.toolbar}>
          <Tool icon="layers" label="Layers" active={showStyles} onPress={() => setShowStyles((v) => !v)} />
          <Tool icon="people" label="Community" active={community} onPress={() => {
            if (!hasBackend) { Alert.alert('Community unavailable', 'Connect the backend (docs/SETUP.md) to see shared creeks.'); return; }
            if (!user) { router.push('/auth'); return; }
            setCommunity((v) => !v);
          }} />
          <Tool icon="locate" label="Me" onPress={locate} />
          <Tool icon="footsteps" label="Track" onPress={() => router.push('/track')} />
        </View>
        {showStyles && (
          <View style={s.styles}>
            {STYLE_OPTIONS.map((o) => (
              <Pressable key={o.key} onPress={() => pickStyle(o.key)} style={[s.styleRow, styleKey === o.key && { backgroundColor: colors.waterLight }]}>
                <Ionicons name={o.icon as any} size={20} color={colors.forest} />
                <Text style={{ flex: 1, fontWeight: '700', color: colors.ink }}>{o.label}</Text>
                {o.premium && !premium && <Ionicons name="lock-closed" size={15} color={colors.warn} />}
                {styleKey === o.key && <Ionicons name="checkmark" size={18} color={colors.forest} />}
              </Pressable>
            ))}
          </View>
        )}
        {loadingComm && <ActivityIndicator style={{ alignSelf: 'center', marginTop: 8 }} color={colors.water} />}
        {community && zoomRef.current < 7 && <Text style={s.hint}>Zoom in to load community creeks</Text>}
      </View>

      {sel && (
        <View style={[s.sheet]}>
          <Text style={font.h2} numberOfLines={1}>{sel.name}</Text>
          <Text style={font.small}>
            {sel.group === 'community' ? 'Community · unverified user submission' : `Saved · ${kindLabel(sel.kind ?? 'creek')}`}
            {me ? `  ·  ${formatDistance(haversine(me, sel), imperial)} away` : ''}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            <Button small icon="open" title="Details" style={{ flex: 1 }} onPress={() => router.push(sel.group === 'community'
              ? { pathname: '/public/[id]', params: { id: sel.id.slice(2) } } : { pathname: '/place/[id]', params: { id: sel.id.slice(2) } })} />
            <Button small variant="secondary" icon="navigate" title="Find it" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/navigate', params: { lat: String(sel.lat), lng: String(sel.lng), name: sel.name } })} />
            <Button small variant="secondary" icon="car" title="Drive" style={{ flex: 1 }} onPress={() => openDirections(sel.name, sel.lat, sel.lng)} />
          </View>
        </View>
      )}

      {dropped && !sel && (
        <View style={s.sheet}>
          <Text style={font.h2}>Dropped pin</Text>
          <Text selectable style={font.small}>{formatCoords(dropped.lat, dropped.lng, 6)}</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            <Button small icon="location" title="Save a creek here" style={{ flex: 1.4 }} onPress={saveHere} />
            <Button small variant="secondary" icon="navigate" title="Find it" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/navigate', params: { lat: String(dropped.lat), lng: String(dropped.lng), name: 'Dropped pin' } })} />
            <Button small variant="ghost" title="Clear" onPress={() => setDropped(null)} />
          </View>
        </View>
      )}

      {!sel && !dropped && (
        <View style={s.saveWrap}>
          <SaveCreekButton compact onPress={async () => { if (await canSaveMore(premium, router.push)) router.push('/save'); }} />
          <Text style={s.longHint}>Tip: press and hold the map to drop a pin</Text>
        </View>
      )}
    </View>
  );
}

function Tool({ icon, label, onPress, active }: { icon: any; label: string; onPress: () => void; active?: boolean }) {
  return (
    <Pressable onPress={onPress} style={[s.tool, active && { backgroundColor: colors.forest }]} accessibilityRole="button" accessibilityLabel={label}>
      <Ionicons name={icon} size={22} color={active ? '#fff' : colors.forest} />
      <Text style={{ fontSize: 10.5, fontWeight: '700', color: active ? '#fff' : colors.forest }}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  top: { position: 'absolute', left: 12, right: 12 },
  toolbar: { flexDirection: 'row', alignSelf: 'flex-end', gap: 8 },
  tool: { width: 58, height: 52, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.96)', alignItems: 'center', justifyContent: 'center', ...shadow },
  styles: { alignSelf: 'flex-end', marginTop: 8, backgroundColor: '#fff', borderRadius: radius.md, width: 220, overflow: 'hidden', ...shadow },
  styleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  hint: { alignSelf: 'center', marginTop: 8, backgroundColor: 'rgba(255,255,255,0.95)', color: colors.muted, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, overflow: 'hidden', fontSize: 12.5 },
  sheet: { position: 'absolute', left: 12, right: 12, bottom: 12, backgroundColor: '#fff', borderRadius: radius.lg, padding: space.lg, ...shadow },
  saveWrap: { position: 'absolute', left: 14, right: 14, bottom: 14 },
  longHint: { textAlign: 'center', color: '#fff', fontSize: 12, marginTop: 6, textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 4 },
});

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Alert } from '../src/lib/alert';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CameraRef } from '@maplibre/maplibre-react-native';
import { CreekMap } from '../src/components/CreekMap';
import { Button } from '../src/components/ui';
import { getAdventure, getPlace, getTrackPoints } from '../src/db/local';
import { ensureForegroundPermission, watchFixes, watchHeading, type Fix } from '../src/lib/location';
import { bearing, compassLabel, formatDistance, haversine, nearestIndex, pathLength } from '../src/lib/geo';
import { openDirections } from '../src/lib/actions';
import { useApp } from '../src/state/app';
import { colors, radius, shadow, space } from '../src/theme';

type Target = { name: string; lat: number; lng: number };

/**
 * "Find it" guidance. Works with no signal (GPS only; map tiles come from the offline cache if downloaded).
 *  - /navigate?id=<placeId>        : guide to a saved creek
 *  - /navigate?lat&lng&name        : guide to any coordinate
 *  - /navigate?adventure=<id>      : retrace a recorded track back to its start
 */
export default function Navigate() {
  const q = useLocalSearchParams<{ id?: string; lat?: string; lng?: string; name?: string; adventure?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { imperial } = useApp();
  const cam = useRef<CameraRef>(null);
  const [target, setTarget] = useState<Target | null>(q.lat && q.lng ? { name: q.name ?? 'Destination', lat: Number(q.lat), lng: Number(q.lng) } : null);
  const [track, setTrack] = useState<{ lat: number; lng: number }[]>([]);
  const [me, setMe] = useState<Fix | null>(null);
  const [heading, setHeading] = useState(0);
  const [followed, setFollowed] = useState(true);

  useEffect(() => {
    if (q.id) void getPlace(q.id).then((p) => p && setTarget({ name: p.name, lat: p.lat, lng: p.lng }));
    if (q.adventure) {
      void Promise.all([getAdventure(q.adventure), getTrackPoints(q.adventure)]).then(([a, pts]) => {
        if (!pts.length) { Alert.alert('No track', 'This adventure has no recorded GPS points.'); return; }
        setTrack(pts);
        setTarget({ name: `Start of "${a?.name ?? 'adventure'}"`, lat: pts[0].lat, lng: pts[0].lng });
      });
    }
  }, [q.id, q.adventure]);

  useEffect(() => {
    let offA: (() => void) | undefined, offB: (() => void) | undefined;
    void ensureForegroundPermission().then(async (ok) => {
      if (!ok) { Alert.alert('Location needed', 'Allow location access to be guided.'); return; }
      offA = await watchFixes(setMe, 3);
      try { offB = await watchHeading(setHeading); } catch {}
    });
    return () => { offA?.(); offB?.(); };
  }, []);

  // For a retrace, guide along the recorded path (reversed) rather than as the crow flies.
  const route = useMemo(() => {
    if (!target) return [];
    if (track.length && me) {
      const i = nearestIndex(track, me);
      return [{ lat: me.lat, lng: me.lng }, ...track.slice(0, i + 1).reverse()];
    }
    return me ? [{ lat: me.lat, lng: me.lng }, target] : [];
  }, [track, me, target]);

  useEffect(() => { if (followed && me) cam.current?.easeTo({ center: [me.lng, me.lat], zoom: 17, duration: 600 }); }, [me, followed]);

  const direct = me && target ? haversine(me, target) : null;
  const along = route.length > 1 ? pathLength(route) : null;
  const next = route.length > 1 ? route[1] : target;
  const brg = me && next ? bearing(me, next) : 0;
  const arrow = (((brg - heading) % 360) + 360) % 360;
  const arrived = direct != null && direct < 15;

  return (
    <View style={{ flex: 1 }}>
      <CreekMap
        styleKey="standard" showUser cameraRef={cam}
        pins={target ? [{ id: 'target', lat: target.lat, lng: target.lng, name: target.name, group: 'target' }] : []}
        guide={route} track={track.length ? track : undefined}
        initial={target ? { center: [target.lng, target.lat], zoom: 15 } : undefined}
        onRegionChange={(e) => { if (e.userInteraction) setFollowed(false); }}
        attributionBottom={230}
      />
      <View style={[s.panel, { paddingBottom: insets.bottom + space.md }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <View style={s.arrowWrap}>
            <Ionicons name="navigate" size={40} color={arrived ? colors.ok : colors.water} style={{ transform: [{ rotate: `${arrow - 45}deg` }] }} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, color: colors.muted, fontWeight: '700' }} numberOfLines={1}>{target?.name ?? 'Loading…'}</Text>
            <Text style={{ fontSize: 32, fontWeight: '900', color: arrived ? colors.ok : colors.ink }}>
              {arrived ? 'You are here' : direct != null ? formatDistance(track.length && along ? along : direct, imperial) : '…'}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 14 }}>
              {me && target ? `Head ${compassLabel(brg)} (${Math.round(brg)}°)${track.length ? ' along your recorded path' : ' · straight-line distance'}` : 'Waiting for GPS…'}
              {me?.accuracy != null ? `  ·  GPS ±${Math.round(me.accuracy)} m` : ''}
            </Text>
          </View>
        </View>
        <Text style={{ color: colors.muted, fontSize: 12.5, marginTop: 8 }}>
          The arrow points the way as the crow flies — terrain, fences and water may block a direct route. Don't cross private property or enter dangerous water.
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
          <Button small variant="secondary" icon="locate" title="Recenter" onPress={() => setFollowed(true)} style={{ flex: 1 }} />
          {target && !q.adventure && <Button small variant="secondary" icon="car" title="Driving directions" onPress={() => openDirections(target.name, target.lat, target.lng)} style={{ flex: 1.3 }} />}
          <Button small variant="ghost" title="Done" onPress={() => router.back()} />
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  panel: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.white, padding: space.lg, borderTopLeftRadius: 24, borderTopRightRadius: 24, ...shadow },
  arrowWrap: { width: 76, height: 76, borderRadius: radius.pill, backgroundColor: colors.waterLight, alignItems: 'center', justifyContent: 'center' },
});

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '../src/custom/Icon';
import type { CameraRef } from '@maplibre/maplibre-react-native';
import { Alert } from '../src/lib/alert';
import { Banner, Button, Card, IconButton, Pill, Pressy, Skeleton, Text } from '../src/components/ui';
import { CreekMap, type MapPin, type MapRoute } from '../src/components/CreekMap';
import { findAccess } from '../src/lib/access';
import { type Access, type AccessResult, type Place, type Route } from '../src/custom/accessFinder';
import { useLoad } from '../src/state/hooks';
import { useApp } from '../src/state/app';
import { kvSet } from '../src/db/local';
import { openDirections } from '../src/lib/actions';
import { formatDistance } from '../src/lib/geo';
import { colors, font, radius, shadow } from '../src/theme';
import { themed } from '../src/custom/themed';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ROUTE_COLORS = ['#FF6D00', '#1E90FF', '#B24BFF', '#E91E63'];
const accessPill = (a: Access) => a === 'public' ? <Pill tone="ok" icon="checkmark-circle" label="Tagged public" /> : a === 'unknown' ? <Pill tone="amber" icon="help-circle" label="Access not tagged" /> : a === 'permit' ? <Pill tone="amber" icon="document" label="Permit" /> : <Pill tone="danger" icon="close-circle" label="Closed" />;

/** Access Finder: how do I actually get to this spot? Built only from OpenStreetMap data — never legal advice. */
function AccessScreen() {
  const q = useLocalSearchParams<{ lat: string; lng: string; name?: string }>();
  const router = useRouter(); const insets = useSafeAreaInsets(); const { imperial, online } = useApp();
  const target = useMemo(() => ({ lat: Number(q.lat), lng: Number(q.lng) }), [q.lat, q.lng]);
  const name = q.name || 'this spot';
  const cam = useRef<CameraRef>(null);
  const res = useLoad(() => findAccess(target), [target.lat, target.lng]);
  const r: AccessResult | null = res.data?.result ?? null;
  const [sel, setSel] = useState<string | null>(null);
  const D = (m: number) => formatDistance(m, imperial);

  const routes: MapRoute[] = useMemo(() => (r?.routes ?? []).map((x, i) => ({ id: x.id, coords: x.coords, color: ROUTE_COLORS[i % 4], width: sel === x.id ? 6 : sel ? 3 : 4.5, dash: x.confidence === 'unverified' })), [r, sel]);
  const pins: MapPin[] = useMemo(() => {
    const out: MapPin[] = [{ id: 'target', lat: target.lat, lng: target.lng, name, group: 'target' }];
    if (!r) return out;
    for (const p of [...r.trailheads, ...r.entrances]) out.push({ id: `e:${p.id}`, lat: p.at.lat, lng: p.at.lng, name: p.name, group: 'trailEntrance' });
    for (const p of r.parking) out.push({ id: `p:${p.id}`, lat: p.at.lat, lng: p.at.lng, name: p.name, group: 'parking' });
    for (const p of r.accessPoints) out.push({ id: `a:${p.id}`, lat: p.at.lat, lng: p.at.lng, name: p.name, group: 'creekAccess' });
    for (const b of r.bridges) out.push({ id: `b:${b.id}`, lat: b.at.lat, lng: b.at.lng, name: b.name, group: 'bridge' });
    if (r.nearestRoad) out.push({ id: 'road', lat: r.nearestRoad.at.lat, lng: r.nearestRoad.at.lng, name: r.nearestRoad.name, group: 'osm' });
    return out;
  }, [r, target, name]);
  useEffect(() => {
    if (!r) return; const pts: [number, number][] = [[target.lng, target.lat]]; for (const x of r.routes.slice(0, 2)) for (const c of x.coords) pts.push(c);
    if (pts.length < 2) { cam.current?.jumpTo({ center: [target.lng, target.lat], zoom: 15.5 }); return; }
    const w = Math.min(...pts.map((p) => p[0])), e = Math.max(...pts.map((p) => p[0])), s = Math.min(...pts.map((p) => p[1])), n = Math.max(...pts.map((p) => p[1]));
    setTimeout(() => cam.current?.fitBounds([w, s, e, n], { padding: { top: 50, bottom: 50, left: 40, right: 40 }, duration: 0 }), 500);
  }, [r, target.lat, target.lng]);

  const guide = async (x: Route) => { await kvSet('nav_route', JSON.stringify({ name, from: x.from.name, coords: x.coords.slice().reverse() })); router.push({ pathname: '/navigate', params: { route: '1' } }); };
  const best = r?.routes[0];
  const placeRow = (p: Place, icon: string) => (
    <View key={p.id} style={[{ backgroundColor: colors.surface, borderRadius: radius.md, padding: 12, marginBottom: 8 }, shadow.soft]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.waterTint, alignItems: 'center', justifyContent: 'center' }}><Ionicons name={icon as any} size={18} color={colors.water} /></View>
        <View style={{ flex: 1 }}><Text style={{ fontWeight: '700' }} numberOfLines={1}>{p.name}</Text>
          <Text style={font.small}>{p.walk_m != null ? `${D(p.walk_m)} walk to the spot · ~${p.minutes} min · ` : ''}{D(p.straight_m)} straight-line{p.note ? ` · ${p.note}` : ''}</Text></View>
      </View>
      <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>{p.inferred ? <Pill tone="neutral" icon="git-branch" label="Inferred: trail meets a road" /> : accessPill(p.access)}
        <Pressy onPress={() => openDirections(p.name, p.at.lat, p.at.lng)} accessibilityLabel={`Directions to ${p.name}`}><Pill tone="water" icon="car" label="Directions here" /></Pressy></View>
    </View>);
  const H = ({ icon, t, sub }: { icon: string; t: string; sub?: string }) => (<View style={{ marginTop: 22, marginBottom: 10 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Ionicons name={icon as any} size={19} color={colors.primary} /><Text style={font.h2}>{t}</Text></View>{sub ? <Text style={font.small}>{sub}</Text> : null}</View>);
  const none = (t: string) => <Text style={[font.small, { fontStyle: 'italic', color: colors.faint }]}>{t}</Text>;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ height: 330 }}>
        <CreekMap cameraRef={cam} pins={pins} routes={routes} showUser initial={{ center: [target.lng, target.lat], zoom: 14.5 }} attributionBottom={6} />
        <View style={{ position: 'absolute', top: insets.top + 8, left: 14 }}><IconButton icon="chevron-back" label="Back" onPress={() => router.back()} /></View>
        <View style={{ position: 'absolute', top: insets.top + 8, right: 14, left: 70, backgroundColor: colors.overlay, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9, ...shadow.soft }}><Text style={{ fontWeight: '800' }} numberOfLines={1}>Access to {name}</Text></View>
      </View>
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 90 }} showsVerticalScrollIndicator={false}>
        <Banner tone="warn" icon="warning">Based on OpenStreetMap, which can be wrong or out of date. “Tagged public” only means the map doesn’t say it’s closed — CreekFinder has no land-ownership or property-line data and can’t tell you where you’re allowed to go. Confirm signs, gates and access yourself. Never trespass.</Banner>
        {res.loading ? <View style={{ gap: 10, marginTop: 8 }}><Skeleton h={90} r={18} /><Skeleton h={90} r={18} /><Skeleton h={90} r={18} /></View> : res.error || !r ? (
          <Banner tone="info" icon="cloud-offline">{online ? 'Could not load map data right now. Try again in a moment.' : 'You’re offline. The Access Finder works offline for spots you’ve opened before.'}</Banner>
        ) : (<>
          {res.data?.stale && <Banner tone="info" icon="time">Showing saved data from an earlier visit (you’re offline or the server is busy).</Banner>}
          <Card style={{ marginTop: 6 }}>
            <Text style={font.label}>Best way in found</Text>
            {best ? (<>
              <Text style={{ fontSize: 22, fontWeight: '800', marginTop: 4 }}>{D(best.walk_m)} · ~{best.minutes} min walk</Text>
              <Text style={font.body}>from {best.from.name}{best.from.inferred ? ' (inferred trail start)' : ''}</Text>
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>{best.confidence === 'tagged-public' ? <Pill tone="ok" icon="checkmark-circle" label="All ways tagged public" /> : <Pill tone="amber" icon="help-circle" label="Unverified — check access" />}<Pill label={`${D(best.trail_m)} trail · ${D(best.road_m)} road`} /></View>
            </>) : <Text style={[font.body, { marginTop: 4 }]}>No walking route could be computed from the mapped paths.</Text>}
            {r.warnings.map((w, i) => <Text key={i} style={[font.small, { marginTop: 6 }]}>• {w}</Text>)}
          </Card>

          <H icon="walk" t="Possible walking routes" sub="Computed over mapped foot paths and roads, skipping anything tagged private / no access. Dashed lines on the map = some ways aren’t tagged public." />
          {r.routes.length === 0 ? none('No route found.') : r.routes.map((x, i) => (
            <View key={x.id} style={[{ backgroundColor: colors.surface, borderRadius: radius.md, padding: 14, marginBottom: 10, borderLeftWidth: 6, borderLeftColor: ROUTE_COLORS[i % 4], opacity: sel && sel !== x.id ? 0.7 : 1 }, shadow.soft]}>
              <Text style={{ fontWeight: '800', fontSize: 16 }}>Route {i + 1} · from {x.from.name}</Text>
              <Text style={font.body}>{D(x.walk_m)} · ~{x.minutes} min · {D(x.trail_m)} on trails, {D(x.road_m)} on roads</Text>
              {x.ways.length ? <Text style={font.small}>via {x.ways.join(', ')}</Text> : null}
              {x.notes.map((n, k) => <Text key={k} style={[font.small, { marginTop: 3 }]}>• {n}</Text>)}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                <Button small variant={sel === x.id ? 'primary' : 'secondary'} icon="map" title={sel === x.id ? 'Showing' : 'Show on map'} style={{ flex: 1 }} onPress={() => setSel(sel === x.id ? null : x.id)} />
                <Button small icon="navigate" title="Guide me" style={{ flex: 1 }} onPress={() => guide(x)} />
                <Button small variant="secondary" icon="car" title="To start" style={{ flex: 1 }} onPress={() => openDirections(x.from.name, x.from.at.lat, x.from.at.lng)} />
              </View>
            </View>))}

          <H icon="enter" t="Trail entrances" sub="Mapped trailheads, plus places where a trail meets a road (inferred)." />
          {r.trailheads.length + r.entrances.length === 0 ? none('No trailheads or trail starts found nearby.') : [...r.trailheads, ...r.entrances].sort((a, b) => (a.walk_m ?? 1e9) - (b.walk_m ?? 1e9)).slice(0, 8).map((p) => placeRow(p, 'enter'))}
          <H icon="car" t="Legal-looking parking" sub="Public lots, or lots whose access isn’t tagged. Private / customer-only lots are excluded." />
          {r.parking.length === 0 ? none('No public parking mapped nearby.') : r.parking.map((p) => placeRow(p, 'car'))}
          <H icon="boat" t="Public access points" sub="Water access, boat ramps and put-ins." />
          {r.accessPoints.length === 0 ? none('No mapped access points nearby.') : r.accessPoints.map((p) => placeRow(p, 'boat'))}
          <H icon="git-compare" t="Bridges" sub="Bridges that cross a mapped stream or river are listed first." />
          {r.bridges.length === 0 ? none('No bridges mapped nearby.') : r.bridges.map((b) => (
            <View key={b.id} style={[{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: radius.md, padding: 12, marginBottom: 8 }, shadow.soft]}>
              <Ionicons name="git-compare" size={20} color={colors.danger} /><View style={{ flex: 1 }}><Text style={{ fontWeight: '700' }}>{b.name}</Text><Text style={font.small}>{D(b.straight_m)} away{b.crossesWaterway ? ` · crosses ${b.waterway}` : ''}</Text></View>
              {b.crossesWaterway && <Pill tone="water" icon="water" label="Crosses creek" />}</View>))}
          <H icon="trail-sign" t="Paths leading toward this spot" sub="Mapped paths that pass within 150 m." />
          {r.paths.length === 0 ? none('No mapped path passes close to this spot.') : r.paths.map((p) => (
            <View key={p.id} style={[{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: radius.md, padding: 12, marginBottom: 8 }, shadow.soft]}>
              <Ionicons name="walk" size={20} color={colors.primary} /><View style={{ flex: 1 }}><Text style={{ fontWeight: '700' }}>{p.name}</Text><Text style={font.small}>passes {D(p.closest_m)} from the spot</Text></View>{accessPill(p.access)}</View>))}
          <H icon="trail-sign" t="Nearest road access" />
          {r.nearestRoad ? placeRow(r.nearestRoad, 'trail-sign') : none('No drivable road mapped nearby.')}
          <Text style={[font.small, { marginTop: 16 }]}>Data © OpenStreetMap contributors. {r.counts.walkable} walkable ways analysed, {r.counts.blocked} excluded as closed. Walking time assumes 4.5 km/h on flat ground.</Text>
        </>)}
      </ScrollView>
    </View>
  );
}
void Alert;
export default themed(AccessScreen);

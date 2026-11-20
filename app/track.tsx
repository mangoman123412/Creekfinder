import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '../src/custom/Icon';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CameraRef } from '@maplibre/maplibre-react-native';
import { Alert } from '../src/lib/alert';
import { CreekMap } from '../src/components/CreekMap';
import { Banner, Button, Text } from '../src/components/ui';
import { TextPrompt } from '../src/components/TextPrompt';
import { discardAdventure, finishAdventure, getActiveAdventureId, getAdventure, getTrackPoints, countAdventures, listAdventures, listPlaces } from '../src/db/local';
import { useDbQuery } from '../src/state/hooks';
import { startTracking, stopTrackingUpdates } from '../src/lib/tracking';
import { ensureForegroundPermission, watchFixes, type Fix } from '../src/lib/location';
import { elevationGain, formatCoords, formatDistance, formatDuration, haversine } from '../src/lib/geo';
import { useApp } from '../src/state/app';
import { FREE_ADVENTURE_LIMIT } from '../src/config';
import { colors, radius, shadow, space, runtime } from '../src/theme';
import { themed } from '../src/custom/themed';
import { useSettings } from '../src/custom/store';
import { TRACK_META, type TrackStatId } from '../src/custom/schema';
import type { TrackPoint } from '../src/types';

interface Ctx { elapsed: number; dist: number; pts: TrackPoint[]; me: Fix | null; imperial: boolean; recording: boolean; hist: { name: string; distance_m: number }[]; visited: string[] }
const speedUnit = (mps: number, imperial: boolean) => (imperial ? `${(mps * 2.23694).toFixed(1)} mph` : `${(mps * 3.6).toFixed(1)} km/h`);

/** Value for each customizable tracking statistic. */
export function statValue(id: TrackStatId, c: Ctx): { value: string; sub?: string; list?: string[] } {
  switch (id) {
    case 'distance': return { value: formatDistance(c.dist, c.imperial) };
    case 'time': return { value: formatDuration(c.elapsed) };
    case 'avgSpeed': return { value: c.recording && c.elapsed > 5 ? speedUnit(c.dist / c.elapsed, c.imperial) : '–' };
    case 'speed': {
      const p = c.pts; if (p.length < 2) return { value: '–' };
      const b = p[p.length - 1]; let a = p[p.length - 2]; for (let i = p.length - 2; i >= 0 && b.ts - p[i].ts < 20000; i--) a = p[i];
      const dt = (b.ts - a.ts) / 1000; return { value: dt > 0 && Date.now() - b.ts < 60000 ? speedUnit(haversine(a, b) / dt, c.imperial) : '0' };
    }
    case 'elevation': { const alt = c.me?.altitude ?? c.pts[c.pts.length - 1]?.alt ?? null; return { value: alt != null ? `${Math.round(c.imperial ? alt * 3.28084 : alt)} ${c.imperial ? 'ft' : 'm'}` : '–' }; }
    case 'gain': { const g = elevationGain(c.pts.map((p) => p.alt)); return { value: `${Math.round(c.imperial ? g * 3.28084 : g)} ${c.imperial ? 'ft' : 'm'}` }; }
    case 'coordinates': return { value: c.me ? formatCoords(c.me.lat, c.me.lng, 5) : '–', sub: c.me?.accuracy != null ? `±${Math.round(c.me.accuracy)} m` : undefined };
    case 'history': return { value: c.hist.length ? `${c.hist.length} recent` : 'No routes yet', list: c.hist.map((h) => `${h.name} · ${formatDistance(h.distance_m, c.imperial)}`) };
    case 'visited': return { value: c.visited.length ? `${c.visited.length} place${c.visited.length > 1 ? 's' : ''}` : 'None yet', list: c.visited };
  }
}

function Track() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { imperial, premium } = useApp();
  const settings = useSettings().tracking;
  const cam = useRef<CameraRef>(null);
  const [me, setMe] = useState<Fix | null>(null);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [bgOk, setBgOk] = useState(true);
  const [naming, setNaming] = useState(false);
  const [quiet, setQuiet] = useState(false);       // temporary distraction-free mode

  const activeId = useDbQuery(getActiveAdventureId, [], null as string | null);
  const adv = useDbQuery(() => (activeId.data ? getAdventure(activeId.data) : Promise.resolve(null)), [activeId.data], null);
  const pts = useDbQuery(() => (activeId.data ? getTrackPoints(activeId.data) : Promise.resolve([])), [activeId.data], []);
  const advs = useDbQuery(listAdventures, [], []);
  const places = useDbQuery(() => listPlaces(), [], []);
  const recording = !!activeId.data && !!adv.data;
  const layout = quiet ? 'minimal' : settings.layout;

  useEffect(() => {
    if (!recording || !settings.keepAwake) return;
    activateKeepAwakeAsync('tracking').catch(() => {});
    return () => { deactivateKeepAwake('tracking').catch(() => {}); };
  }, [recording, settings.keepAwake]);
  useEffect(() => { let off: (() => void) | undefined; void ensureForegroundPermission().then(async (ok) => { if (ok) off = await watchFixes(setMe, 3); }); return () => off?.(); }, []);
  useEffect(() => { if (me && !recording) cam.current?.flyTo({ center: [me.lng, me.lat], zoom: 15, duration: 600 }); }, [!!me]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { if (recording && me && layout !== 'minimal') cam.current?.easeTo({ center: [me.lng, me.lat], zoom: 16.5, duration: 800 }); }, [me?.ts, recording, layout]); // eslint-disable-line react-hooks/exhaustive-deps

  const elapsed = adv.data ? Math.max(0, Math.round((now - new Date(adv.data.started_at).getTime()) / 1000)) : 0;
  const start = pts.data[0];
  const track = useMemo(() => pts.data.map((p) => ({ lat: p.lat, lng: p.lng })), [pts.data]);
  const visited = useMemo(() => places.data.filter((pl) => pts.data.some((p, i) => i % 2 === 0 && haversine(p, pl) < 60)).map((pl) => pl.name), [places.data, pts.data.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const ctx: Ctx = { elapsed, dist: adv.data?.distance_m ?? 0, pts: pts.data, me, imperial, recording, hist: advs.data.filter((a) => a.status === 'finished').slice(0, 3), visited };
  const stats = settings.stats.filter((s) => s.visible).map((s) => s.id);

  const begin = async () => {
    if (!premium && (await countAdventures()) >= FREE_ADVENTURE_LIMIT) { router.push({ pathname: '/premium', params: { reason: 'history' } }); return; }
    setBusy(true);
    try { const r = await startTracking(); setBgOk(r.background); } catch (e: any) { Alert.alert('Cannot start', e.message); } finally { setBusy(false); }
  };
  const stop = async (name: string) => {
    setNaming(false); setBusy(true);
    const id = activeId.data!; await stopTrackingUpdates();
    if (pts.data.length < 2) { await discardAdventure(id); Alert.alert('Not enough movement', 'No trail was saved because you barely moved.'); }
    else { await finishAdventure(id, { name }); router.replace({ pathname: '/adventure/[id]', params: { id } }); return; }
    setBusy(false);
  };

  const Controls = (
    <View style={{ gap: 8 }}>
      {recording ? (<>
        {!bgOk && <Banner tone="warn" icon="phone-portrait">Recording only while this screen/app stays open. Allow "Always" location to record with the screen off.</Banner>}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button small variant="secondary" icon="home" title="Back to start" style={{ flex: 1 }} onPress={() => start && router.push({ pathname: '/navigate', params: { adventure: activeId.data! } })} />
          <Button small variant="secondary" icon="location" title="Mark a creek" style={{ flex: 1 }} onPress={() => router.push('/save')} />
        </View>
        <Button variant="danger" icon="stop-circle" title="Stop & save" onPress={() => setNaming(true)} loading={busy} />
      </>) : (<>
        <Button icon="play-circle" title="Start tracking" onPress={begin} loading={busy} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button small variant="secondary" icon="time" title="History" style={{ flex: 1 }} onPress={() => router.push('/adventures')} />
          <Button small variant="secondary" icon="options" title="Customize" style={{ flex: 1 }} onPress={() => router.push('/settings/tracking')} />
        </View>
        <Text style={{ color: colors.muted, fontSize: 12.5, textAlign: 'center' }}>Records your GPS trail even without cell service. Location is only recorded while tracking is on.</Text>
      </>)}
    </View>
  );
  const MapView = <CreekMap styleKey="standard" cameraRef={cam} track={track} showUser attributionBottom={layout === 'mapfocus' ? 250 : 8} pins={start ? [{ id: 'start', lat: start.lat, lng: start.lng, name: 'Start', group: 'target' }] : []} guide={recording && me && start && pts.data.length > 1 ? [{ lat: me.lat, lng: me.lng }, start] : undefined} />;
  const quietBtn = (
    <Pressable onPress={() => setQuiet((q) => !q)} accessibilityLabel={quiet ? 'Show full tracker' : 'Distraction-free mode'} style={{ position: 'absolute', right: 14, top: insets.top + 8, width: 42, height: 42, borderRadius: 21, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', ...shadow.soft }}>
      <Ionicons name={quiet ? 'contract' : 'eye-off'} size={20} color={colors.ink} />
    </Pressable>);

  // ---------------------------------------------------------------- distraction-free
  if (layout === 'minimal') {
    const [a, b] = [stats[0] ?? 'time', stats[1] ?? 'distance'];
    return (
      <View style={{ flex: 1, backgroundColor: '#000', paddingTop: insets.top + 56, paddingHorizontal: 24, paddingBottom: insets.bottom + 20, justifyContent: 'space-between' }}>
        {quietBtn}
        <View>
          {[a, b].map((id) => (<View key={id} style={{ marginBottom: 28 }}><Text style={{ color: '#9AA', fontSize: 14, fontWeight: '700', letterSpacing: 1 }}>{TRACK_META[id].title.toUpperCase()}</Text><Text style={{ color: '#fff', fontSize: 72 * Math.min(1, 1 / runtime.textScale + 0.2), fontWeight: '800', fontVariant: ['tabular-nums'] }}>{statValue(id, ctx).value}</Text></View>))}
        </View>
        <View style={{ gap: 10 }}>
          {recording ? <Button variant="danger" icon="stop-circle" title="Stop & save" onPress={() => setNaming(true)} loading={busy} /> : <Button icon="play-circle" title="Start tracking" onPress={begin} loading={busy} />}
        </View>
        <TextPrompt visible={naming} title="Name this adventure" initial={adv.data?.name} confirmLabel="Save adventure" onCancel={() => setNaming(false)} onSubmit={stop} />
      </View>
    );
  }

  const Tile = ({ id }: { id: TrackStatId }) => {
    const v = statValue(id, ctx); const wide = !!v.list;
    return (
      <View style={[{ width: wide ? '100%' : '48%', flexGrow: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: 14 }, shadow.soft]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Ionicons name={TRACK_META[id].icon as any} size={14} color={colors.primary} /><Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: '700', letterSpacing: 0.6 }}>{TRACK_META[id].title.toUpperCase()}</Text></View>
        <Text style={{ fontSize: id === 'coordinates' ? 17 : 28, fontWeight: '800', marginTop: 4, fontVariant: ['tabular-nums'] }} numberOfLines={1}>{v.value}</Text>
        {v.sub ? <Text style={{ color: colors.muted, fontSize: 12 }}>{v.sub}</Text> : null}
        {v.list ? v.list.slice(0, 4).map((l, i) => <Text key={i} style={{ color: colors.muted, fontSize: 13, marginTop: 2 }} numberOfLines={1}>• {l}</Text>) : null}
      </View>
    );
  };

  // ---------------------------------------------------------------- dashboard
  if (layout === 'dashboard') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: insets.top + 56, paddingBottom: insets.bottom + 20, gap: 12 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>{stats.map((id) => <Tile key={id} id={id} />)}</View>
          <View style={{ height: 210, borderRadius: radius.lg, overflow: 'hidden' }}>{MapView}</View>
          {Controls}
        </ScrollView>
        {quietBtn}
        <TextPrompt visible={naming} title="Name this adventure" initial={adv.data?.name} confirmLabel="Save adventure" onCancel={() => setNaming(false)} onSubmit={stop} />
      </View>
    );
  }

  // ---------------------------------------------------------------- map focus + classic
  return (
    <View style={{ flex: 1 }}>
      {MapView}
      {layout === 'mapfocus' ? (
        <View style={{ position: 'absolute', top: insets.top + 54, left: 12, right: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }} pointerEvents="none">
          {stats.slice(0, 4).map((id) => (<View key={id} style={[{ backgroundColor: colors.overlay, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 }, shadow.soft]}><Text style={{ fontSize: 10.5, color: colors.muted, fontWeight: '700' }}>{TRACK_META[id].title.toUpperCase()}</Text><Text style={{ fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{statValue(id, ctx).value}</Text></View>))}
        </View>
      ) : null}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, padding: space.lg, paddingBottom: insets.bottom + space.md, borderTopLeftRadius: 24, borderTopRightRadius: 24, ...shadow.float, maxHeight: '62%' }}>
        {layout === 'classic' && (
          <ScrollView style={{ maxHeight: 190 }} contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
            {stats.length === 0 ? <Text style={{ color: colors.muted }}>No statistics selected — choose some in Customize.</Text> : stats.map((id) => <Tile key={id} id={id} />)}
          </ScrollView>)}
        {Controls}
      </View>
      {quietBtn}
      <TextPrompt visible={naming} title="Name this adventure" initial={adv.data?.name} confirmLabel="Save adventure" onCancel={() => setNaming(false)} onSubmit={stop} />
    </View>
  );
}
void StyleSheet;
export default themed(Track);

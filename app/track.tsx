import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Alert } from '../src/lib/alert';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CameraRef } from '@maplibre/maplibre-react-native';
import { CreekMap } from '../src/components/CreekMap';
import { Button, Banner } from '../src/components/ui';
import { TextPrompt } from '../src/components/TextPrompt';
import { discardAdventure, finishAdventure, getActiveAdventureId, getAdventure, getTrackPoints, countAdventures } from '../src/db/local';
import { useDbQuery } from '../src/state/hooks';
import { startTracking, stopTrackingUpdates } from '../src/lib/tracking';
import { ensureForegroundPermission, watchFixes, type Fix } from '../src/lib/location';
import { formatDistance, formatDuration, haversine } from '../src/lib/geo';
import { useApp } from '../src/state/app';
import { FREE_ADVENTURE_LIMIT } from '../src/config';
import { colors, radius, shadow, space } from '../src/theme';

export default function Track() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { imperial, premium } = useApp();
  const cam = useRef<CameraRef>(null);
  const [me, setMe] = useState<Fix | null>(null);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [bgOk, setBgOk] = useState(true);
  const [naming, setNaming] = useState(false);

  const activeId = useDbQuery(getActiveAdventureId, [], null as string | null);
  const adv = useDbQuery(() => (activeId.data ? getAdventure(activeId.data) : Promise.resolve(null)), [activeId.data], null);
  const pts = useDbQuery(() => (activeId.data ? getTrackPoints(activeId.data) : Promise.resolve([])), [activeId.data], []);
  const recording = !!activeId.data && !!adv.data;
  useEffect(() => {
    if (!recording) return;
    activateKeepAwakeAsync('tracking').catch(() => {});
    return () => { deactivateKeepAwake('tracking').catch(() => {}); };
  }, [recording]);

  useEffect(() => {
    let off: (() => void) | undefined;
    void ensureForegroundPermission().then(async (ok) => { if (ok) off = await watchFixes((f) => { setMe(f); }, 3); });
    return () => off?.();
  }, []);
  useEffect(() => { if (me && !recording) cam.current?.flyTo({ center: [me.lng, me.lat], zoom: 15, duration: 600 }); }, [!!me]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { if (recording && me) cam.current?.easeTo({ center: [me.lng, me.lat], zoom: 16.5, duration: 800 }); }, [me?.ts, recording]); // eslint-disable-line react-hooks/exhaustive-deps

  const elapsed = adv.data ? Math.max(0, Math.round((now - new Date(adv.data.started_at).getTime()) / 1000)) : 0;
  const start = pts.data[0];
  const toStart = me && start ? haversine(me, start) : null;
  const track = useMemo(() => pts.data.map((p) => ({ lat: p.lat, lng: p.lng })), [pts.data]);

  const begin = async () => {
    if (!premium && (await countAdventures()) >= FREE_ADVENTURE_LIMIT) { router.push({ pathname: '/premium', params: { reason: 'history' } }); return; }
    setBusy(true);
    try { const r = await startTracking(); setBgOk(r.background); }
    catch (e: any) { Alert.alert('Cannot start', e.message); }
    finally { setBusy(false); }
  };
  const stop = async (name: string) => {
    setNaming(false); setBusy(true);
    const id = activeId.data!;
    await stopTrackingUpdates();
    if (pts.data.length < 2) { await discardAdventure(id); Alert.alert('Not enough movement', 'No trail was saved because you barely moved.'); }
    else { await finishAdventure(id, { name }); router.replace({ pathname: '/adventure/[id]', params: { id } }); return; }
    setBusy(false);
  };

  return (
    <View style={{ flex: 1 }}>
      <CreekMap styleKey="standard" cameraRef={cam} track={track} showUser attributionBottom={250}
        pins={start ? [{ id: 'start', lat: start.lat, lng: start.lng, name: 'Start', group: 'target' }] : []}
        guide={recording && me && start && pts.data.length > 1 ? [{ lat: me.lat, lng: me.lng }, start] : undefined} />
      <View style={[s.panel, { paddingBottom: insets.bottom + space.md }]}>
        {recording && !bgOk && <Banner tone="warn" icon="phone-portrait">Recording only while this screen/app stays open. Allow "Always" location in Settings to record with the screen off.</Banner>}
        <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginVertical: 8 }}>
          <Stat label="Time" value={formatDuration(elapsed)} />
          <Stat label="Distance" value={formatDistance(adv.data?.distance_m ?? 0, imperial)} />
          <Stat label="From start" value={toStart != null && recording ? formatDistance(toStart, imperial) : '–'} />
        </View>
        {recording ? (
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button small variant="secondary" icon="home" title="Back to start" style={{ flex: 1 }} onPress={() => start && router.push({ pathname: '/navigate', params: { adventure: activeId.data! } })} />
              <Button small variant="secondary" icon="location" title="Mark a creek" style={{ flex: 1 }} onPress={() => router.push('/save')} />
            </View>
            <Button variant="danger" icon="stop-circle" title="Stop & save" onPress={() => setNaming(true)} loading={busy} />
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            <Button icon="play-circle" title="Start tracking" onPress={begin} loading={busy} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button small variant="secondary" icon="time" title="History" style={{ flex: 1 }} onPress={() => router.push('/adventures')} />
              <Button small variant="ghost" title="Close" onPress={() => router.back()} style={{ flex: 1 }} />
            </View>
            <Text style={s.note}>Records your GPS trail even without cell service. Location is only recorded while tracking is on.</Text>
          </View>
        )}
        {me?.accuracy != null && <Text style={s.note}>GPS accuracy ±{Math.round(me.accuracy)} m</Text>}
      </View>
      <TextPrompt visible={naming} title="Name this adventure" initial={adv.data?.name} confirmLabel="Save adventure" onCancel={() => setNaming(false)} onSubmit={stop} />
      {recording && <Pressable style={[s.back, { top: insets.top + 8 }]} onPress={() => router.back()}><Ionicons name="chevron-down" size={22} color={colors.forest} /></Pressable>}
    </View>
  );
}

const Stat = ({ label, value }: { label: string; value: string }) => (
  <View style={{ alignItems: 'center' }}><Text style={{ fontSize: 26, fontWeight: '900', color: colors.ink, fontVariant: ['tabular-nums'] }}>{value}</Text><Text style={{ fontSize: 12, color: colors.muted, fontWeight: '700' }}>{label.toUpperCase()}</Text></View>
);
const s = StyleSheet.create({
  panel: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#fff', padding: space.lg, borderTopLeftRadius: 24, borderTopRightRadius: 24, ...shadow },
  note: { color: colors.muted, fontSize: 12.5, textAlign: 'center', marginTop: 4 },
  back: { position: 'absolute', right: 14, width: 42, height: 42, borderRadius: radius.pill, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', ...shadow },
});

import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { Alert } from '../src/lib/alert';
import { useRouter } from 'expo-router';
import { OfflineManager, type OfflinePack, type OfflinePackStatus } from '@maplibre/maplibre-react-native';
import { Banner, Button, Card, Chip, SectionTitle } from '../src/components/ui';
import { useApp } from '../src/state/app';
import { useDbQuery } from '../src/state/hooks';
import { listPlaces } from '../src/db/local';
import { ensureForegroundPermission, lastKnown } from '../src/lib/location';
import { geocode } from '../src/lib/explore';
import { boundsAround, estimateTileCount } from '../src/lib/geo';
import { STYLE_OPTIONS, styleAvailable, styleUrl } from '../src/lib/mapStyles';
import { type MapStyleKey } from '../src/types';
import { Field } from '../src/components/ui';
import { colors, font, space } from '../src/theme';

type Center = { name: string; lat: number; lng: number };
const RADII = [3, 8, 15, 30];
const DETAIL = [{ label: 'Overview (to z12)', max: 12 }, { label: 'Standard (to z14)', max: 14 }, { label: 'Detailed (to z16)', max: 16 }];

interface PackRow { id: string; name: string; styleKey: MapStyleKey; pct: number; state: string; size: number }

export default function OfflineScreen() {
  const router = useRouter();
  const { premium, online } = useApp();
  const places = useDbQuery(() => listPlaces(), [], []);
  const [center, setCenter] = useState<Center | null>(null);
  const [radius, setRadius] = useState(8);
  const [detail, setDetail] = useState(1);
  const [styleKey, setStyleKey] = useState<MapStyleKey>('standard');
  const [query, setQuery] = useState('');
  const [packs, setPacks] = useState<PackRow[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const list = await OfflineManager.getPacks();
      const rows: PackRow[] = [];
      for (const p of list) {
        const st = await p.status().catch(() => null);
        rows.push({ id: p.id, name: String(p.metadata?.name ?? 'Offline area'), styleKey: (p.metadata?.styleKey as MapStyleKey) ?? 'standard', pct: st?.percentage ?? 0, state: st?.state ?? 'inactive', size: st?.completedResourceSize ?? 0 });
      }
      setPacks(rows);
    } catch {}
  }, []);
  useEffect(() => { OfflineManager.setTileCountLimit(80000); void refresh(); }, [refresh]);

  const useMyLocation = async () => {
    if (!(await ensureForegroundPermission())) { Alert.alert('Location off', 'Allow location access, or search for a place instead.'); return; }
    const l = await lastKnown();
    if (!l) { Alert.alert('No GPS fix yet', 'Try again in a moment, or search for a place.'); return; }
    setCenter({ name: 'My location', lat: l.lat, lng: l.lng });
  };
  const doSearch = async () => {
    try { const r = await geocode(query); if (!r[0]) { Alert.alert('Not found'); return; } setCenter({ name: r[0].name.split(',').slice(0, 2).join(','), lat: r[0].lat, lng: r[0].lng }); } catch { Alert.alert('Search failed', 'Searching needs internet.'); }
  };

  const bounds = center ? boundsAround(center, radius * 1000) : null;
  const maxZ = DETAIL[detail].max;
  const tiles = bounds ? estimateTileCount(bounds, 5, maxZ) : 0;
  const perTile = styleKey === 'satellite' ? 28 : 12;  // rough KB per tile
  const mb = Math.round((tiles * perTile) / 1024);

  const download = async () => {
    if (!premium) { router.push({ pathname: '/premium', params: { reason: 'offline' } }); return; }
    if (!bounds || !center) return;
    if (!online) { Alert.alert('You are offline', 'Download maps while you have a connection.'); return; }
    if (!styleAvailable(styleKey)) { Alert.alert('Map key needed', 'Satellite/terrain downloads need a MapTiler key (docs/SETUP.md).'); return; }
    if (tiles > 80000) { Alert.alert('Area too large', 'Pick a smaller radius or less detail.'); return; }
    setBusy(true);
    try {
      await OfflineManager.createPack(
        { mapStyle: styleUrl(styleKey), bounds, minZoom: 5, maxZoom: maxZ, metadata: { name: `${center.name} · ${radius} km`, styleKey } },
        (_p: OfflinePack, _s: OfflinePackStatus) => { void refresh(); },
        (_p, e) => { Alert.alert('Download problem', e.message); },
      );
      await refresh();
    } catch (e: any) { Alert.alert('Could not start download', e.message ?? ''); }
    setBusy(false);
  };
  const remove = (id: string, name: string) => Alert.alert('Delete offline area?', name, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { await OfflineManager.deletePack(id); await refresh(); } }]);

  return (
    <ScrollView style={{ backgroundColor: colors.sand }} contentContainerStyle={{ padding: space.lg, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
      <Text style={font.body}>Download map areas before you head out. Downloaded maps, your saved places, GPS tracking, photos and notes all work with no signal, and sync when you're back online.</Text>
      {!premium && <Banner tone="info" icon="star">Offline map downloads are a Premium feature. Your saved coordinates, GPS tracking, photos and notes work offline on the free plan.</Banner>}

      <SectionTitle>1. Choose the area</SectionTitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 8 }}>
        <Chip label="My location" icon="locate" active={center?.name === 'My location'} onPress={useMyLocation} />
        {places.data.slice(0, 6).map((p) => <Chip key={p.id} label={p.name} icon="location" active={center?.name === p.name && center.lat === p.lat} onPress={() => setCenter({ name: p.name, lat: p.lat, lng: p.lng })} />)}
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
        <View style={{ flex: 1 }}><Field label="Or search a place" value={query} onChangeText={setQuery} onSubmitEditing={doSearch} placeholder="City, park or ZIP" returnKeyType="search" /></View>
      </View>
      {center && <Text style={[font.body, { fontWeight: '700' }]}>Selected: {center.name}</Text>}

      <SectionTitle>2. Size & detail</SectionTitle>
      <Text style={font.small}>Radius around the point</Text>
      <View style={{ flexDirection: 'row', marginVertical: 8 }}>{RADII.map((r) => <Chip key={r} label={`${r} km`} active={radius === r} onPress={() => setRadius(r)} />)}</View>
      <Text style={font.small}>Zoom detail (more detail = bigger download)</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 8, marginVertical: 8 }}>{DETAIL.map((d, i) => <Chip key={d.label} label={d.label} active={detail === i} onPress={() => setDetail(i)} />)}</View>
      <Text style={font.small}>Map type</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 8, marginVertical: 8 }}>{STYLE_OPTIONS.map((o) => <Chip key={o.key} label={o.label} icon={o.icon as any} active={styleKey === o.key} onPress={() => setStyleKey(o.key)} />)}</View>

      {center && <Card style={{ marginTop: 8 }}><Text style={font.h3}>About {tiles.toLocaleString()} map tiles ≈ {mb < 1 ? '<1' : mb} MB</Text><Text style={font.small}>Estimate only. Large downloads should be done on Wi-Fi.</Text></Card>}
      <View style={{ marginTop: space.lg }}><Button icon="cloud-download" title={premium ? 'Download this area' : 'Unlock offline maps'} onPress={download} loading={busy} disabled={premium && !center} /></View>

      <SectionTitle>Downloaded areas</SectionTitle>
      {packs.length === 0 && <Text style={font.small}>Nothing downloaded yet.</Text>}
      {packs.map((p) => (
        <Card key={p.id} style={{ marginBottom: 10 }}>
          <Text style={font.h3}>{p.name}</Text>
          <Text style={font.small}>{p.styleKey} · {p.state === 'complete' ? 'Ready offline' : `Downloading ${Math.round(p.pct)}%`} · {(p.size / 1048576).toFixed(1)} MB</Text>
          {p.state !== 'complete' && <ActivityIndicator style={{ alignSelf: 'flex-start', marginTop: 6 }} color={colors.water} />}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}><Button small variant="secondary" icon="trash" title="Delete" onPress={() => remove(p.id, p.name)} /></View>
        </Card>
      ))}
      <Banner tone="info" icon="information-circle">Maps you browse are also cached automatically for a while. For guaranteed offline use, download the area first and test with Airplane Mode.</Banner>
    </ScrollView>
  );
}

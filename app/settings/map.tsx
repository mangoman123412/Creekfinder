import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '../../src/custom/Icon';
import { Alert } from '../../src/lib/alert';
import { Banner, Button, Chip, Pressy, Text } from '../../src/components/ui';
import { TextPrompt } from '../../src/components/TextPrompt';
import { ColorRow, Group2, SegmentRow, SettingsPage, SliderRow, SwitchRow } from '../../src/custom/controls';
import { CodeBox } from '../../src/custom/pages';
import { CreekMap, type MapPin } from '../../src/components/CreekMap';
import { allMapPresets, createMapPreset, deleteMapPreset, saveMapPreset, switchMapPreset, updateActiveMapPreset, useLibrary, getMapPreset } from '../../src/custom/store';
import { useActiveMapPreset } from '../../src/custom/useMapPrefs';
import { MAP_STYLE_OPTIONS, MARKER_SHAPES, type MapStyleId } from '../../src/custom/schema';
import { encodeShare } from '../../src/custom/share';
import { styleAvailable } from '../../src/lib/mapStyles';
import { lastKnown } from '../../src/lib/location';
import { useApp } from '../../src/state/app';
import { colors, font, radius, shadow } from '../../src/theme';
import { themed } from '../../src/custom/themed';

const SHAPE_ICON: Record<string, string> = { circle: 'ellipse', square: 'square', diamond: 'diamond', triangle: 'triangle', star: 'star', ring: 'radio-button-off' };

function MapSettings() {
  const router = useRouter();
  const { premium } = useApp();
  const lib = useLibrary(); const p = useActiveMapPreset();
  const [naming, setNaming] = useState<null | 'new' | 'rename'>(null);
  const [code, setCode] = useState('');
  const [c, setC] = useState<[number, number]>([-81.6746, 36.2168]);
  useEffect(() => { void lastKnown().then((l) => l && setC([l.lng, l.lat])); }, []);
  const sample: MapPin[] = useMemo(() => [
    { id: 'a', lat: c[1] + 0.004, lng: c[0] - 0.006, name: 'Sample saved', group: 'saved' }, { id: 'b', lat: c[1] - 0.003, lng: c[0] + 0.005, name: 'Sample community', group: 'community' },
    { id: 'c', lat: c[1] + 0.006, lng: c[0] + 0.004, name: 'Sample nearby', group: 'osm' }, { id: 'd', lat: c[1] - 0.006, lng: c[0] - 0.003, name: 'Sample visited', group: 'visited' }, { id: 'e', lat: c[1] + 0.001, lng: c[0] + 0.001, name: 'Sample parking', group: 'parking' },
  ], [c]);
  const all = allMapPresets(lib);
  const edit = (fn: (x: typeof p) => void) => updateActiveMapPreset(fn);
  const pickStyle = (id: MapStyleId) => {
    const o = MAP_STYLE_OPTIONS.find((x) => x.id === id)!;
    if (!styleAvailable(id)) { Alert.alert('Map key needed', `${o.label} needs a MapTiler key (docs/SETUP.md). Standard, Dark and Light work without one.`); return; }
    if (o.premium && !premium) { router.push({ pathname: '/premium', params: { reason: 'maps' } }); return; }
    edit((x) => { x.style = id; });
  };
  const colorOf = (k: 'markerSaved' | 'markerCommunity' | 'markerOsm' | 'markerVisited' | 'markerParking') => p.markers.colors[k] ?? colors[k];
  return (
    <SettingsPage>
      <View style={{ height: 230, borderRadius: radius.lg, overflow: 'hidden', ...shadow.card }}>
        <CreekMap preset={p} pins={sample} showUser={false} initial={{ center: c, zoom: p.defaultZoom }} attributionBottom={4} />
      </View>
      <Text style={[font.small, { marginTop: 6 }]}>Live preview. The five markers are samples of each marker type — not real places. Changing a built-in preset makes your own copy.</Text>

      <Text style={[font.label, { marginTop: 18, marginBottom: 8, marginLeft: 4 }]}>Map presets</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {all.map((x) => (
          <Pressy key={x.id} onPress={() => switchMapPreset(x.id)} accessibilityLabel={`Use ${x.name} preset`} scale={0.95} style={{ marginRight: 10 }}>
            <View style={[{ alignItems: 'center', gap: 5, paddingVertical: 12, width: 100, borderRadius: radius.md, backgroundColor: p.id === x.id ? colors.primary : colors.surface }, shadow.soft]}>
              <Ionicons name={x.icon as any} size={22} color={p.id === x.id ? colors.onPrimary : colors.primary} /><Text numberOfLines={2} style={{ fontSize: 11.5, fontWeight: '700', textAlign: 'center', color: p.id === x.id ? colors.onPrimary : colors.ink }}>{x.name}</Text>
            </View>
          </Pressy>))}
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <Button small icon="add" title="New preset from this" onPress={() => setNaming('new')} />
        {!p.official && <Button small variant="secondary" icon="create" title="Rename" onPress={() => setNaming('rename')} />}
        <Button small variant="secondary" icon="share" title="Share" onPress={() => setCode(encodeShare('mappreset', p.name, { preset: p }))} />
        {!p.official && <Button small variant="danger" icon="trash" title="Delete" onPress={() => Alert.alert(`Delete “${p.name}”?`, undefined, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => deleteMapPreset(p.id) }])} />}
      </View>
      {code ? <CodeBox title={`Map preset: ${p.name}`} code={code} filename={`${p.name}.creekfinder.txt`} /> : null}

      <Text style={[font.label, { marginTop: 22, marginBottom: 8, marginLeft: 4 }]}>Map style</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {MAP_STYLE_OPTIONS.map((o) => { const on = p.style === o.id; const locked = !styleAvailable(o.id); return (
          <Pressy key={o.id} onPress={() => pickStyle(o.id)} accessibilityLabel={`${o.label} map style`} scale={0.96} style={{ width: '31%', flexGrow: 1 }}>
            <View style={[{ alignItems: 'center', gap: 5, paddingVertical: 12, borderRadius: radius.md, backgroundColor: on ? colors.primary : colors.surface, opacity: locked ? 0.55 : 1 }, shadow.soft]}>
              <Ionicons name={o.icon as any} size={22} color={on ? colors.onPrimary : colors.primary} /><Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '700', color: on ? colors.onPrimary : colors.ink }}>{o.label}</Text>
              {locked ? <Text style={{ fontSize: 10, color: on ? colors.onPrimary : colors.muted }}>needs map key</Text> : o.premium && !premium ? <Ionicons name="lock-closed" size={11} color={colors.amber} /> : null}
            </View>
          </Pressy>); })}
      </View>

      <Group2 title="Markers">
        <SliderRow title="Marker size" value={p.markers.size} min={0.6} max={1.8} step={0.05} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => edit((x) => { x.markers.size = v; })} />
        <View style={{ padding: 16 }}>
          <Text style={[font.body, { fontWeight: '600' }]}>Shape</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            {MARKER_SHAPES.map((sh) => <Pressy key={sh} onPress={() => edit((x) => { x.markers.shape = sh; })} accessibilityLabel={`${sh} markers`} scale={0.92} style={{ width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: p.markers.shape === sh ? colors.primary : colors.surface2 }}><Ionicons name={SHAPE_ICON[sh] as any} size={22} color={p.markers.shape === sh ? colors.onPrimary : colors.ink} /></Pressy>)}
          </View>
        </View>
        {([['markerSaved', 'Saved places'], ['markerCommunity', 'Community creeks'], ['markerOsm', 'Nearby water'], ['markerVisited', 'Visited places'], ['markerParking', 'Parking']] as const).map(([k, label]) => (
          <ColorRow key={k} label={label} value={colorOf(k)} overridden={!!p.markers.colors[k]} onChange={(hex) => edit((x) => { x.markers.colors[k] = hex; })} onClear={() => edit((x) => { delete x.markers.colors[k]; })} />))}
      </Group2>

      <Group2 title="Map appearance" footer="These change the map style itself. Layers a style doesn't have (for example contours on Standard) simply have nothing to show.">
        <SwitchRow icon="text" title="Labels" value={p.layers.labels} onChange={(v) => edit((x) => { x.layers.labels = v; })} />
        <SwitchRow icon="car" title="Roads" value={p.layers.roads} onChange={(v) => edit((x) => { x.layers.roads = v; })} />
        <SwitchRow icon="walk" title="Trails & paths" value={p.layers.trails} onChange={(v) => edit((x) => { x.layers.trails = v; })} />
        <SwitchRow icon="water" title="Waterways" value={p.layers.waterways} onChange={(v) => edit((x) => { x.layers.waterways = v; })} />
        <SwitchRow icon="analytics" title="Contour lines" subtitle="Terrain & Topographic styles" value={p.layers.contours} onChange={(v) => edit((x) => { x.layers.contours = v; })} />
        <SwitchRow icon="triangle" title="Terrain shading" subtitle="Hillshade relief" value={p.layers.hillshade} onChange={(v) => edit((x) => { x.layers.hillshade = v; })} />
        <SliderRow title="Brightness" value={p.brightness} min={-0.6} max={0.6} step={0.05} format={(v) => (v === 0 ? 'Normal' : `${v > 0 ? '+' : ''}${Math.round(v * 100)}%`)} onChange={(v) => edit((x) => { x.brightness = v; })} />
      </Group2>

      <Group2 title="Map preferences">
        <SliderRow title="Default zoom" subtitle="When the map opens or centers on you" value={p.defaultZoom} min={4} max={17} step={1} format={(v) => `${v}`} onChange={(v) => edit((x) => { x.defaultZoom = v; })} />
        <SwitchRow icon="locate" title="Center on my location automatically" value={p.autoCenter} onChange={(v) => edit((x) => { x.autoCenter = v; })} />
        <SwitchRow icon="bookmark" title="Show my saved creeks" value={p.show.saved} onChange={(v) => edit((x) => { x.show.saved = v; })} />
        <SwitchRow icon="people" title="Show public discoveries" subtitle="Community creeks (needs account)" value={p.show.community} onChange={(v) => edit((x) => { x.show.community = v; })} />
        <SwitchRow icon="walk" title="Show visited places" value={p.show.visited} onChange={(v) => edit((x) => { x.show.visited = v; })} />
        <SwitchRow icon="car" title="Show nearby parking" value={p.show.parking} onChange={(v) => edit((x) => { x.show.parking = v; })} />
        <SwitchRow icon="trail-sign" title="Show hiking trail routes" subtitle="Waymarked Trails overlay (OpenStreetMap)" value={p.show.hikingTrails} onChange={(v) => edit((x) => { x.show.hikingTrails = v; })} />
        <SwitchRow icon="water" title="Show nearby water (OpenStreetMap)" value={p.show.nearbyWater} onChange={(v) => edit((x) => { x.show.nearbyWater = v; })} />
      </Group2>
      <View style={{ marginTop: 14 }}><Button variant="secondary" icon="map" title="Open the map" onPress={() => router.push('/(tabs)/map')} /></View>
      <TextPrompt visible={!!naming} title={naming === 'new' ? 'Name the new preset' : 'Rename preset'} initial={naming === 'rename' ? p.name : ''} placeholder="e.g. Swimming holes" onCancel={() => setNaming(null)}
        onSubmit={(n) => { if (naming === 'new') createMapPreset(n, p); else saveMapPreset({ ...p, name: n }, true); setNaming(null); }} />
    </SettingsPage>
  );
}
void SegmentRow; void Banner; void Chip; void getMapPreset;
export default themed(MapSettings);

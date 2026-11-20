import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Ionicons } from '../../src/custom/Icon';
import { Alert } from '../../src/lib/alert';
import { Banner, Button, Chip, Pressy, Text } from '../../src/components/ui';
import { TextPrompt } from '../../src/components/TextPrompt';
import { ColorPicker, Group2, SegmentRow, SettingsPage, SliderRow, SwitchRow } from '../../src/custom/controls';
import { CodeBox } from '../../src/custom/pages';
import { CreekMap, type MapPin } from '../../src/components/CreekMap';
import { allSchemes, applyScheme, deleteScheme, saveScheme, setFeatureStyle, updateActiveMapPreset, useLibrary } from '../../src/custom/store';
import { useActiveMapPreset } from '../../src/custom/useMapPrefs';
import { FEATURES, FEATURE_GROUPS, resolveFeature, type FeatureDef } from '../../src/custom/mapFeatures';
import { encodeShare } from '../../src/custom/share';
import { lastKnown } from '../../src/lib/location';
import { colors, font, radius, shadow } from '../../src/theme';
import { themed } from '../../src/custom/themed';

const BACKDROPS = { standard: { label: 'Standard', bg: '#EAE6DA' }, satellite: { label: 'Satellite', bg: '#2F4A2C' }, terrain: { label: 'Terrain', bg: '#C8B692' } } as const;

/** Instant sample of one feature as it will look on the map (no network needed). */
export function FeatureSample({ def, r, bg, w = 74, h = 30 }: { def: FeatureDef; r: ReturnType<typeof resolveFeature>; bg: string; w?: number; h?: number }) {
  const common = { width: w, height: h, backgroundColor: bg, borderRadius: 8, overflow: 'hidden' as const, alignItems: 'center' as const, justifyContent: 'center' as const };
  if (!r.visible) return <View style={common}><Ionicons name="eye-off" size={16} color="#888" /></View>;
  if (def.kind === 'fill') return <View style={common}><View style={{ width: w - 14, height: h - 12, borderRadius: 6, backgroundColor: r.color, opacity: r.opacity, borderWidth: 1, borderColor: 'rgba(0,0,0,0.15)' }} /></View>;
  if (def.kind === 'point') return <View style={common}><View style={{ width: 12 * r.size + 4, height: 12 * r.size + 4, borderRadius: 99, backgroundColor: r.color, borderWidth: 2, borderColor: '#fff' }} /></View>;
  if (def.kind === 'shade') return <View style={common}><View style={{ width: w, height: h, backgroundColor: r.color, opacity: r.opacity }} /></View>;
  const t = Math.max(1.5, r.width * 1.1); const n = r.dash ? 6 : 1;
  return (
    <View style={common}>
      <View style={{ width: w - 12, height: t + 3, justifyContent: 'center', flexDirection: 'row', gap: r.dash ? 4 : 0 }}>
        {Array.from({ length: n }).map((_, i) => <View key={i} style={{ flex: 1, height: t, borderRadius: 2, backgroundColor: r.color, opacity: r.opacity }} />)}
      </View>
    </View>
  );
}

function MapColors() {
  const lib = useLibrary(); const p = useActiveMapPreset();
  const [open, setOpen] = useState<string | null>(null);
  const [bd, setBd] = useState<keyof typeof BACKDROPS>('satellite');
  const [naming, setNaming] = useState(false); const [code, setCode] = useState('');
  const [c, setC] = useState<[number, number]>([-81.6746, 36.2168]);
  useEffect(() => { void lastKnown().then((l) => l && setC([l.lng, l.lat])); }, []);
  const sample: MapPin[] = useMemo(() => [{ id: 'a', lat: c[1] + 0.0008, lng: c[0] - 0.0012, name: 'Sample saved', group: 'saved' }, { id: 'b', lat: c[1] - 0.0006, lng: c[0] + 0.001, name: 'Sample pin', group: 'customPin' }, { id: 'c', lat: c[1] + 0.001, lng: c[0] + 0.0013, name: 'Sample entrance', group: 'trailEntrance' }, { id: 'd', lat: c[1] - 0.001, lng: c[0] - 0.0009, name: 'Sample access', group: 'creekAccess' }], [c]);
  const total = Object.keys(p.featureStyles).length;
  return (
    <SettingsPage onReset={() => updateActiveMapPreset((x) => { x.featureStyles = {}; })} resetLabel="Reset all map colours">
      <View style={{ height: 250, borderRadius: radius.lg, overflow: 'hidden', ...shadow.card }}>
        <CreekMap preset={p} pins={sample} showUser={false} initial={{ center: c, zoom: 15.3 }} attributionBottom={4} />
      </View>
      <Text style={[font.small, { marginTop: 6 }]}>Live map (zoom in to street level to see trails, streams and roads in your colours). The 4 markers are samples, not real places. Changing a built-in preset makes your own copy.</Text>

      <Group2 title="How colours are drawn" footer="Vector maps (Standard, Terrain, Topo, Dark, Light) are recoloured directly. Satellite imagery has no map features of its own, so CreekFinder draws real OpenStreetMap trails, water, roads and more on top in your colours. “Auto” does that on satellite only.">
        <SegmentRow title="Draw OpenStreetMap features on top" options={[{ id: 'auto', label: 'Auto' }, { id: 'on', label: 'Always' }, { id: 'off', label: 'Never' }]} value={p.overlay} onChange={(v) => updateActiveMapPreset((x) => { x.overlay = v; })} />
        <SwitchRow icon="contrast" title="Visibility outline" subtitle="A thin light/dark outline under lines so any colour stays visible on satellite, terrain or standard maps" value={p.halo} onChange={(v) => updateActiveMapPreset((x) => { x.halo = v; })} />
      </Group2>

      <Group2 title="Colour schemes" footer="Save your colours as a named scheme and re-apply it to any map preset.">
        {allSchemes(lib).map((s) => (
          <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 }}>
            <View style={{ flexDirection: 'row' }}>{(['hikingTrail', 'creek', 'river', 'publicRoad', 'bridge'] as const).map((id, i) => <View key={id} style={{ width: 20, height: 20, borderRadius: 10, marginLeft: i ? -5 : 0, backgroundColor: resolveFeature(s.styles, id).color, borderWidth: 1.5, borderColor: colors.surface }} />)}</View>
            <Text style={{ flex: 1, fontWeight: '700' }} numberOfLines={1}>{s.name}</Text>
            <Button small variant="secondary" title="Apply" onPress={() => applyScheme(s.styles)} />
            <Pressy onPress={() => setCode(encodeShare('colorscheme', s.name, { styles: s.styles }))} accessibilityLabel={`Share ${s.name}`} hitSlop={6}><Ionicons name="share-outline" size={20} color={colors.muted} /></Pressy>
            {!s.official && <Pressy onPress={() => deleteScheme(s.id)} accessibilityLabel={`Delete ${s.name}`} hitSlop={6}><Ionicons name="trash" size={19} color={colors.danger} /></Pressy>}
          </View>))}
        <View style={{ padding: 12 }}><Button small icon="bookmark" title="Save my current colours as a scheme" onPress={() => setNaming(true)} disabled={total === 0} /></View>
      </Group2>
      {code ? <CodeBox title="Colour scheme" code={code} filename="map-colours.creekfinder.txt" /> : null}

      <Text style={[font.label, { marginTop: 22, marginLeft: 4 }]}>Preview swatches on</Text>
      <View style={{ flexDirection: 'row', marginTop: 8 }}>{(Object.keys(BACKDROPS) as (keyof typeof BACKDROPS)[]).map((k) => <Chip key={k} label={BACKDROPS[k].label} active={bd === k} onPress={() => setBd(k)} />)}</View>

      {FEATURE_GROUPS.map((g) => (
        <Group2 key={g} title={`${g} · ${FEATURES.filter((f) => f.group === g).length}`} footer={g === 'Land' ? 'Public-land boundaries come from OpenStreetMap protected-area data. CreekFinder has NO private-property parcel data and never shows ownership lines.' : undefined}>
          {FEATURES.filter((f) => f.group === g).map((def) => {
            const r = resolveFeature(p.featureStyles, def.id); const isOpen = open === def.id; const line = def.kind === 'line'; const fill = def.kind === 'fill' || def.kind === 'shade'; const pt = def.kind === 'point';
            return (
              <View key={def.id}>
                <Pressy onPress={() => setOpen(isOpen ? null : def.id)} scale={0.99} accessibilityLabel={`${def.label}, colour ${r.color}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 }}>
                  <FeatureSample def={def} r={r} bg={BACKDROPS[bd].bg} />
                  <View style={{ flex: 1 }}><Text style={{ fontWeight: '700' }}>{def.label}</Text><Text style={font.small}>{r.color}{r.custom ? ' · customised' : ''}{!r.visible ? ' · hidden' : ''}</Text></View>
                  <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.faint} />
                </Pressy>
                {isOpen && (
                  <View style={{ backgroundColor: colors.surface2, paddingBottom: 8 }}>
                    {def.blurb ? <Text style={[font.small, { padding: 14, paddingBottom: 0 }]}>{def.blurb}</Text> : null}
                    <ColorPicker label={def.label} value={r.color} onChange={(hex) => setFeatureStyle(def.id, { color: hex })} />
                    {line && <SliderRow title="Line thickness" value={r.width} min={0.5} max={12} step={0.1} format={(v) => `${v.toFixed(1)} px`} onChange={(v) => setFeatureStyle(def.id, { width: +v.toFixed(1) })} />}
                    {(line || fill) && <SliderRow title="Transparency" subtitle="Lower = more see-through" value={r.opacity} min={0.05} max={1} step={0.05} format={(v) => `${Math.round(v * 100)}% visible`} onChange={(v) => setFeatureStyle(def.id, { opacity: +v.toFixed(2) })} />}
                    {line && <SwitchRow icon="remove" title="Dashed line" value={r.dash} onChange={(v) => setFeatureStyle(def.id, { dash: v })} />}
                    {pt && <SliderRow title="Marker size" value={r.size} min={0.5} max={2.5} step={0.1} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => setFeatureStyle(def.id, { size: +v.toFixed(1) })} />}
                    <SwitchRow icon="eye" title="Show on map" value={r.visible} onChange={(v) => setFeatureStyle(def.id, { visible: v })} />
                    <View style={{ padding: 14, paddingBottom: 6 }}><Button small variant="secondary" icon="refresh" title={`Reset ${def.label.toLowerCase()}`} onPress={() => setFeatureStyle(def.id, null)} disabled={!r.custom && r.visible} /></View>
                  </View>)}
              </View>);
          })}
        </Group2>))}
      <Banner tone="info" icon="information-circle">Contours, hills shading and some land areas only exist in the Terrain and Topographic styles. Private roads and trails appear only where OpenStreetMap tags them private — missing tags mean unknown, not open.</Banner>
      <TextPrompt visible={naming} title="Name this colour scheme" placeholder="e.g. Neon trails" onCancel={() => setNaming(false)} onSubmit={(n) => { saveScheme(n, p.featureStyles); setNaming(false); }} />
    </SettingsPage>
  );
}
void Alert;
export default themed(MapColors);

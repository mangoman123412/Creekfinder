import React, { useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Camera, GeoJSONSource, Layer, Map, Marker, UserLocation, type CameraRef, type MapRef } from '@maplibre/maplibre-react-native';
import { Ionicons } from '../custom/Icon';
import type { MapStyleKey } from '../types';
import { colors } from '../theme';
import { useActiveMapPreset, useMapStyle, groupColors, groupSizes, overlayOn } from '../custom/useMapPrefs';
import { useOsmOverlay } from '../custom/useOverlay';
import { overlayLayerSpecs, type View as MapView } from '../custom/osmOverlay';
import type { MapPreset, MarkerShape } from '../custom/schema';

export type PinGroup = 'saved' | 'community' | 'osm' | 'target' | 'visited' | 'parking' | 'customPin' | 'campsite' | 'trailEntrance' | 'creekAccess' | 'bridge';
export interface MapRoute { id: string; coords: [number, number][]; color: string; dash?: boolean; width?: number }
export interface MapPin { id: string; lat: number; lng: number; name: string; group: PinGroup; kind?: string }

export interface CreekMapProps {
  styleKey?: MapStyleKey;                       // optional override of the preset's map type
  preset?: MapPreset;                           // optional: render with a specific (e.g. draft) preset
  pins?: MapPin[]; selectedId?: string | null;
  routes?: MapRoute[];                          // e.g. walking routes from the Access Finder
  track?: { lat: number; lng: number }[]; multiTrack?: { lat: number; lng: number }[][]; guide?: { lat: number; lng: number }[];
  showUser?: boolean; initial?: { center: [number, number]; zoom: number };
  onPressPin?: (pin: MapPin) => void; onPressMap?: (lat: number, lng: number) => void; onLongPress?: (lat: number, lng: number) => void;
  onRegionChange?: (e: { center: [number, number]; zoom: number; bounds: [number, number, number, number]; userInteraction: boolean }) => void;
  style?: StyleProp<ViewStyle>; attributionBottom?: number; maxZoom?: number; children?: React.ReactNode;
}

/** Effective preset: the user's active one, with an optional map-type override from legacy callers. */
export function useEffectivePreset(p: { preset?: MapPreset; styleKey?: MapStyleKey }): MapPreset {
  const active = useActiveMapPreset();
  return useMemo(() => { const base = p.preset ?? active; return p.styleKey && !p.preset ? { ...base, style: p.styleKey === 'terrain' ? 'terrain' : p.styleKey === 'satellite' ? 'satellite' : 'standard' } : base; }, [p.preset, p.styleKey, active]);
}
export const brightnessOverlay = (b: number) => (b === 0 ? null : b > 0 ? `rgba(255,255,255,${Math.min(0.55, b * 0.9)})` : `rgba(0,0,0,${Math.min(0.6, -b * 1.1)})`);

const SHAPE_NATIVE: MarkerShape[] = ['square', 'diamond', 'triangle', 'star'];
function ShapeView({ shape, color, size }: { shape: MarkerShape; color: string; size: number }) {
  const s = 22 * size;
  if (shape === 'star') return <Ionicons name="star" size={s * 1.2} color={color} style={{ textShadowColor: '#fff', textShadowRadius: 3 } as any} />;
  if (shape === 'triangle') return <View style={{ width: 0, height: 0, borderLeftWidth: s * 0.55, borderRightWidth: s * 0.55, borderBottomWidth: s, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: color }} />;
  return <View style={{ width: s * 0.8, height: s * 0.8, backgroundColor: color, borderWidth: 2.5, borderColor: '#fff', borderRadius: 3, transform: [{ rotate: shape === 'diamond' ? '45deg' : '0deg' }] }} />;
}

export function CreekMap(p: CreekMapProps & { cameraRef?: React.Ref<CameraRef>; mapRef?: React.Ref<MapRef> }) {
  const preset = useEffectivePreset(p);
  const { style, brightness } = useMapStyle(preset);
  const gc = groupColors(preset); const gs = groupSizes(preset);
  const [view, setView] = useState<MapView | null>(null); const viewT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ovOn = overlayOn(preset); const ov = useOsmOverlay(view, ovOn);
  const specs = useMemo(() => (ovOn ? overlayLayerSpecs(preset.featureStyles, preset.halo, view?.zoom ?? 14) : []), [ovOn, preset.featureStyles, preset.halo, (view?.zoom ?? 14) >= 15.5]); // eslint-disable-line react-hooks/exhaustive-deps
  const routesFc = useMemo(() => ({ type: 'FeatureCollection' as const, features: (p.routes ?? []).map((r) => ({ type: 'Feature' as const, properties: { color: r.color, w: r.width ?? 4, dash: r.dash ? 1 : 0 }, geometry: { type: 'LineString' as const, coordinates: r.coords } })) }), [p.routes]);
  const size = preset.markers.size, shape = preset.markers.shape;
  const useMarkers = SHAPE_NATIVE.includes(shape) && (p.pins?.length ?? 0) <= 150;

  const fc = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: (useMarkers ? [] : p.pins ?? []).map((pin) => ({ type: 'Feature' as const, id: pin.id, properties: { id: pin.id, name: pin.name, group: pin.group, color: gc[pin.group], sz: gs[pin.group] ?? 1 }, geometry: { type: 'Point' as const, coordinates: [pin.lng, pin.lat] } })),
  }), [p.pins, gc.saved, gc.community, gc.osm, gc.visited, gc.parking, gc.customPin, gc.campsite, gc.trailEntrance, gc.creekAccess, gc.bridge, JSON.stringify(gs), useMarkers]); // eslint-disable-line react-hooks/exhaustive-deps
  const line = (pts?: { lat: number; lng: number }[]) => ({ type: 'FeatureCollection' as const, features: pts && pts.length > 1 ? [{ type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: pts.map((t) => [t.lng, t.lat]) } }] : [] });
  const trackFc = useMemo(() => p.multiTrack?.length
    ? { type: 'FeatureCollection' as const, features: [{ type: 'Feature' as const, properties: {}, geometry: { type: 'MultiLineString' as const, coordinates: p.multiTrack.filter((l) => l.length > 1).map((l) => l.map((t) => [t.lng, t.lat])) } }] }
    : line(p.track), [p.track, p.multiTrack]);
  const guideFc = useMemo(() => line(p.guide), [p.guide]);
  const overlay = brightnessOverlay(brightness);
  const ring = shape === 'ring';

  return (
    <View style={[StyleSheet.absoluteFill, p.style]}>
      <Map style={StyleSheet.absoluteFill} mapStyle={style as any} logo={false} attributionPosition={{ bottom: p.attributionBottom ?? 8, left: 8 }} compass compassPosition={{ top: 120, right: 12 }} touchPitch={false}
        onLongPress={(e) => { const [lng, lat] = e.nativeEvent.lngLat; p.onLongPress?.(lat, lng); }}
        onPress={(e) => { const [lng, lat] = e.nativeEvent.lngLat; p.onPressMap?.(lat, lng); }}
        onRegionDidChange={(e) => { const v = e.nativeEvent; if (viewT.current) clearTimeout(viewT.current); viewT.current = setTimeout(() => setView({ bounds: v.bounds as [number, number, number, number], zoom: v.zoom }), 500); p.onRegionChange?.({ center: v.center as [number, number], zoom: v.zoom, bounds: v.bounds as [number, number, number, number], userInteraction: v.userInteraction }); }} ref={p.mapRef}>
        <Camera ref={p.cameraRef} initialViewState={{ center: p.initial?.center ?? [-98.5, 39.8], zoom: p.initial?.zoom ?? preset.defaultZoom ?? 3 }} maxZoom={p.maxZoom ?? 20} />
        {ovOn && (
          <GeoJSONSource id="cf-osm" data={ov.data as any}>
            {specs.map(({ source, ...s }) => <Layer key={s.id} {...(s as any)} />)}
          </GeoJSONSource>
        )}
        <GeoJSONSource id="cf-routes" data={routesFc as any}>
          <Layer type="line" id="cf-routes-casing" paint={{ 'line-color': '#FFFFFF', 'line-width': ['+', ['get', 'w'], 3], 'line-opacity': 0.8 }} layout={{ 'line-cap': 'round', 'line-join': 'round' }} />
          <Layer type="line" id="cf-routes-line" paint={{ 'line-color': ['get', 'color'], 'line-width': ['get', 'w'] }} layout={{ 'line-cap': 'round', 'line-join': 'round' }} />
        </GeoJSONSource>
        <GeoJSONSource id="guide" data={guideFc}><Layer type="line" id="guide-line" paint={{ 'line-color': colors.water, 'line-width': 3, 'line-dasharray': [2, 2] }} layout={{ 'line-cap': 'round' }} /></GeoJSONSource>
        <GeoJSONSource id="track" data={trackFc}>
          <Layer type="line" id="track-casing" paint={{ 'line-color': '#FFFFFF', 'line-width': 7, 'line-opacity': 0.9 }} layout={{ 'line-cap': 'round', 'line-join': 'round' }} />
          <Layer type="line" id="track-line" paint={{ 'line-color': '#E4572E', 'line-width': 4 }} layout={{ 'line-cap': 'round', 'line-join': 'round' }} />
        </GeoJSONSource>
        <GeoJSONSource id="pins" data={fc} cluster={!useMarkers} clusterRadius={42} clusterMaxZoom={13} hitbox={{ top: 12, bottom: 12, left: 12, right: 12 }}
          onPress={(e) => { const f = e.nativeEvent.features?.[0]; if (!f || f.properties?.cluster) return; const pin = (p.pins ?? []).find((x) => x.id === f.properties?.id); if (pin) p.onPressPin?.(pin); }}>
          <Layer type="circle" id="pins-cluster" filter={['has', 'point_count']} paint={{ 'circle-color': colors.primaryDeep, 'circle-radius': 17, 'circle-stroke-width': 2.5, 'circle-stroke-color': '#fff' }} />
          <Layer type="symbol" id="pins-count" filter={['has', 'point_count']} layout={{ 'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Noto Sans Bold'], 'text-size': 13 }} paint={{ 'text-color': '#ffffff' }} />
          <Layer type="circle" id="pins-sel" filter={['==', ['get', 'id'], p.selectedId ?? '']} paint={{ 'circle-color': '#FFD54A', 'circle-radius': 17 * size, 'circle-opacity': 0.9 }} />
          <Layer type="circle" id="pins-dot" filter={['!', ['has', 'point_count']]} paint={{ 'circle-color': ring ? 'rgba(0,0,0,0)' : ['get', 'color'], 'circle-radius': ['*', (ring ? 8 : 9) * size, ['get', 'sz']], 'circle-stroke-width': ring ? 4 * size : 3, 'circle-stroke-color': ring ? ['get', 'color'] : '#FFFFFF' }} />
        </GeoJSONSource>
        {useMarkers && (p.pins ?? []).map((pin) => (
          <Marker key={pin.id} id={pin.id} lngLat={[pin.lng, pin.lat]} onPress={() => p.onPressPin?.(pin)}><ShapeView shape={shape} color={gc[pin.group]} size={size} /></Marker>
        ))}
        {p.showUser !== false && <UserLocation accuracy heading />}
        {p.children}
      </Map>
      {overlay && <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: overlay }]} />}
    </View>
  );
}

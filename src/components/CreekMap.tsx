import React, { useMemo } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Camera, GeoJSONSource, Layer, Map, UserLocation, type CameraRef, type MapRef } from '@maplibre/maplibre-react-native';
import type { MapStyleKey } from '../types';
import { styleUrl } from '../lib/mapStyles';
import { isDark } from '../theme';
import { colors } from '../theme';

export type PinGroup = 'saved' | 'community' | 'osm' | 'target';
export interface MapPin { id: string; lat: number; lng: number; name: string; group: PinGroup; kind?: string }

export interface CreekMapProps {
  styleKey: MapStyleKey;
  pins?: MapPin[];
  selectedId?: string | null;
  track?: { lat: number; lng: number }[];
  multiTrack?: { lat: number; lng: number }[][];   // many separate trails (history overview)
  guide?: { lat: number; lng: number }[];         // dashed guidance line (e.g. you -> destination, or way back)
  showUser?: boolean;
  initial?: { center: [number, number]; zoom: number };
  onPressPin?: (pin: MapPin) => void;
  onPressMap?: (lat: number, lng: number) => void;
  onLongPress?: (lat: number, lng: number) => void;
  onRegionChange?: (e: { center: [number, number]; zoom: number; bounds: [number, number, number, number]; userInteraction: boolean }) => void;
  style?: StyleProp<ViewStyle>;
  attributionBottom?: number;
  maxZoom?: number;
  children?: React.ReactNode;
}

const GROUP_COLOR: Record<PinGroup, string> = { saved: colors.forest, community: colors.water, osm: '#7A8F86', target: colors.danger };

export function CreekMap(p: CreekMapProps & { cameraRef?: React.Ref<CameraRef>; mapRef?: React.Ref<MapRef> }) {
  {
    const fc = useMemo(() => ({
      type: 'FeatureCollection' as const,
      features: (p.pins ?? []).map((pin) => ({
        type: 'Feature' as const, id: pin.id,
        properties: { id: pin.id, name: pin.name, group: pin.group, kind: pin.kind ?? '', color: GROUP_COLOR[pin.group] },
        geometry: { type: 'Point' as const, coordinates: [pin.lng, pin.lat] },
      })),
    }), [p.pins]);
    const trackFc = useMemo(() => ({
      type: 'FeatureCollection' as const,
      features: p.multiTrack?.length
        ? [{ type: 'Feature' as const, properties: {}, geometry: { type: 'MultiLineString' as const, coordinates: p.multiTrack.filter((l) => l.length > 1).map((l) => l.map((t) => [t.lng, t.lat])) } }]
        : p.track && p.track.length > 1 ? [{ type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: p.track.map((t) => [t.lng, t.lat]) } }] : [],
    }), [p.track, p.multiTrack]);
    const guideFc = useMemo(() => ({
      type: 'FeatureCollection' as const,
      features: p.guide && p.guide.length > 1 ? [{ type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: p.guide.map((t) => [t.lng, t.lat]) } }] : [],
    }), [p.guide]);

    return (
      <Map
        style={[StyleSheet.absoluteFill, p.style]}
        mapStyle={styleUrl(p.styleKey, isDark())}
        logo={false}
        attributionPosition={{ bottom: p.attributionBottom ?? 8, left: 8 }}
        compass
        compassPosition={{ top: 120, right: 12 }}
        touchPitch={false}
        onLongPress={(e) => { const [lng, lat] = e.nativeEvent.lngLat; p.onLongPress?.(lat, lng); }}
        onPress={(e) => { const [lng, lat] = e.nativeEvent.lngLat; p.onPressMap?.(lat, lng); }}
        onRegionDidChange={(e) => {
          const v = e.nativeEvent;
          p.onRegionChange?.({ center: v.center as [number, number], zoom: v.zoom, bounds: v.bounds as [number, number, number, number], userInteraction: v.userInteraction });
        }}
        ref={p.mapRef}
      >
        <Camera
          ref={p.cameraRef}
          initialViewState={{ center: p.initial?.center ?? [-98.5, 39.8], zoom: p.initial?.zoom ?? 3 }}
          maxZoom={p.maxZoom ?? 20}
        />

        <GeoJSONSource id="guide" data={guideFc}>
          <Layer type="line" id="guide-line" paint={{ 'line-color': colors.water, 'line-width': 3, 'line-dasharray': [2, 2] }} layout={{ 'line-cap': 'round' }} />
        </GeoJSONSource>
        <GeoJSONSource id="track" data={trackFc}>
          <Layer type="line" id="track-casing" paint={{ 'line-color': '#FFFFFF', 'line-width': 7, 'line-opacity': 0.9 }} layout={{ 'line-cap': 'round', 'line-join': 'round' }} />
          <Layer type="line" id="track-line" paint={{ 'line-color': '#E4572E', 'line-width': 4 }} layout={{ 'line-cap': 'round', 'line-join': 'round' }} />
        </GeoJSONSource>

        <GeoJSONSource
          id="pins" data={fc} cluster clusterRadius={42} clusterMaxZoom={13} hitbox={{ top: 12, bottom: 12, left: 12, right: 12 }}
          onPress={(e) => {
            const f = e.nativeEvent.features?.[0];
            if (!f || f.properties?.cluster) return;
            const pin = (p.pins ?? []).find((x) => x.id === f.properties?.id);
            if (pin) p.onPressPin?.(pin);
          }}
        >
          <Layer type="circle" id="pins-cluster" filter={['has', 'point_count']} paint={{ 'circle-color': colors.forestDark, 'circle-radius': 17, 'circle-stroke-width': 2.5, 'circle-stroke-color': '#fff' }} />
          <Layer type="symbol" id="pins-count" filter={['has', 'point_count']} layout={{ 'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Noto Sans Bold'], 'text-size': 13 }} paint={{ 'text-color': '#ffffff' }} />
          <Layer type="circle" id="pins-sel" filter={['==', ['get', 'id'], p.selectedId ?? '']} paint={{ 'circle-color': '#FFD54A', 'circle-radius': 17, 'circle-opacity': 0.9 }} />
          <Layer type="circle" id="pins-dot" filter={['!', ['has', 'point_count']]} paint={{ 'circle-color': ['get', 'color'], 'circle-radius': 9, 'circle-stroke-width': 3, 'circle-stroke-color': '#FFFFFF' }} />
        </GeoJSONSource>

        {p.showUser !== false && <UserLocation accuracy heading />}
        {p.children}
      </Map>
    );
  }
}

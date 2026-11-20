import React, { useEffect, useImperativeHandle, useRef } from 'react';
import { View } from 'react-native';
import type { CreekMapProps, MapPin } from './CreekMap';
import { colors } from '../theme';
import { useActiveMapPreset, useMapStyle, groupColors } from '../custom/useMapPrefs';
import { markerPixels } from '../custom/markerImage';
import type { MapPreset } from '../custom/schema';

export type { MapPin, PinGroup, CreekMapProps } from './CreekMap';
const empty = { type: 'FeatureCollection', features: [] as any[] };
const pad = (p?: any) => ({ top: p?.top ?? 0, bottom: p?.bottom ?? 0, left: p?.left ?? 0, right: p?.right ?? 0 });
const GROUPS = ['saved', 'community', 'osm', 'visited', 'parking', 'target'] as const;

export const brightnessOverlay = (b: number) => (b === 0 ? null : b > 0 ? `rgba(255,255,255,${Math.min(0.55, b * 0.9)})` : `rgba(0,0,0,${Math.min(0.6, -b * 1.1)})`);

/** Web map: MapLibre GL JS. Same props, camera API and customization as the native map. */
export function CreekMap(p: CreekMapProps & { cameraRef?: React.Ref<any>; mapRef?: React.Ref<any> }) {
  const active = useActiveMapPreset();
  const preset: MapPreset = p.preset ?? (p.styleKey ? { ...active, style: p.styleKey === 'terrain' ? 'terrain' : p.styleKey === 'satellite' ? 'satellite' : 'standard' } : active);
  const { style, brightness } = useMapStyle(preset);
  const host = useRef<HTMLDivElement | null>(null);
  const map = useRef<any>(null);
  const ready = useRef(false);
  const props = useRef(p); props.current = p;
  const presetRef = useRef(preset); presetRef.current = preset;
  const userDot = useRef<any>(null); const watchId = useRef<number | null>(null);

  useImperativeHandle(p.cameraRef as any, () => ({
    jumpTo: (o: any) => map.current?.jumpTo({ center: o.center, zoom: o.zoom }),
    easeTo: (o: any) => map.current?.easeTo({ center: o.center, zoom: o.zoom, duration: o.duration ?? 500 }),
    flyTo: (o: any) => map.current?.flyTo({ center: o.center, zoom: o.zoom, duration: o.duration ?? 800 }),
    fitBounds: (b: number[], o: any = {}) => map.current?.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: pad(o.padding), duration: o.duration ?? 0 }),
    zoomTo: (z: number) => map.current?.zoomTo(z), setStop: async () => {},
  }), []);

  const gcOf = () => groupColors(presetRef.current);
  const setData = (id: string, data: any) => { const s = map.current?.getSource(id); if (s) s.setData(data); };
  const pinsFc = () => { const gc = gcOf(); return { type: 'FeatureCollection', features: (props.current.pins ?? []).map((pin) => ({ type: 'Feature', id: pin.id, properties: { id: pin.id, name: pin.name, group: pin.group, color: gc[pin.group] }, geometry: { type: 'Point', coordinates: [pin.lng, pin.lat] } })) }; };
  const lineFc = (pts?: { lat: number; lng: number }[]) => ({ type: 'FeatureCollection', features: pts && pts.length > 1 ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: pts.map((t) => [t.lng, t.lat]) } }] : [] });
  const trackFc = () => { const q = props.current; if (q.multiTrack?.length) return { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'MultiLineString', coordinates: q.multiTrack.filter((l) => l.length > 1).map((l) => l.map((t) => [t.lng, t.lat])) } }] }; return lineFc(q.track); };

  /** (Re)create images, sources and layers. Runs after every style load, because setStyle wipes them. */
  const setup = () => {
    const m = map.current; if (!m) return; const pr = presetRef.current; const gc = gcOf();
    const size = pr.markers.size;
    for (const g of GROUPS) { const name = `pin-${g}`; if (m.hasImage(name)) m.removeImage(name); m.addImage(name, markerPixels(pr.markers.shape, gc[g]), { pixelRatio: 2 }); }
    const add = (fn: () => void) => { try { fn(); } catch { /* already exists */ } };
    add(() => { m.addSource('guide', { type: 'geojson', data: empty }); m.addLayer({ id: 'guide-line', type: 'line', source: 'guide', paint: { 'line-color': colors.water, 'line-width': 3, 'line-dasharray': [2, 2] } }); });
    add(() => { m.addSource('track', { type: 'geojson', data: empty }); m.addLayer({ id: 'track-casing', type: 'line', source: 'track', paint: { 'line-color': '#fff', 'line-width': 7, 'line-opacity': 0.9 }, layout: { 'line-cap': 'round', 'line-join': 'round' } }); m.addLayer({ id: 'track-line', type: 'line', source: 'track', paint: { 'line-color': '#E4572E', 'line-width': 4 }, layout: { 'line-cap': 'round', 'line-join': 'round' } }); });
    add(() => {
      m.addSource('pins', { type: 'geojson', data: empty, cluster: true, clusterRadius: 42, clusterMaxZoom: 13 });
      m.addLayer({ id: 'pins-cluster', type: 'circle', source: 'pins', filter: ['has', 'point_count'], paint: { 'circle-color': colors.primaryDeep, 'circle-radius': 17, 'circle-stroke-width': 2.5, 'circle-stroke-color': '#fff' } });
      m.addLayer({ id: 'pins-count', type: 'symbol', source: 'pins', filter: ['has', 'point_count'], layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Noto Sans Bold'], 'text-size': 13 }, paint: { 'text-color': '#ffffff' } });
      m.addLayer({ id: 'pins-sel', type: 'circle', source: 'pins', filter: ['==', ['get', 'id'], ''], paint: { 'circle-color': '#FFD54A', 'circle-radius': 17 * size, 'circle-opacity': 0.9 } });
      m.addLayer({ id: 'pins-dot', type: 'symbol', source: 'pins', filter: ['!', ['has', 'point_count']], layout: { 'icon-image': ['concat', 'pin-', ['get', 'group']], 'icon-size': size, 'icon-allow-overlap': true, 'icon-ignore-placement': true } });
    });
    ready.current = true; sync();
  };
  const sync = () => {
    if (!ready.current || !map.current) return;
    const m = map.current; const pr = presetRef.current; const gc = gcOf();
    for (const g of GROUPS) { const name = `pin-${g}`; if (m.hasImage(name)) m.removeImage(name); m.addImage(name, markerPixels(pr.markers.shape, gc[g]), { pixelRatio: 2 }); }
    if (m.getLayer('pins-dot')) m.setLayoutProperty('pins-dot', 'icon-size', pr.markers.size);
    if (m.getLayer('pins-sel')) { m.setPaintProperty('pins-sel', 'circle-radius', 17 * pr.markers.size); m.setFilter('pins-sel', ['==', ['get', 'id'], props.current.selectedId ?? '']); }
    setData('pins', pinsFc()); setData('track', trackFc()); setData('guide', lineFc(props.current.guide));
  };

  useEffect(() => {
    const ml = (window as any).maplibregl; if (!ml || !host.current) return;
    const init = props.current.initial;
    const m = new ml.Map({ container: host.current, style, center: init?.center ?? [-98.5, 39.8], zoom: init?.zoom ?? presetRef.current.defaultZoom ?? 3, maxZoom: props.current.maxZoom ?? 20, attributionControl: { compact: true }, pitchWithRotate: false, dragRotate: false });
    map.current = m; (window as any).__cfmap = m;
    m.touchZoomRotate?.disableRotation?.();
    m.on('style.load', () => { ready.current = false; setup(); });
    m.on('click', 'pins-dot', (e: any) => { const id = e.features?.[0]?.properties?.id; const pin = (props.current.pins ?? []).find((x: MapPin) => x.id === id); if (pin) { e.originalEvent.__pin = true; props.current.onPressPin?.(pin); } });
    m.on('click', 'pins-cluster', (e: any) => { const f = e.features?.[0]; e.originalEvent.__pin = true; m.getSource('pins').getClusterExpansionZoom(f.properties.cluster_id).then((z: number) => m.easeTo({ center: f.geometry.coordinates, zoom: z + 0.5 })); });
    m.on('click', (e: any) => { if (!e.originalEvent.__pin) props.current.onPressMap?.(e.lngLat.lat, e.lngLat.lng); });
    m.on('mouseenter', 'pins-dot', () => { m.getCanvas().style.cursor = 'pointer'; }); m.on('mouseleave', 'pins-dot', () => { m.getCanvas().style.cursor = ''; });
    let t: any = null, start: any = null; const cancel = () => { if (t) { clearTimeout(t); t = null; } };
    m.on('touchstart', (e: any) => { if (e.points?.length > 1) return cancel(); start = e.point; t = setTimeout(() => { t = null; props.current.onLongPress?.(e.lngLat.lat, e.lngLat.lng); }, 600); });
    m.on('touchmove', (e: any) => { if (start && e.point.dist(start) > 8) cancel(); });
    m.on('touchend', cancel); m.on('touchcancel', cancel); m.on('dragstart', cancel); m.on('zoomstart', cancel);
    m.on('contextmenu', (e: any) => props.current.onLongPress?.(e.lngLat.lat, e.lngLat.lng));
    m.on('moveend', (e: any) => { const b = m.getBounds(); const c = m.getCenter(); props.current.onRegionChange?.({ center: [c.lng, c.lat], zoom: m.getZoom(), bounds: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], userInteraction: !!e.originalEvent }); });
    m.on('movestart', (e: any) => { if (e.originalEvent) props.current.onRegionChange?.({ center: [m.getCenter().lng, m.getCenter().lat], zoom: m.getZoom(), bounds: [0, 0, 0, 0], userInteraction: true }); });
    if (props.current.showUser !== false && 'geolocation' in navigator) {
      const el = document.createElement('div'); el.style.cssText = 'width:18px;height:18px;border-radius:50%;background:#1E88C7;border:3px solid #fff;box-shadow:0 0 0 2px rgba(30,136,199,.35)';
      watchId.current = navigator.geolocation.watchPosition((pos) => { if (!userDot.current) userDot.current = new ml.Marker({ element: el }).setLngLat([pos.coords.longitude, pos.coords.latitude]).addTo(m); else userDot.current.setLngLat([pos.coords.longitude, pos.coords.latitude]); }, () => {}, { enableHighAccuracy: true, maximumAge: 5000 });
    }
    const ro = new ResizeObserver(() => m.resize()); ro.observe(host.current);
    return () => { ro.disconnect(); if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current); m.remove(); map.current = null; ready.current = false; userDot.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // style (map type, layer visibility, brightness-in-raster, hiking overlay) changed -> swap style, then layers are re-created on style.load
  const lastStyle = useRef<any>(style);
  useEffect(() => { const m = map.current; if (!m || lastStyle.current === style) return; lastStyle.current = style; ready.current = false; m.setStyle(style, { diff: false }); }, [style]);
  useEffect(sync, [p.pins, p.track, p.multiTrack, p.guide, p.selectedId, preset.markers.size, preset.markers.shape, JSON.stringify(preset.markers.colors), colors.markerSaved, colors.markerCommunity, colors.markerOsm]); // eslint-disable-line react-hooks/exhaustive-deps

  const overlay = brightnessOverlay(brightness);
  return (
    <View style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }, p.style as any]}>
      <div ref={host} style={{ position: 'absolute', inset: 0 }} />
      {overlay ? <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: overlay }} /> : null}
    </View>
  );
}

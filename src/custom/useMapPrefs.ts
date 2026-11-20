import { useEffect, useMemo, useState } from 'react';
import { useLibrary, useSettings, getMapPreset } from './store';
import { styleUrlFor } from '../lib/mapStyles';
import { transformStyle } from './styleTransform';
import { fetchJson } from '../lib/net';
import { cached } from '../lib/cache';
import { isDark, colors } from '../theme';
import type { MapPreset } from './schema';
import { resolveFeature } from './mapFeatures';

/** The preset currently in use (live: re-renders on change). */
export function useActiveMapPreset(): MapPreset { const lib = useLibrary(); const s = useSettings(); return getMapPreset(s.mapPresetId, lib); }

/** Resolve a preset to a ready-to-render style: the style JSON with the preset's layers/brightness/overlays applied. */
export function useMapStyle(preset: MapPreset): { style: string | object; brightness: number; fellBack: boolean } {
  const { url, fellBack } = styleUrlFor(preset.style, isDark());
  const [json, setJson] = useState<{ url: string; data: any } | null>(null);
  useEffect(() => {
    let live = true;
    cached(`style:${url}`, 7 * 86400e3, () => fetchJson<any>(url, { timeoutMs: 20000 })).then((r) => { if (live) setJson({ url, data: r.data }); }).catch(() => {});
    return () => { live = false; };
  }, [url]);
  const key = JSON.stringify([preset.layers, preset.brightness, preset.show.hikingTrails, preset.style, preset.featureStyles]);
  const style = useMemo(() => (json && json.url === url ? transformStyle(json.data, preset) : url), [json, url, key]); // eslint-disable-line react-hooks/exhaustive-deps
  return { style, brightness: preset.brightness, fellBack };
}

/** Does this preset draw the OSM overlay? auto = only on satellite/hybrid (they have no vector features of their own). */
export const overlayOn = (p: MapPreset) => p.overlay === 'on' || (p.overlay === 'auto' && (p.style === 'satellite' || p.style === 'hybrid'));

/** Pin colour + size per marker group: feature styles (Map Colors) win, then legacy marker colours, then the theme. */
export const groupColors = (preset: MapPreset) => {
  const fs = preset.featureStyles; const c = preset.markers.colors;
  return {
    saved: fs.saved?.color ?? c.markerSaved ?? colors.markerSaved, community: c.markerCommunity ?? colors.markerCommunity, osm: c.markerOsm ?? colors.markerOsm,
    visited: c.markerVisited ?? colors.markerVisited, parking: fs.parking?.color ?? c.markerParking ?? colors.markerParking, target: colors.danger,
    customPin: resolveFeature(fs, 'customPin').color, campsite: resolveFeature(fs, 'campsite').color, trailEntrance: resolveFeature(fs, 'trailEntrance').color,
    creekAccess: resolveFeature(fs, 'creekAccess').color, bridge: resolveFeature(fs, 'bridge').color,
  };
};
export const groupSizes = (preset: MapPreset): Record<string, number> => {
  const fs = preset.featureStyles; const s = (id: any) => resolveFeature(fs, id).size;
  return { saved: s('saved'), community: 1, osm: 1, visited: 1, parking: s('parking'), target: 1, customPin: s('customPin'), campsite: s('campsite'), trailEntrance: s('trailEntrance'), creekAccess: s('creekAccess'), bridge: s('bridge') };
};

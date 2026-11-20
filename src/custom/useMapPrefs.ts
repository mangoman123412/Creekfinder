import { useEffect, useMemo, useState } from 'react';
import { useLibrary, useSettings, getMapPreset } from './store';
import { styleUrlFor } from '../lib/mapStyles';
import { transformStyle } from './styleTransform';
import { fetchJson } from '../lib/net';
import { cached } from '../lib/cache';
import { isDark, colors } from '../theme';
import type { MapPreset } from './schema';

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
  const key = JSON.stringify([preset.layers, preset.brightness, preset.show.hikingTrails, preset.style]);
  const style = useMemo(() => (json && json.url === url ? transformStyle(json.data, preset) : url), [json, url, key]); // eslint-disable-line react-hooks/exhaustive-deps
  return { style, brightness: preset.brightness, fellBack };
}

export const groupColors = (preset: MapPreset) => ({
  saved: preset.markers.colors.markerSaved ?? colors.markerSaved, community: preset.markers.colors.markerCommunity ?? colors.markerCommunity, osm: preset.markers.colors.markerOsm ?? colors.markerOsm,
  visited: preset.markers.colors.markerVisited ?? colors.markerVisited, parking: preset.markers.colors.markerParking ?? colors.markerParking, target: colors.danger,
});

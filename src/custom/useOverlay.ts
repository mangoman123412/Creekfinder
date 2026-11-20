import { useEffect, useRef, useState } from 'react';
import { fetchJson } from '../lib/net';
import { cached } from '../lib/cache';
import { overlayBox, overlayQuery, toGeoJSON, type FC, type OsmEl, type View } from './osmOverlay';

const EMPTY: FC = { type: 'FeatureCollection', features: [] };
const SERVERS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

/** Loads OSM features for the visible area (cached per grid cell, works offline for areas seen before). */
export function useOsmOverlay(view: View | null, enabled: boolean): { data: FC; loading: boolean; tooFar: boolean } {
  const [data, setData] = useState<FC>(EMPTY); const [loading, setLoading] = useState(false);
  const lastKey = useRef(''); const box = enabled && view ? overlayBox(view) : null;
  const key = box?.key ?? '';
  useEffect(() => {
    if (!enabled) { lastKey.current = ''; setData(EMPTY); return; }
    if (!box) return;
    if (lastKey.current === key) return;
    lastKey.current = key; let live = true; setLoading(true);
    const zoomBucket = view!.zoom >= 15.5 ? 'hi' : 'lo';
    cached(`overlay:${key}:${zoomBucket}`, 14 * 86400e3, async () => {
      const q = overlayQuery(box, view!.zoom); let err: unknown;
      for (const base of SERVERS) { try { const d = await fetchJson<{ elements: OsmEl[] }>(`${base}?data=${encodeURIComponent(q)}`, { timeoutMs: 30000 }); return toGeoJSON(d.elements); } catch (e) { err = e; } }
      throw err;
    }).then((r) => { if (live) setData(r.data); }).catch(() => {}).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [enabled, key]); // eslint-disable-line react-hooks/exhaustive-deps
  return { data: enabled ? data : EMPTY, loading, tooFar: enabled && !!view && !box };
}

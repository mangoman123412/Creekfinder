import { fetchJson } from './net';
import { cached, geoKey } from './cache';
import { accessQuery, analyzeAccess, type AccessResult, type LL } from '../custom/accessFinder';
import type { OsmEl } from '../custom/osmOverlay';

const SERVERS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
/** Fetch OSM data around a spot and analyse how to get in. Cached for 14 days (works offline for places viewed before). */
export async function findAccess(p: LL): Promise<{ result: AccessResult; stale: boolean }> {
  const { data, stale } = await cached(`access:${geoKey(p.lat, p.lng, 4)}`, 14 * 86400e3, async () => {
    const q = accessQuery(p); let err: unknown;
    for (const base of SERVERS) { try { return (await fetchJson<{ elements: OsmEl[] }>(`${base}?data=${encodeURIComponent(q)}`, { timeoutMs: 40000 })).elements; } catch (e) { err = e; } }
    throw err instanceof Error ? err : new Error('Map data unavailable');
  });
  return { result: analyzeAccess(data, p), stale };
}

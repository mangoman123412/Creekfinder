import { kvGet, kvSet } from '../db/local';

/** Small offline-friendly cache in local SQLite. Fresh data wins; if the network fails, stale data is returned. */
export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<{ data: T; stale: boolean }> {
  let hit: { t: number; d: T } | null = null;
  try { const raw = await kvGet(`c:${key}`); if (raw) hit = JSON.parse(raw); } catch {}
  if (hit && Date.now() - hit.t < ttlMs) return { data: hit.d, stale: false };
  try {
    const d = await fn();
    try { await kvSet(`c:${key}`, JSON.stringify({ t: Date.now(), d })); } catch {}
    return { data: d, stale: false };
  } catch (e) {
    if (hit) return { data: hit.d, stale: true };
    throw e;
  }
}
export const geoKey = (lat: number, lng: number, p = 3) => `${lat.toFixed(p)},${lng.toFixed(p)}`;

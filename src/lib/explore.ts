import { config, hasMapTiler } from '../config';
import { fetchJson } from './net';
import { haversine, boundsAround } from './geo';
import { commonsPhotos, nearestTown, townsNear, waterPhotosNear, type GuidePhoto } from './guide';
import type { ExploreItem, PlaceKind } from '../types';
import { supabase } from './supabase';

/**
 * REAL data only. Sources:
 *  - OpenStreetMap (via the Overpass API): named waterfalls, rivers, streams, springs, swim spots. Labelled "OpenStreetMap".
 *  - CreekFinder community: public places submitted by users. Labelled "Community – unverified" unless a moderator verified it.
 * Nothing is invented or bundled as sample data.
 */

const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

interface OsmEl { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }

function kindFromTags(t: Record<string, string>): PlaceKind {
  if (t.waterway === 'waterfall') return 'waterfall';
  if (t.leisure === 'swimming_area' || t.sport === 'swimming' || t.natural === 'beach' || t.leisure === 'bathing_place') return 'swimming_hole';
  if (t.natural === 'spring' || t.natural === 'hot_spring') return 'spring';
  if (t.waterway === 'river') return 'river';
  if (t.waterway === 'stream' || t.waterway === 'brook') return 'stream';
  if (t.water === 'pond' || t.water === 'lake' || t.water === 'reservoir') return 'pond_lake';
  return 'creek';
}

export async function searchOsmWater(center: { lat: number; lng: number }, radiusM = 25000): Promise<ExploreItem[]> {
  const r = Math.min(radiusM, 50000);
  // Named features only (an unnamed ditch isn't a useful destination). waterway lines are returned as a representative centre point.
  const q = `[out:json][timeout:25];(
    nwr(around:${r},${center.lat},${center.lng})["waterway"="waterfall"];
    nwr(around:${r},${center.lat},${center.lng})["waterway"~"^(river|stream|brook)$"]["name"];
    nwr(around:${r},${center.lat},${center.lng})["natural"~"^(spring|hot_spring)$"]["name"];
    nwr(around:${r},${center.lat},${center.lng})["leisure"~"^(swimming_area|bathing_place)$"];
    nwr(around:${r},${center.lat},${center.lng})["natural"="water"]["water"~"^(lake|pond|reservoir)$"]["name"];
  );out center tags 400;`;
  let lastErr: unknown;
  for (const base of OVERPASS) {
    try {
      const data = await fetchJson<{ elements: OsmEl[] }>(`${base}?data=${encodeURIComponent(q)}`, { timeoutMs: 30000, headers: { 'User-Agent': config.userAgent } });
      const seen = new Map<string, ExploreItem>();
      for (const el of data.elements) {
        const tags = el.tags ?? {};
        const lat = el.lat ?? el.center?.lat;
        const lng = el.lon ?? el.center?.lon;
        if (lat == null || lng == null) continue;
        const kind = kindFromTags(tags);
        const name = tags.name ?? (kind === 'waterfall' ? 'Waterfall (unnamed)' : kind === 'swimming_hole' ? 'Swimming area' : 'Water');
        // Waterways are returned as many segments; collapse same-named ones to the closest segment.
        const dedupeKey = `${name}|${kind}`;
        const item: ExploreItem = {
          key: `osm-${el.type}-${el.id}`, source: 'osm', name, kind, lat, lng, osmId: `${el.type}/${el.id}`,
          description: tags.description ?? tags['name:en'] ?? null, distance_m: haversine(center, { lat, lng }), tags, photo: tagPhoto(tags),
        };
        const prev = seen.get(dedupeKey);
        if (!prev || item.distance_m! < prev.distance_m!) seen.set(dedupeKey, item);
      }
      return [...seen.values()].sort((a, b) => a.distance_m! - b.distance_m!);
    } catch (e) { lastErr = e; }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Could not reach OpenStreetMap data.');
}

export async function searchCommunity(center: { lat: number; lng: number }, radiusM = 50000): Promise<ExploreItem[]> {
  if (!supabase) return [];
  const [w, s, e, n] = boundsAround(center, radiusM);
  const { data, error } = await supabase.rpc('public_places_in_bounds', { west: w, south: s, east: e, north: n, max_rows: 300 });
  if (error) throw error;
  return (data ?? []).map((p: any): ExploreItem => ({
    key: `cf-${p.id}`, source: p.verified ? 'verified' : 'community', name: p.name, kind: p.kind, lat: p.lat, lng: p.lng, description: p.description,
    distance_m: haversine(center, p), placeId: p.id, author: p.author, avg_rating: p.avg_rating ? Number(p.avg_rating) : null, rating_count: Number(p.rating_count ?? 0), created_at: p.created_at,
  })).sort((a: ExploreItem, b: ExploreItem) => a.distance_m! - b.distance_m!);
}

export async function communityInBounds(b: [number, number, number, number]): Promise<ExploreItem[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('public_places_in_bounds', { west: b[0], south: b[1], east: b[2], north: b[3], max_rows: 400 });
  if (error) throw error;
  return (data ?? []).map((p: any): ExploreItem => ({
    key: `cf-${p.id}`, source: p.verified ? 'verified' : 'community', name: p.name, kind: p.kind, lat: p.lat, lng: p.lng, description: p.description,
    placeId: p.id, author: p.author, avg_rating: p.avg_rating ? Number(p.avg_rating) : null, rating_count: Number(p.rating_count ?? 0),
  }));
}

export interface GeoResult { name: string; lat: number; lng: number }

/** City / state / ZIP / place search. Uses MapTiler geocoding when a key exists, otherwise OpenStreetMap Nominatim (low volume, user-initiated only). */
export async function geocode(query: string): Promise<GeoResult[]> {
  const q = query.trim();
  if (!q) return [];
  if (hasMapTiler) {
    const d = await fetchJson<{ features: { place_name: string; center: [number, number] }[] }>(
      `https://api.maptiler.com/geocoding/${encodeURIComponent(q)}.json?key=${config.maptilerKey}&limit=6`);
    return d.features.map((f) => ({ name: f.place_name, lng: f.center[0], lat: f.center[1] }));
  }
  const d = await fetchJson<{ display_name: string; lat: string; lon: string }[]>(
    `https://nominatim.openstreetmap.org/search?format=json&limit=6&q=${encodeURIComponent(q)}`, { headers: { 'User-Agent': config.userAgent } });
  return d.map((r) => ({ name: r.display_name, lat: Number(r.lat), lng: Number(r.lon) }));
}

function tagPhoto(t: Record<string, string>): ExploreItem['photo'] {
  if (t.image && /^https?:\/\//.test(t.image)) return { url: t.image, credit: 'OpenStreetMap contributor', pageUrl: t.image, license: '' };
  const f = t.wikimedia_commons;
  if (f && /^File:/i.test(f)) {
    const name = f.replace(/^File:/i, '');
    return { url: `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(name)}?width=900`, credit: 'Wikimedia Commons', pageUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(f)}`, license: 'Open license' };
  }
  return null;
}

/** Give each item a real, nearby water photo (never reused on two cards) and its nearest town. */
export function assignPhotos(items: ExploreItem[], photos: GuidePhoto[]): void {
  const used = new Set<string>();
  for (const it of items) {
    if (it.photo) continue;
    const pick = waterPhotosNear(photos, it, it.name, 2.5).find((p) => !used.has(p.id));
    if (pick) { used.add(pick.id); it.photo = { url: pick.url, credit: pick.credit, pageUrl: pick.pageUrl, license: pick.license }; }
  }
}

export async function enrichItems(items: ExploreItem[], center: { lat: number; lng: number }, radiusM = 25000): Promise<ExploreItem[]> {
  const [ph, tw] = await Promise.allSettled([commonsPhotos(center.lat, center.lng, 10000, 100), townsNear(center.lat, center.lng, radiusM)]);
  if (ph.status === 'fulfilled') assignPhotos(items, ph.value);
  if (tw.status === 'fulfilled') for (const it of items) { const t = nearestTown(tw.value, it); if (t && t.distance_m < 30000) { it.town = t.name; it.townDist = t.distance_m; } }
  return items;
}

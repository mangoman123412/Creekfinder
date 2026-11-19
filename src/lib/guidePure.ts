import { haversine, type LL } from './geo';

export interface GuidePhoto { id: string; url: string; full: string; title: string; credit: string; license: string; pageUrl: string; lat?: number; lng?: number }

const WATER_RE = /creek|river|stream|brook|falls?\b|cascade|rapids|waterfall|spring|swimming|lake|pond|gorge|\brun\b|fork|branch|ford|pool|dam\b|reservoir|bayou|canyon/i;
export const looksLikeWater = (title: string) => WATER_RE.test(title);
const strip = (h?: string) => (h ?? '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

/** Photos near a point that are actually of water (title test), nearest first; name matches rank first. */
export function waterPhotosNear(photos: GuidePhoto[], c: LL, name?: string, maxKm = 3): GuidePhoto[] {
  const words = (name ?? '').toLowerCase().split(/\W+/).filter((w) => w.length > 3 && !/creek|river|falls|fork|stream|brook|lake|water/.test(w));
  return photos
    .filter((p) => looksLikeWater(p.title) || (words.length > 0 && words.some((w) => p.title.toLowerCase().includes(w))))
    .map((p) => ({ p, d: p.lat != null && p.lng != null ? haversine(c, { lat: p.lat, lng: p.lng }) : 1e9, hit: words.some((w) => p.title.toLowerCase().includes(w)) }))
    .filter((x) => x.d <= maxKm * 1000 || x.hit)
    .sort((a, b) => Number(b.hit) - Number(a.hit) || a.d - b.d)
    .map((x) => x.p);
}

export interface Feature { name: string; kind: string; distance_m: number; lat: number; lng: number; osmId: string; tags: Record<string, string> }
export interface Surroundings {
  waterfalls: Feature[]; swimming: Feature[]; camping: Feature[]; parking: Feature[]; bridges: Feature[]; trails: Feature[]; rocks: Feature[]; roads: Feature[];
}
export interface El { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }

const roadRank = (h?: string) => ({ primary: 0, secondary: 1, tertiary: 2, unclassified: 3, residential: 4, service: 5, track: 6, living_street: 4, road: 5 } as Record<string, number>)[h ?? ''] ?? 9;

export function classify(els: El[], c: LL): Surroundings {
  const out: Surroundings = { waterfalls: [], swimming: [], camping: [], parking: [], bridges: [], trails: [], rocks: [], roads: [] };
  const seen = new Set<string>();
  const add = (list: Feature[], f: Feature, dedupe = true) => {
    const k = `${f.kind}|${f.name}`;
    if (dedupe && f.name && seen.has(k)) { const i = list.findIndex((x) => x.name === f.name && x.kind === f.kind); if (i >= 0 && list[i].distance_m <= f.distance_m) return; if (i >= 0) list.splice(i, 1); }
    seen.add(k); list.push(f);
  };
  for (const e of els) {
    const t = e.tags ?? {};
    const lat = e.lat ?? e.center?.lat, lng = e.lon ?? e.center?.lon;
    if (lat == null || lng == null) continue;
    const d = haversine(c, { lat, lng });
    const mk = (name: string, kind: string): Feature => ({ name, kind, distance_m: d, lat, lng, osmId: `${e.type}/${e.id}`, tags: t });
    if (t.waterway === 'waterfall') add(out.waterfalls, mk(t.name ?? 'Waterfall', 'waterfall'));
    else if (t.leisure === 'swimming_area' || t.leisure === 'bathing_place' || t.sport === 'swimming') add(out.swimming, mk(t.name ?? 'Swimming area', 'swimming'));
    else if (t.tourism === 'camp_site' || t.tourism === 'caravan_site') {
      if (t.access === 'private' || t.access === 'no' || t.access === 'permit') continue; // only publicly accessible
      add(out.camping, mk(t.name ?? 'Campground', 'camp'));
    } else if (t.amenity === 'parking') {
      if (t.access === 'private' || t.access === 'customers' || t.access === 'no') continue;
      add(out.parking, mk(t.name ?? 'Parking area', 'parking'), false);
    } else if (t.man_made === 'bridge' || (t.bridge && t.bridge !== 'no' && t.highway)) add(out.bridges, mk(t.name ?? (t.highway === 'footway' || t.highway === 'path' ? 'Footbridge' : 'Bridge'), 'bridge'), false);
    else if (t.route === 'hiking' || t.route === 'foot' || (t.highway && /^(path|footway|bridleway|steps)$/.test(t.highway) && t.name)) add(out.trails, mk(t.name ?? 'Trail', 'trail'));
    else if (t.natural && /^(rock|stone|cliff|bare_rock|cave_entrance|peak|rock_formation)$/.test(t.natural)) add(out.rocks, mk(t.name ?? ({ cliff: 'Cliff', bare_rock: 'Bare rock', rock: 'Rock', stone: 'Boulder', cave_entrance: 'Cave entrance', peak: 'Peak', rock_formation: 'Rock formation' } as Record<string, string>)[t.natural], t.natural));
    else if (t.highway && t.name && roadRank(t.highway) < 9) add(out.roads, mk(t.name, t.highway), false);
  }
  for (const k of Object.keys(out) as (keyof Surroundings)[]) out[k].sort((a, b) => a.distance_m - b.distance_m);
  out.roads.sort((a, b) => a.distance_m - b.distance_m || roadRank(a.kind) - roadRank(b.kind));
  return out;
}

const TREE_RE = /\b(oak|maple|pine|hemlock|birch|poplar|sycamore|beech|hickory|cedar|spruce|fir|willow|elm|ash|walnut|magnolia|tulip ?tree|poplar|cypress|redbud|dogwood|sweetgum|gum|locust|sassafras|buckeye|chestnut|aspen|alder|cottonwood|juniper|redwood|sequoia|tree)\b/i;
export const isTree = (n: string) => TREE_RE.test(n);

export interface Town { name: string; lat: number; lng: number }
export function nearestTown(towns: Town[], p: LL): { name: string; distance_m: number } | null {
  let best: { name: string; distance_m: number } | null = null;
  for (const t of towns) { const d = haversine(p, t); if (!best || d < best.distance_m) best = { name: t.name, distance_m: d }; }
  return best;
}


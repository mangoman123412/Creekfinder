import type { OsmEl } from './osmOverlay';

/**
 * Access Finder — pure analysis of OpenStreetMap data around a point.
 * It finds the nearest trail entrances, public access points, legal-looking parking, bridges that cross a waterway, paths that lead
 * toward the spot, the nearest road, and COMPUTES walking routes (Dijkstra over mapped foot-accessible ways, skipping anything tagged
 * private / no access). "Legal" here only ever means "the map data does not say it is closed": land ownership is NOT known, so every
 * result is marked unverified and the UI tells the user to confirm signs and access themselves.
 */
export interface LL { lat: number; lng: number }
export type Access = 'public' | 'unknown' | 'blocked' | 'permit';
const WALK = new Set(['path', 'footway', 'track', 'bridleway', 'steps', 'pedestrian', 'cycleway', 'service', 'residential', 'unclassified', 'tertiary', 'secondary', 'living_street', 'primary', 'road']);
const TRAIL = new Set(['path', 'footway', 'track', 'bridleway', 'steps', 'pedestrian', 'cycleway']);
const DRIVE = new Set(['service', 'residential', 'unclassified', 'tertiary', 'secondary', 'primary', 'living_street', 'road', 'track']);
const FACTOR: Record<string, number> = { path: 1, footway: 1, bridleway: 1, pedestrian: 1, cycleway: 1, track: 1.05, steps: 1.3, service: 1.5, residential: 1.6, living_street: 1.6, unclassified: 1.6, tertiary: 1.9, secondary: 2.4, primary: 3, road: 2 };
const WALK_M_PER_MIN = 75; // 4.5 km/h

export function accessOf(t: Record<string, string>, foot = true): Access {
  if (['private', 'no'].includes(t.access) || (foot && ['private', 'no'].includes(t.foot)) || t.access === 'customers' || t.access === 'delivery' || t.access === 'agricultural' || t.access === 'forestry') return 'blocked';
  if (t.access === 'permit' || t.foot === 'permit') return 'permit';
  if (['yes', 'public', 'permissive', 'designated'].includes(t.access) || ['yes', 'designated', 'permissive'].includes(t.foot)) return 'public';
  return 'unknown';
}

// ---------------------------------------------------------------- geometry (metres, local equirectangular)
const KLAT = 110540;
const kLng = (lat: number) => 111320 * Math.cos((lat * Math.PI) / 180);
export function dist(a: LL, b: LL): number { const dy = (b.lat - a.lat) * KLAT, dx = (b.lng - a.lng) * kLng((a.lat + b.lat) / 2); return Math.hypot(dx, dy); }
function projectToSegment(p: LL, a: LL, b: LL): { d: number; pt: LL } {
  const k = kLng(p.lat); const ax = (a.lng - p.lng) * k, ay = (a.lat - p.lat) * KLAT, bx = (b.lng - p.lng) * k, by = (b.lat - p.lat) * KLAT;
  const vx = bx - ax, vy = by - ay; const len2 = vx * vx + vy * vy; let t = len2 ? -(ax * vx + ay * vy) / len2 : 0; t = Math.max(0, Math.min(1, t));
  const x = ax + vx * t, y = ay + vy * t; return { d: Math.hypot(x, y), pt: { lat: p.lat + y / KLAT, lng: p.lng + x / k } };
}
export function nearestOnLine(p: LL, pts: LL[]): { d: number; pt: LL; i: number } {
  let best = { d: Infinity, pt: pts[0], i: 0 };
  for (let i = 1; i < pts.length; i++) { const r = projectToSegment(p, pts[i - 1], pts[i]); if (r.d < best.d) best = { d: r.d, pt: r.pt, i: i - 1 }; }
  return best;
}
function segIntersect(p1: LL, p2: LL, p3: LL, p4: LL): boolean {
  const o = (a: LL, b: LL, c: LL) => (b.lng - a.lng) * (c.lat - a.lat) - (b.lat - a.lat) * (c.lng - a.lng);
  const d1 = o(p3, p4, p1), d2 = o(p3, p4, p2), d3 = o(p1, p2, p3), d4 = o(p1, p2, p4);
  return d1 * d2 < 0 && d3 * d4 < 0;
}
const linesCross = (A: LL[], B: LL[]) => { for (let i = 1; i < A.length; i++) for (let j = 1; j < B.length; j++) if (segIntersect(A[i - 1], A[i], B[j - 1], B[j])) return true; return false; };
export const bearingDeg = (a: LL, b: LL) => { const dy = (b.lat - a.lat) * KLAT, dx = (b.lng - a.lng) * kLng(a.lat); return (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360; };

// ---------------------------------------------------------------- results
export interface Place { id: string; name: string; kind: 'parking' | 'trailhead' | 'access' | 'entrance' | 'road'; access: Access; inferred?: boolean; at: LL; straight_m: number; walk_m?: number; minutes?: number; note?: string }
export interface Bridge { id: string; name: string; at: LL; straight_m: number; crossesWaterway: boolean; waterway?: string }
export interface PathNear { id: string; name: string; kind: string; access: Access; closest_m: number; at: LL; bearing: number }
export interface Route { id: string; from: Place; coords: [number, number][]; walk_m: number; trail_m: number; road_m: number; minutes: number; ways: string[]; confidence: 'tagged-public' | 'unverified'; gap_m: number; notes: string[] }
export interface AccessResult {
  target: LL; nearestRoad: Place | null; parking: Place[]; trailheads: Place[]; accessPoints: Place[]; entrances: Place[]; bridges: Bridge[]; paths: PathNear[]; routes: Route[];
  goalDistance_m: number | null; warnings: string[]; counts: { ways: number; walkable: number; blocked: number };
}

interface Way { id: number; name: string; hw: string; tags: Record<string, string>; pts: LL[]; access: Access }
const toLL = (g: { lat: number; lon: number }[]): LL[] => g.map((p) => ({ lat: p.lat, lng: p.lon }));
const centroid = (pts: LL[]): LL => { let a = 0, b = 0; for (const p of pts) { a += p.lat; b += p.lng; } return { lat: a / pts.length, lng: b / pts.length }; };
const key = (p: LL) => `${Math.round(p.lat * 1e5)},${Math.round(p.lng * 1e5)}`;

class Heap { a: [number, string][] = []; push(x: [number, string]) { const a = this.a; a.push(x); let i = a.length - 1; while (i) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop(): [number, string] | undefined { const a = this.a; if (!a.length) return; const top = a[0]; const last = a.pop()!; if (a.length) { a[0] = last; let i = 0; for (;;) { let l = 2 * i + 1, r = l + 1, m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } } return top; } get size() { return this.a.length; } }

export function analyzeAccess(els: OsmEl[], target: LL, opts: { maxRoutes?: number; snapM?: number; goalM?: number } = {}): AccessResult {
  const snap = opts.snapM ?? 140, goalMax = opts.goalM ?? 260;
  const ways: Way[] = []; const waterways: { name: string; pts: LL[] }[] = []; const bridgeWays: Way[] = [];
  const trailheads: Place[] = [], accessPts: Place[] = [], parking: Place[] = [];
  const warnings: string[] = [];

  for (const e of els) {
    const t = e.tags ?? {}; const g = e.geometry && e.geometry.length > 1 ? toLL(e.geometry) : null;
    const at: LL | null = e.type === 'node' && e.lat != null ? { lat: e.lat, lng: e.lon! } : e.center ? { lat: e.center.lat, lng: e.center.lon } : g ? centroid(g) : null;
    if (t.waterway && g && ['stream', 'river', 'brook', 'canal', 'ditch', 'drain'].includes(t.waterway)) waterways.push({ name: t.name ?? t.waterway, pts: g });
    if (t.highway && g && WALK.has(t.highway)) {
      const w: Way = { id: e.id, name: t.name ?? t.ref ?? '', hw: t.highway, tags: t, pts: g, access: accessOf(t) }; ways.push(w);
      if ((t.bridge && t.bridge !== 'no') || t.man_made === 'bridge') bridgeWays.push(w);
    }
    if (!at) continue;
    const mk = (kind: Place['kind'], name: string, access: Access, note?: string): Place => ({ id: `${e.type}${e.id}`, name, kind, access, at, straight_m: dist(at, target), note });
    if (t.highway === 'trailhead' || t.information === 'trailhead') trailheads.push(mk('trailhead', t.name ?? 'Trailhead', accessOf(t, false), t.description));
    else if (t.waterway === 'access_point' || t.leisure === 'slipway' || t.canoe === 'put_in' || t.canoe === 'portage' || t.whitewater === 'put_in' || t.whitewater === 'egress') accessPts.push(mk('access', t.name ?? (t.leisure === 'slipway' ? 'Boat ramp' : 'Water access'), accessOf(t, false)));
    else if (t.amenity === 'parking') { const a = accessOf(t, false); if (a !== 'blocked') parking.push(mk('parking', t.name ?? 'Parking area', a, t.fee === 'yes' ? 'Fee' : t.capacity ? `${t.capacity} spaces` : undefined)); }
  }

  const walkable = ways.filter((w) => w.access !== 'blocked' && w.access !== 'permit');
  const blocked = ways.length - walkable.length;

  // ---- nearest road (drivable)
  let nearestRoad: Place | null = null; let rd = Infinity;
  for (const w of ways) { if (!DRIVE.has(w.hw) || w.hw === 'track' || w.access === 'blocked') continue; const r = nearestOnLine(target, w.pts); if (r.d < rd) { rd = r.d; nearestRoad = { id: `road${w.id}`, name: w.name || `Unnamed ${w.hw.replace('_', ' ')}`, kind: 'road', access: w.access, at: r.pt, straight_m: r.d, note: w.hw === 'track' ? 'Track — may need a high-clearance vehicle' : undefined }; } }

  // ---- bridges that cross a waterway
  const bridges: Bridge[] = [];
  for (const w of bridgeWays) {
    const near = nearestOnLine(target, w.pts); if (near.d > 900) continue;
    const crossing = waterways.find((ww) => linesCross(w.pts, ww.pts)) ?? waterways.find((ww) => ww.pts.some((p) => nearestOnLine(p, w.pts).d < 6));
    bridges.push({ id: `br${w.id}`, name: w.name || (TRAIL.has(w.hw) ? 'Footbridge' : 'Bridge'), at: near.pt, straight_m: near.d, crossesWaterway: !!crossing, waterway: crossing?.name });
  }
  bridges.sort((a, b) => Number(b.crossesWaterway) - Number(a.crossesWaterway) || a.straight_m - b.straight_m);

  // ---- paths that lead toward the spot
  const paths: PathNear[] = [];
  for (const w of ways) { if (!TRAIL.has(w.hw)) continue; const r = nearestOnLine(target, w.pts); if (r.d <= 150) paths.push({ id: `p${w.id}`, name: w.name || `Unnamed ${w.hw}`, kind: w.hw, access: w.access, closest_m: r.d, at: r.pt, bearing: bearingDeg(r.pt, target) }); }
  paths.sort((a, b) => a.closest_m - b.closest_m);

  // ---- walking graph over foot-accessible, not-closed ways
  type Edge = { to: string; w: number; m: number; way: Way };
  const adj = new Map<string, Edge[]>(); const pos = new Map<string, LL>(); const driveNodes = new Set<string>();
  const add = (a: string, b: string, w: number, m: number, way: Way) => { if (!adj.has(a)) adj.set(a, []); adj.get(a)!.push({ to: b, w, m, way }); };
  for (const w of walkable) {
    const f = FACTOR[w.hw] ?? 2;
    for (let i = 0; i < w.pts.length; i++) { const k = key(w.pts[i]); pos.set(k, w.pts[i]); if (DRIVE.has(w.hw) && w.hw !== 'track') driveNodes.add(k); if (i) { const k0 = key(w.pts[i - 1]); if (k0 === k) continue; const m = dist(w.pts[i - 1], w.pts[i]); add(k0, k, m * f, m, w); add(k, k0, m * f, m, w); } }
  }
  const nearestNode = (p: LL, max: number): { k: string; d: number } | null => { let bk: string | null = null, bd = max; for (const [k, q] of pos) { const d = dist(p, q); if (d < bd) { bd = d; bk = k; } } return bk ? { k: bk, d: bd } : null; };

  const goal = adj.size ? nearestNode(target, goalMax) : null;
  let routes: Route[] = []; const entrances: Place[] = [];
  const inferredSeen = new Set<string>();

  if (goal) {
    // Dijkstra from the goal outward (undirected) -> reconstruct a path from any start
    const D = new Map<string, number>([[goal.k, 0]]); const prev = new Map<string, { k: string; e: Edge }>(); const H = new Heap(); H.push([0, goal.k]);
    while (H.size) { const [d, u] = H.pop()!; if (d > (D.get(u) ?? Infinity)) continue; for (const e of adj.get(u) ?? []) { const nd = d + e.w; if (nd < (D.get(e.to) ?? Infinity)) { D.set(e.to, nd); prev.set(e.to, { k: u, e }); H.push([nd, e.to]); } } }
    const routeFrom = (start: Place, snapNode: string): Route | null => {
      if (!D.has(snapNode)) return null; const coords: [number, number][] = []; const ways = new Set<string>(); let trail = 0, road = 0, cur = snapNode; let safe = 0;
      const sp = pos.get(snapNode)!; coords.push([sp.lng, sp.lat]);
      while (cur !== goal.k && safe++ < 20000) { const p = prev.get(cur); if (!p) return null; const q = pos.get(p.k)!; coords.push([q.lng, q.lat]); if (TRAIL.has(p.e.way.hw)) trail += p.e.m; else road += p.e.m; if (p.e.way.name) ways.add(p.e.way.name); cur = p.k; }
      const walk = trail + road; const approach = dist(start.at, sp);
      const allTagged = [...new Set<Way>()]; void allTagged;
      const confident = (() => { let ok = true; let c = snapNode; let n = 0; while (c !== goal.k && n++ < 20000) { const p = prev.get(c)!; if (p.e.way.access !== 'public' && !(DRIVE.has(p.e.way.hw) && p.e.way.access === 'unknown' && p.e.way.hw !== 'track')) ok = false; c = p.k; } return ok; })();
      const gap = goal.d; const notes: string[] = [];
      if (gap > 25) notes.push(`The mapped path ends about ${Math.round(gap)} m from the spot — the last stretch is off-trail.`);
      if (approach > 30) notes.push(`Start is about ${Math.round(approach)} m from the mapped path.`);
      if (!confident) notes.push('Some ways on this route have no public-access tag. Confirm signs and land access.');
      return { id: `route-${start.id}`, from: start, coords, walk_m: walk + approach + gap, trail_m: trail, road_m: road, minutes: Math.max(1, Math.round((walk + approach + gap) / WALK_M_PER_MIN)), ways: [...ways].slice(0, 8), confidence: confident ? 'tagged-public' : 'unverified', gap_m: gap, notes };
    };
    const withWalk = (p: Place): Place | null => { const n = nearestNode(p.at, snap); if (!n) return null; const d = D.get(n.k); if (d === undefined) return null; const r = routeFrom(p, n.k); if (!r) return null; return { ...p, walk_m: r.walk_m, minutes: r.minutes }; };
    const starts: { p: Place; n: { k: string; d: number } }[] = [];
    for (const list of [parking, trailheads, accessPts]) for (const p of list.slice().sort((a, b) => a.straight_m - b.straight_m).slice(0, 12)) { const n = nearestNode(p.at, snap); if (n && D.has(n.k)) starts.push({ p, n }); }
    // inferred entrances: where a trail meets a drivable road
    for (const w of walkable) { if (!TRAIL.has(w.hw) || w.hw === 'track' && false) continue; for (const end of [w.pts[0], w.pts[w.pts.length - 1]]) { const k = key(end); if (!driveNodes.has(k) || inferredSeen.has(k) || !D.has(k)) continue; inferredSeen.add(k); const p: Place = { id: `inf${k}`, name: w.name ? `${w.name} (trail start)` : `Trail start (${w.hw})`, kind: 'entrance', access: w.access, inferred: true, at: end, straight_m: dist(end, target) }; starts.push({ p, n: { k, d: 0 } }); } }
    if (nearestRoad) { const n = nearestNode(nearestRoad.at, snap); if (n && D.has(n.k)) starts.push({ p: nearestRoad, n }); }
    const all: Route[] = [];
    for (const s of starts) { const r = routeFrom(s.p, s.n.k); if (r) all.push(r); }
    all.sort((a, b) => a.walk_m - b.walk_m);
    // keep distinct, best few: one per start kind first, then fill by distance
    const picked: Route[] = []; const kinds = new Set<string>();
    for (const r of all) { if (!kinds.has(r.from.kind)) { picked.push(r); kinds.add(r.from.kind); } }
    for (const r of all) { if (picked.length >= (opts.maxRoutes ?? 4)) break; if (!picked.includes(r) && !picked.some((x) => x.walk_m === r.walk_m && x.from.kind === r.from.kind)) picked.push(r); }
    routes = picked.sort((a, b) => a.walk_m - b.walk_m).slice(0, opts.maxRoutes ?? 4);
    const wp = new Map<string, Place>(); for (const s of starts) { const r = all.find((x) => x.from.id === s.p.id); if (r) wp.set(s.p.id, { ...s.p, walk_m: r.walk_m, minutes: r.minutes }); }
    for (const list of [parking, trailheads, accessPts]) for (let i = 0; i < list.length; i++) { const w = wp.get(list[i].id); if (w) list[i] = w; }
    entrances.push(...[...wp.values()].filter((p) => p.inferred).sort((a, b) => a.walk_m! - b.walk_m!).slice(0, 6));
    if (nearestRoad && wp.get(nearestRoad.id)) nearestRoad = wp.get(nearestRoad.id)!;
    void withWalk;
  } else if (ways.length) warnings.push('No mapped walking path comes within about 260 m of this spot, so no walking route could be computed.');
  else warnings.push('No paths or roads are mapped around this spot (or the map data could not be loaded).');
  if (blocked) warnings.push(`${blocked} nearby way${blocked > 1 ? 's are' : ' is'} tagged private / no access and ${blocked > 1 ? 'were' : 'was'} excluded from routes.`);

  const byDist = (a: Place, b: Place) => (a.walk_m ?? 1e9 + a.straight_m) - (b.walk_m ?? 1e9 + b.straight_m);
  return {
    target, nearestRoad, parking: parking.sort(byDist).slice(0, 8), trailheads: trailheads.sort(byDist).slice(0, 6), accessPoints: accessPts.sort(byDist).slice(0, 6), entrances, bridges: bridges.slice(0, 8), paths: paths.slice(0, 8), routes,
    goalDistance_m: goal ? goal.d : null, warnings, counts: { ways: ways.length, walkable: walkable.length, blocked },
  };
}

export function accessQuery(p: LL): string {
  const a = (r: number) => `(around:${r},${p.lat},${p.lng})`;
  return `[out:json][timeout:35];(
    way["highway"~"^(path|footway|track|bridleway|steps|pedestrian|cycleway|service|residential|unclassified|tertiary|secondary|living_street)$"]${a(3200)};
    way["waterway"~"^(stream|river|brook|canal|ditch|drain)$"]${a(1600)};
    nwr["amenity"="parking"]${a(6000)}; nwr["highway"="trailhead"]${a(9000)}; nwr["information"="trailhead"]${a(9000)};
    nwr["waterway"="access_point"]${a(6000)}; nwr["leisure"="slipway"]${a(6000)}; nwr["canoe"~"^(put_in|portage)$"]${a(6000)}; nwr["whitewater"~"^(put_in|egress)$"]${a(6000)};
  );out geom tags 4500;`;
}

/**
 * Every map feature a user can colour. One registry drives: the Map Colors settings page, the base-style recolouring,
 * the OpenStreetMap overlay drawn on top of satellite/terrain/standard maps, and the preview swatches.
 */
export type FeatureId =
  | 'hikingTrail' | 'walkingPath' | 'dirtRoad' | 'offroadTrail' | 'privateTrail' | 'unpavedRoad'
  | 'creek' | 'smallStream' | 'river' | 'waterfall' | 'lake' | 'pond' | 'wetland'
  | 'propertyBoundary' | 'forest' | 'field' | 'rocky' | 'cliff' | 'contours' | 'hills' | 'shading'
  | 'publicRoad' | 'privateRoad' | 'bridge' | 'parking' | 'buildings' | 'campsite' | 'trailEntrance' | 'creekAccess' | 'saved' | 'customPin';

export type FeatureKind = 'line' | 'fill' | 'point' | 'shade';
export type FeatureGroup = 'Trails' | 'Water' | 'Land' | 'Other';
export interface FeatureDef { id: FeatureId; label: string; group: FeatureGroup; kind: FeatureKind; color: string; width: number; opacity: number; dash: boolean; size: number; blurb?: string }

const L = (id: FeatureId, label: string, group: FeatureGroup, color: string, width: number, o: Partial<FeatureDef> = {}): FeatureDef => ({ id, label, group, kind: 'line', color, width, opacity: 1, dash: false, size: 1, ...o });
const F = (id: FeatureId, label: string, group: FeatureGroup, color: string, opacity: number, o: Partial<FeatureDef> = {}): FeatureDef => ({ id, label, group, kind: 'fill', color, width: 1, opacity, dash: false, size: 1, ...o });
const P = (id: FeatureId, label: string, group: FeatureGroup, color: string, size = 1, o: Partial<FeatureDef> = {}): FeatureDef => ({ id, label, group, kind: 'point', color, width: 1, opacity: 1, dash: false, size, ...o });

export const FEATURES: FeatureDef[] = [
  L('hikingTrail', 'Hiking trails', 'Trails', '#FF7A00', 3.2, { blurb: 'Named or rated paths and bridleways' }),
  L('walkingPath', 'Walking paths', 'Trails', '#FFD400', 2.6, { blurb: 'Footways, sidewalks and unnamed paths' }),
  L('dirtRoad', 'Dirt roads', 'Trails', '#C98A4B', 3.2, { blurb: 'Tracks and unpaved service roads' }),
  L('offroadTrail', 'Off-road trails', 'Trails', '#E0533C', 3, { dash: true, blurb: '4WD-only and rough tracks' }),
  L('privateTrail', 'Private trails (when tagged)', 'Trails', '#FF2D55', 2.2, { dash: true, blurb: 'Paths tagged private / no access — do not enter' }),
  L('unpavedRoad', 'Unpaved roads', 'Trails', '#E3B76F', 3.4, { blurb: 'Gravel / dirt public roads' }),
  L('creek', 'Creeks', 'Water', '#1E90FF', 3.2, { blurb: 'Named creeks, branches, forks and runs' }),
  L('smallStream', 'Small streams', 'Water', '#4FD0FF', 2.2, { blurb: 'Streams, brooks, drains' }),
  L('river', 'Rivers', 'Water', '#0B4FA8', 5, { blurb: 'Rivers and canals' }),
  P('waterfall', 'Waterfalls', 'Water', '#00E5FF', 1.15),
  F('lake', 'Lakes', 'Water', '#3A8DDE', 0.5),
  F('pond', 'Ponds', 'Water', '#5BB5F0', 0.55),
  F('wetland', 'Wetlands', 'Water', '#3FB68B', 0.45),
  L('propertyBoundary', 'Public-land boundaries', 'Land', '#B24BFF', 2.2, { dash: true, opacity: 0.9, blurb: 'Parks / protected areas ONLY. CreekFinder has no private-property parcel data.' }),
  F('forest', 'Forest', 'Land', '#2E7D32', 0.28),
  F('field', 'Open fields', 'Land', '#C0CA33', 0.24),
  F('rocky', 'Rocky terrain', 'Land', '#8D6E63', 0.5),
  L('cliff', 'Cliffs', 'Land', '#5D4037', 2.6),
  L('contours', 'Elevation contours', 'Land', '#9A6A3A', 1, { opacity: 0.7 }),
  P('hills', 'Hills & peaks', 'Land', '#A1887F', 1),
  { id: 'shading', label: 'Terrain shading', group: 'Land', kind: 'shade', color: '#000000', width: 1, opacity: 0.35, dash: false, size: 1, blurb: 'Hillshade relief (terrain & topo styles)' },
  L('publicRoad', 'Public roads', 'Other', '#FFFFFF', 3.4),
  L('privateRoad', 'Private roads (when tagged)', 'Other', '#FF8A80', 2.4, { dash: true }),
  L('bridge', 'Bridges', 'Other', '#FF1744', 4.2),
  F('parking', 'Parking areas', 'Other', '#9C27B0', 0.55, { kind: 'fill' }),
  F('buildings', 'Buildings', 'Other', '#9E9E9E', 0.6),
  P('campsite', 'Campsites', 'Other', '#43A047', 1.1),
  P('trailEntrance', 'Trail entrances', 'Other', '#FF6D00', 1.25),
  P('creekAccess', 'Creek access points', 'Other', '#00B0FF', 1.2),
  P('saved', 'Saved locations', 'Other', '#1F9D55', 1.1),
  P('customPin', 'Custom pins', 'Other', '#E91E63', 1.1),
];
export const FEATURE_IDS = FEATURES.map((f) => f.id);
export const FEATURE_BY_ID = Object.fromEntries(FEATURES.map((f) => [f.id, f])) as Record<FeatureId, FeatureDef>;
export const FEATURE_GROUPS: FeatureGroup[] = ['Trails', 'Water', 'Land', 'Other'];

/** A user's override for one feature. Any field left undefined falls back to the default above. */
export interface FeatureStyle { color?: string; width?: number; opacity?: number; dash?: boolean; size?: number; visible?: boolean }
export type FeatureStyles = Partial<Record<FeatureId, FeatureStyle>>;
export interface Resolved { color: string; width: number; opacity: number; dash: boolean; size: number; visible: boolean; custom: boolean }

export function resolveFeature(styles: FeatureStyles | undefined, id: FeatureId): Resolved {
  const d = FEATURE_BY_ID[id]; const o = styles?.[id] ?? {};
  return { color: o.color ?? d.color, width: o.width ?? d.width, opacity: o.opacity ?? d.opacity, dash: o.dash ?? d.dash, size: o.size ?? d.size, visible: o.visible ?? true, custom: Object.keys(o).some((k) => k !== 'visible' && (o as any)[k] !== undefined) };
}

const HEX = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const norm = (s: string) => { let h = s.trim().replace('#', ''); if (h.length === 3) h = h.split('').map((c) => c + c).join(''); return `#${h.toUpperCase()}`; };
const clamp = (n: unknown, lo: number, hi: number): number | undefined => (typeof n === 'number' && isFinite(n) ? Math.min(hi, Math.max(lo, n)) : undefined);
export function sanitizeFeatureStyles(raw: unknown): FeatureStyles {
  const out: FeatureStyles = {}; if (!raw || typeof raw !== 'object') return out;
  for (const id of FEATURE_IDS) {
    const r = (raw as any)[id]; if (!r || typeof r !== 'object') continue; const s: FeatureStyle = {};
    if (typeof r.color === 'string' && HEX.test(r.color)) s.color = norm(r.color);
    const w = clamp(r.width, 0.5, 14); if (w !== undefined) s.width = w;
    const op = clamp(r.opacity, 0.05, 1); if (op !== undefined) s.opacity = op;
    if (typeof r.dash === 'boolean') s.dash = r.dash;
    const sz = clamp(r.size, 0.5, 2.5); if (sz !== undefined) s.size = sz;
    if (typeof r.visible === 'boolean') s.visible = r.visible;
    if (Object.keys(s).length) out[id] = s;
  }
  return out;
}

// ------------------------------------------------------------------ classifying OpenStreetMap elements
export type GeomKind = 'line' | 'area' | 'point';
const ROADS = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'service', 'living_street', 'road', 'motorway_link', 'trunk_link', 'primary_link', 'secondary_link', 'tertiary_link']);
const TRAILS = new Set(['path', 'footway', 'track', 'bridleway', 'steps', 'pedestrian', 'cycleway']);
const UNPAVED = new Set(['unpaved', 'gravel', 'dirt', 'ground', 'compacted', 'earth', 'mud', 'sand', 'fine_gravel', 'grass', 'dirt/sand', 'woodchips', 'pebblestone']);
const PRIVATE = (t: Record<string, string>) => ['private', 'no'].includes(t.access) || ['private', 'no'].includes(t.foot) || t.access === 'customers' || t.access === 'permit';

/** Which user-colourable feature is this OSM element? (null = not drawn). Heuristics are documented in the UI. */
export function classifyOsm(t: Record<string, string>, geom: GeomKind): FeatureId | null {
  if (t.tourism === 'camp_site' || t.tourism === 'caravan_site') return 'campsite';
  if (t.highway === 'trailhead' || t.information === 'trailhead') return 'trailEntrance';
  if (t.waterway === 'waterfall') return 'waterfall';
  if (t.waterway === 'access_point' || t.leisure === 'slipway' || t.canoe === 'put_in' || t.canoe === 'portage' || t.whitewater === 'put_in' || t.whitewater === 'egress' || t.leisure === 'fishing') return 'creekAccess';
  if (t.amenity === 'parking') return t.access === 'private' || t.access === 'no' ? null : 'parking';
  if (t.building && t.building !== 'no') return geom === 'point' ? null : 'buildings';
  if (geom === 'line' && ((t.bridge && t.bridge !== 'no') || t.man_made === 'bridge') && (t.highway || t.railway || t.man_made === 'bridge')) return 'bridge';
  if ((t.boundary === 'protected_area' || t.boundary === 'national_park' || t.leisure === 'nature_reserve') && geom !== 'point') return 'propertyBoundary';
  if (t.natural === 'cliff') return 'cliff';
  if (t.natural === 'peak' || t.natural === 'hill') return 'hills';
  if (t.natural === 'wetland' || t.wetland) return 'wetland';
  if (t.natural === 'water' || t.landuse === 'reservoir') return t.water === 'pond' ? 'pond' : 'lake';
  if (t.waterway) {
    if (t.waterway === 'river' || t.waterway === 'canal') return 'river';
    if (t.waterway === 'stream') return /creek|branch|fork|run\b|kill\b|bayou/i.test(t.name ?? '') ? 'creek' : 'smallStream';
    if (['brook', 'ditch', 'drain', 'rapids'].includes(t.waterway)) return t.waterway === 'brook' ? 'creek' : 'smallStream';
    return null;
  }
  if (t.natural === 'wood' || t.landuse === 'forest') return 'forest';
  if (['meadow', 'grass', 'farmland', 'orchard'].includes(t.landuse) || ['grassland', 'heath', 'scrub'].includes(t.natural)) return 'field';
  if (['bare_rock', 'scree', 'rock', 'stone', 'shingle'].includes(t.natural)) return 'rocky';
  const h = t.highway;
  if (h && geom !== 'point') {
    if (ROADS.has(h)) { if (PRIVATE(t)) return 'privateRoad'; return UNPAVED.has(t.surface) || t.tracktype ? 'unpavedRoad' : 'publicRoad'; }
    if (TRAILS.has(h)) {
      if (PRIVATE(t)) return 'privateTrail';
      if (h === 'track') return t['4wd_only'] === 'yes' || /grade[45]/.test(t.tracktype ?? '') ? 'offroadTrail' : 'dirtRoad';
      if (h === 'path' || h === 'bridleway') return t.sac_scale || t.name || t.trail_visibility || t.route === 'hiking' ? 'hikingTrail' : 'walkingPath';
      if (h === 'steps') return t.name ? 'hikingTrail' : 'walkingPath';
      return 'walkingPath'; // footway, pedestrian, cycleway
    }
  }
  return null;
}

// ------------------------------------------------------------------ classifying layers of a vector map style
export function baseLayerFeature(l: any): FeatureId | null {
  const id = String(l.id ?? '').toLowerCase(); const sl = String(l['source-layer'] ?? '').toLowerCase(); const f = JSON.stringify(l.filter ?? '').toLowerCase();
  if (l.type === 'hillshade' || /hillshade|relief/.test(id)) return 'shading';
  if (/contour/.test(sl) || /contour/.test(id)) return l.type === 'symbol' ? null : 'contours';
  if (l.type === 'symbol' || l.type === 'background' || l.type === 'raster') return null;
  if (sl === 'building' || /building/.test(id)) return 'buildings';
  if (sl === 'waterway' || (l.type === 'line' && /waterway|river|stream|canal/.test(id))) {
    if (/river|canal/.test(f + id) && !/stream/.test(id)) return 'river'; if (/stream/.test(f + id)) return 'creek'; if (/ditch|drain/.test(f + id)) return 'smallStream'; return 'river';
  }
  if (sl === 'water' || /^water/.test(id)) { if (/pond/.test(id + f)) return 'pond'; return l.type === 'fill' ? 'lake' : null; }
  if (/wetland/.test(id + f) || /wetland/.test(sl)) return 'wetland';
  if (sl === 'landcover' || sl === 'landuse' || sl === 'park' || /landcover|landuse|park/.test(id)) {
    if (/wood|forest/.test(id + f)) return 'forest'; if (/grass|meadow|farm|field|park|scrub/.test(id + f)) return 'field'; if (/rock|scree|bare|sand/.test(id + f)) return 'rocky'; return null;
  }
  if (sl === 'transportation' || sl === 'transportation_name' || /road|street|highway|path|trail|track|bridge|motorway|pedestrian|footway|service/.test(id)) {
    if (/tunnel|rail|ferry|aeroway|airport/.test(id) || l.type === 'symbol') return null;
    if (/bridge/.test(id) && !/path|track|trail/.test(id)) return 'bridge';
    if (/"path"|"footway"|"steps"|"bridleway"/.test(f) || /path|trail|footway|steps/.test(id)) return 'hikingTrail';
    if (/"pedestrian"|"cycleway"/.test(f) || /pedestrian|cycleway/.test(id)) return 'walkingPath';
    if (/"track"/.test(f) || /track/.test(id)) return 'dirtRoad';
    return 'publicRoad';
  }
  return null;
}

// ------------------------------------------------------------------ colour schemes (named sets of feature styles)
export interface ColorScheme { id: string; name: string; styles: FeatureStyles; official?: boolean }
export const OFFICIAL_SCHEMES: ColorScheme[] = [
  { id: 'scheme-default', name: 'CreekFinder default', styles: {}, official: true },
  { id: 'scheme-trailrunner', name: 'Bright trails', official: true, styles: {
    hikingTrail: { color: '#FF7A00', width: 4 }, creek: { color: '#00A8FF', width: 3.6 }, river: { color: '#003B99', width: 5.5 }, walkingPath: { color: '#FFE600', width: 3 },
    publicRoad: { color: '#FFFFFF', width: 3.6 }, bridge: { color: '#FF1744', width: 5 }, parking: { color: '#A020F0', opacity: 0.6 }, saved: { color: '#00C853', size: 1.3 } } },
  { id: 'scheme-contrast', name: 'High-visibility', official: true, styles: {
    hikingTrail: { color: '#FFFF00', width: 4.5 }, walkingPath: { color: '#FFFFFF', width: 3.6, dash: true }, creek: { color: '#00FFFF', width: 4 }, smallStream: { color: '#7DF9FF', width: 3 }, river: { color: '#0033FF', width: 6 },
    publicRoad: { color: '#FF00FF', width: 3.6 }, bridge: { color: '#FF0000', width: 5 }, parking: { color: '#FFFFFF', opacity: 0.7 }, buildings: { color: '#FFA500', opacity: 0.7 }, saved: { color: '#00FF00', size: 1.5 } } },
  { id: 'scheme-topo', name: 'Classic topo', official: true, styles: {
    hikingTrail: { color: '#B5472B', width: 2.6, dash: true }, walkingPath: { color: '#7A5C3A', width: 2, dash: true }, creek: { color: '#3C7DBF', width: 2.4 }, river: { color: '#2A5F9E', width: 4 }, contours: { color: '#A0522D', opacity: 0.8 },
    forest: { color: '#6FA06B', opacity: 0.3 }, publicRoad: { color: '#E8D8A8', width: 3 }, bridge: { color: '#8B0000', width: 3.6 }, parking: { color: '#6A4C93', opacity: 0.5 } } },
];
export function sanitizeSchemes(raw: unknown): ColorScheme[] {
  if (!Array.isArray(raw)) return []; const out: ColorScheme[] = [];
  for (const [i, s] of raw.slice(0, 40).entries()) out.push({ id: String((s as any)?.id ?? `scheme-${i}`).slice(0, 40), name: String((s as any)?.name ?? 'Colours').replace(/[\u0000-\u001f<>]/g, '').slice(0, 40) || 'Colours', styles: sanitizeFeatureStyles((s as any)?.styles) });
  return out;
}

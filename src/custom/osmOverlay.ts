import { classifyOsm, FEATURE_BY_ID, resolveFeature, type FeatureId, type FeatureStyles, type GeomKind } from './mapFeatures';
import { luminance } from './colorUtils';

/** Pure: Overpass elements (with geometry) -> GeoJSON features tagged with the user-colourable feature id (`f`). */
export interface OsmEl { type: 'node' | 'way' | 'relation'; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; geometry?: { lat: number; lon: number }[]; tags?: Record<string, string>; bounds?: any; members?: any[] }
export type FC = { type: 'FeatureCollection'; features: any[] };
const AREA_FEATURES = new Set<FeatureId>(['lake', 'pond', 'wetland', 'forest', 'field', 'rocky', 'buildings', 'parking']);

export function toGeoJSON(els: OsmEl[], maxFeatures = 3500): FC {
  const features: any[] = [];
  for (const e of els) {
    if (features.length >= maxFeatures) break;
    const t = e.tags ?? {};
    if (e.type === 'node') { if (e.lat == null || e.lon == null) continue; const f = classifyOsm(t, 'point'); if (!f) continue; features.push({ type: 'Feature', properties: { f, name: t.name ?? '' }, geometry: { type: 'Point', coordinates: [e.lon, e.lat] } }); continue; }
    const g = e.geometry; if (!g || g.length < 2) {
      if (e.center) { const f = classifyOsm(t, 'point'); if (f && !AREA_FEATURES.has(f)) features.push({ type: 'Feature', properties: { f, name: t.name ?? '' }, geometry: { type: 'Point', coordinates: [e.center.lon, e.center.lat] } }); }
      continue;
    }
    const closed = g.length > 3 && g[0].lat === g[g.length - 1].lat && g[0].lon === g[g.length - 1].lon;
    const kind: GeomKind = closed && (t.area === 'yes' || t.building || t.natural || t.landuse || t.amenity || t.leisure || t.tourism || t.water) && !t.highway ? 'area' : 'line';
    const f = classifyOsm(t, kind); if (!f) continue;
    const coords = g.map((p) => [p.lon, p.lat]);
    if (AREA_FEATURES.has(f) && kind === 'area') {
      features.push({ type: 'Feature', properties: { f, name: t.name ?? '' }, geometry: { type: 'Polygon', coordinates: [coords] } });
      if (f === 'parking') { let sx = 0, sy = 0; for (const c of coords) { sx += c[0]; sy += c[1]; } features.push({ type: 'Feature', properties: { f, name: t.name ?? '' }, geometry: { type: 'Point', coordinates: [sx / coords.length, sy / coords.length] } }); }
    } else if (kind === 'area' && (f === 'campsite' || f === 'creekAccess' || f === 'trailEntrance')) {
      let sx = 0, sy = 0; for (const c of coords) { sx += c[0]; sy += c[1]; } features.push({ type: 'Feature', properties: { f, name: t.name ?? '' }, geometry: { type: 'Point', coordinates: [sx / coords.length, sy / coords.length] } });
    } else if (!AREA_FEATURES.has(f)) features.push({ type: 'Feature', properties: { f, name: t.name ?? '' }, geometry: { type: 'LineString', coordinates: coords } });
  }
  return { type: 'FeatureCollection', features };
}

/** Draw order: areas at the bottom, then lines (water → roads → trails → bridges), then points. */
const ORDER: FeatureId[] = ['forest', 'field', 'wetland', 'rocky', 'lake', 'pond', 'buildings', 'parking', 'contours', 'propertyBoundary', 'cliff', 'river', 'creek', 'smallStream', 'publicRoad', 'privateRoad', 'unpavedRoad', 'dirtRoad', 'offroadTrail', 'walkingPath', 'hikingTrail', 'privateTrail', 'bridge', 'hills', 'waterfall', 'campsite', 'creekAccess', 'trailEntrance', 'saved', 'customPin'];
const GEOM = (t: string) => ['==', ['geometry-type'], t];

/** MapLibre layer specs for the overlay, built from the user's feature styles. Shared by the web and native maps. */
export function overlayLayerSpecs(styles: FeatureStyles | undefined, halo: boolean, zoom: number): any[] {
  const specs: any[] = [];
  for (const id of ORDER) {
    const d = FEATURE_BY_ID[id]; const r = resolveFeature(styles, id); if (!r.visible) continue;
    if (id === 'buildings' && zoom < 15.5) continue;
    const isF = ['==', ['get', 'f'], id];
    if (d.kind === 'fill') {
      specs.push({ id: `cf-fill-${id}`, type: 'fill', source: 'cf-osm', filter: ['all', isF, GEOM('Polygon')], paint: { 'fill-color': r.color, 'fill-opacity': r.opacity } });
      if (id === 'parking') specs.push({ id: `cf-pt-${id}`, type: 'circle', source: 'cf-osm', filter: ['all', isF, GEOM('Point')], paint: { 'circle-color': r.color, 'circle-radius': 6 * r.size, 'circle-stroke-width': 2, 'circle-stroke-color': '#FFFFFF', 'circle-opacity': Math.max(0.7, r.opacity) } });
    } else if (d.kind === 'line') {
      const w = ['interpolate', ['linear'], ['zoom'], 11, Math.max(0.4, r.width * 0.35), 14, r.width, 18, r.width * 2.4];
      const wc = ['interpolate', ['linear'], ['zoom'], 11, Math.max(0.4, r.width * 0.35) + 1.2, 14, r.width + 2.6, 18, r.width * 2.4 + 4];
      if (halo) specs.push({ id: `cf-casing-${id}`, type: 'line', source: 'cf-osm', filter: ['all', isF, GEOM('LineString')], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': luminance(r.color) > 0.45 ? '#000000' : '#FFFFFF', 'line-width': wc, 'line-opacity': 0.5 * r.opacity } });
      specs.push({ id: `cf-line-${id}`, type: 'line', source: 'cf-osm', filter: ['all', isF, GEOM('LineString')], layout: { 'line-cap': r.dash ? 'butt' : 'round', 'line-join': 'round' }, paint: { 'line-color': r.color, 'line-width': w, 'line-opacity': r.opacity, ...(r.dash ? { 'line-dasharray': [3, 2] } : {}) } });
    } else if (d.kind === 'point') {
      specs.push({ id: `cf-pt-${id}`, type: 'circle', source: 'cf-osm', filter: ['all', isF, GEOM('Point')], paint: { 'circle-color': r.color, 'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 3.5 * r.size, 16, 7.5 * r.size], 'circle-stroke-width': 2, 'circle-stroke-color': '#FFFFFF', 'circle-opacity': Math.max(0.75, r.opacity) } });
    }
  }
  return specs;
}

// ------------------------------------------------------------------ fetching
export const OVERLAY_MIN_ZOOM = 13;
export const CELL = 0.02;
export interface View { bounds: [number, number, number, number]; zoom: number }
/** Snap the view to a grid so scrolling a little re-uses the same (cached) request. null = too zoomed out. */
export function overlayBox(v: View): { s: number; w: number; n: number; e: number; key: string } | null {
  if (v.zoom < OVERLAY_MIN_ZOOM) return null; const [w, s, e, n] = v.bounds; if (!(e > w) || !(n > s)) return null;
  const S = Math.floor(s / CELL) * CELL, W = Math.floor(w / CELL) * CELL, N = Math.ceil(n / CELL) * CELL, E = Math.ceil(e / CELL) * CELL;
  if ((N - S) / CELL > 4 || (E - W) / CELL > 4) return null;
  const f = (x: number) => x.toFixed(3);
  return { s: S, w: W, n: N, e: E, key: `${f(S)},${f(W)},${f(N)},${f(E)}` };
}
export function overlayQuery(b: { s: number; w: number; n: number; e: number }, zoom: number): string {
  const bb = `(${b.s},${b.w},${b.n},${b.e})`;
  return `[out:json][timeout:25];(
    way["highway"~"^(path|footway|track|bridleway|steps|pedestrian|cycleway|service|residential|unclassified|tertiary|secondary|primary|living_street)$"]${bb};
    way["waterway"~"^(river|stream|brook|canal|ditch|drain)$"]${bb}; node["waterway"="waterfall"]${bb};
    way["natural"~"^(water|wetland|wood|scrub|bare_rock|scree|cliff)$"]${bb}; way["landuse"~"^(forest|meadow|grass|farmland)$"]${bb};
    way["amenity"="parking"]["access"!~"private|no"]${bb}; ${zoom >= 15.5 ? `way["building"]${bb};` : ''}
    nwr["tourism"~"^(camp_site|caravan_site)$"]${bb}; node["highway"="trailhead"]${bb}; nwr["information"="trailhead"]${bb};
    nwr["waterway"="access_point"]${bb}; nwr["leisure"~"^(slipway|fishing)$"]${bb}; nwr["canoe"="put_in"]${bb}; nwr["whitewater"~"^(put_in|egress)$"]${bb};
    node["natural"="peak"]${bb}; way["boundary"~"^(protected_area|national_park)$"]${bb}; way["leisure"="nature_reserve"]${bb};
  );out geom tags 3000;`;
}

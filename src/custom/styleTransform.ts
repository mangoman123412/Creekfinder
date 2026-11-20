import type { MapPreset } from './schema';
import { baseLayerFeature, resolveFeature, FEATURE_BY_ID, type FeatureId } from './mapFeatures';

/**
 * Pure transformer: takes a MapLibre style JSON and a map preset and returns a style with the preset's
 * layer visibility / raster brightness / hiking overlay applied. Works with MapTiler and OpenMapTiles-schema styles
 * (OpenFreeMap). Never mutates its input.
 */
const PATH_RE = /path|trail|track|footway|steps|cycleway|bridleway|pedestrian|hiking/i;
const CONTOUR_RE = /contour/i;
const HILLSHADE_RE = /hillshade|shade|relief|terrain-rgb|hypso/i;
const WATERWAY_RE = /waterway|river|stream|canal/i;

export type LayerClass = 'label' | 'trail' | 'road' | 'waterway' | 'contour' | 'hillshade' | 'other';
export function classifyLayer(l: any): LayerClass {
  const id = String(l.id ?? ''); const sl = String(l['source-layer'] ?? '');
  if (l.type === 'hillshade' || HILLSHADE_RE.test(id)) return 'hillshade';
  if (CONTOUR_RE.test(sl) || CONTOUR_RE.test(id)) return l.type === 'symbol' ? 'label' : 'contour';
  if (l.type === 'symbol') return 'label';
  if (sl === 'waterway' || (l.type === 'line' && WATERWAY_RE.test(id) && !/ferry/i.test(id))) return 'waterway';
  if (sl === 'transportation' || sl === 'transportation_name' || /road|street|highway|motorway|tunnel|bridge|rail|ferry|aeroway/i.test(id)) {
    const f = JSON.stringify(l.filter ?? '');
    return PATH_RE.test(id) || /"(path|track|footway|pedestrian|cycleway|bridleway|steps)"/.test(f) ? 'trail' : 'road';
  }
  return 'other';
}

export function transformStyle(style: any, p: MapPreset): any {
  const out = JSON.parse(JSON.stringify(style));
  const hide = (l: any) => { l.layout = { ...(l.layout ?? {}), visibility: 'none' }; };
  const L = p.layers;
  for (const l of out.layers ?? []) {
    const c = classifyLayer(l);
    if (c === 'label' && !L.labels) hide(l);
    else if (c === 'road' && !L.roads) hide(l);
    else if (c === 'trail' && !L.trails) hide(l);
    else if (c === 'waterway' && !L.waterways) hide(l);
    else if (c === 'contour' && !L.contours) hide(l);
    else if (c === 'hillshade' && !L.hillshade) hide(l);
    if (l.type === 'raster') {
      const b = p.brightness;
      l.paint = { ...(l.paint ?? {}), 'raster-brightness-min': b > 0 ? Math.min(0.6, b * 0.8) : 0, 'raster-brightness-max': b < 0 ? Math.max(0.35, 1 + b) : 1 };
    }
  }
  recolor(out, p);
  // "contours on" for styles that have no contour layers at all is simply a no-op (the style provides none)
  if (p.show.hikingTrails) {
    out.sources = { ...(out.sources ?? {}), 'cf-hiking': { type: 'raster', tiles: ['https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png'], tileSize: 256, maxzoom: 17, attribution: 'Hiking routes © waymarkedtrails.org, OpenStreetMap contributors' } };
    out.layers = [...out.layers, { id: 'cf-hiking', type: 'raster', source: 'cf-hiking', paint: { 'raster-opacity': 0.85 } }];
  }
  return out;
}

/** Layer counts per class — used by tests and the preview legend. */
export function summarize(style: any) {
  const s: Record<string, { total: number; hidden: number }> = {};
  for (const l of style.layers ?? []) { const c = classifyLayer(l); s[c] ??= { total: 0, hidden: 0 }; s[c].total++; if (l.layout?.visibility === 'none') s[c].hidden++; }
  return s;
}

const hasOverride = (p: MapPreset, id: FeatureId) => { const r = resolveFeature(p.featureStyles, id); return r.custom || !r.visible; };

/**
 * Apply the user's per-feature colours / widths / opacity / dashes to the BASE map style's own layers
 * (roads, trails, streams, rivers, lakes, forest, contours, buildings…). Only features the user actually customised are touched.
 * Satellite imagery has no such layers — those colours are drawn by the OpenStreetMap overlay instead (see osmOverlay.ts).
 */
export function recolor(style: any, p: MapPreset) {
  if (!p.featureStyles || !Object.keys(p.featureStyles).length) return;
  for (const l of style.layers ?? []) {
    const f = baseLayerFeature(l); if (!f || !hasOverride(p, f)) continue;
    const r = resolveFeature(p.featureStyles, f); const def = FEATURE_BY_ID[f];
    l.paint = { ...(l.paint ?? {}) };
    if (!r.visible) { l.layout = { ...(l.layout ?? {}), visibility: 'none' }; continue; }
    if (l.type === 'line') {
      l.paint['line-color'] = r.color; l.paint['line-opacity'] = r.opacity;
      if (r.width !== def.width) l.paint['line-width'] = ['interpolate', ['linear'], ['zoom'], 8, Math.max(0.4, r.width * 0.35), 14, r.width, 18, r.width * 2.2];
      if (r.dash) l.paint['line-dasharray'] = [3, 2]; else delete l.paint['line-dasharray'];
    } else if (l.type === 'fill') { l.paint['fill-color'] = r.color; l.paint['fill-opacity'] = r.opacity; delete l.paint['fill-pattern']; }
    else if (l.type === 'hillshade') { l.paint['hillshade-shadow-color'] = r.color; l.paint['hillshade-exaggeration'] = Math.min(1, r.opacity * 1.6); }
    else if (l.type === 'fill-extrusion') { l.paint['fill-extrusion-color'] = r.color; l.paint['fill-extrusion-opacity'] = r.opacity; }
  }
}

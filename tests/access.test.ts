import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeAccess, accessOf, dist, nearestOnLine, type LL } from '../src/custom/accessFinder';
import { FEATURES, FEATURE_BY_ID, baseLayerFeature, classifyOsm, resolveFeature, sanitizeFeatureStyles, sanitizeSchemes, OFFICIAL_SCHEMES } from '../src/custom/mapFeatures';
import { transformStyle, summarize, recolor } from '../src/custom/styleTransform';
import { overlayBox, overlayLayerSpecs, toGeoJSON } from '../src/custom/osmOverlay';
import { OFFICIAL_MAP_PRESETS, sanitizeMapPreset, sanitizeLibrary, defaultLibrary } from '../src/custom/schema';

const way = (id: number, tags: Record<string, string>, pts: [number, number][]): any => ({ type: 'way', id, tags, geometry: pts.map(([lat, lon]) => ({ lat, lon })) });
const node = (id: number, tags: Record<string, string>, lat: number, lon: number): any => ({ type: 'node', id, lat, lon, tags });
const T: LL = { lat: 36.0052, lng: -80.9985 };
const net = () => [
  way(1, { highway: 'residential', name: 'Mill Rd' }, [[36.0, -81.01], [36.0, -81.0], [36.0, -80.995], [36.0, -80.99]]),
  way(2, { highway: 'path', name: 'Creek Trail', access: 'yes' }, [[36.0, -81.0], [36.005, -81.0], [36.005, -80.998]]),
  way(3, { highway: 'path', name: 'Private shortcut', access: 'private' }, [[36.0, -80.995], [36.0052, -80.9987]]),
  way(4, { waterway: 'stream', name: 'Test Creek' }, [[36.003, -81.003], [36.003, -80.997]]),
  way(5, { highway: 'footway', bridge: 'yes', name: 'Footbridge' }, [[36.0025, -81.0002], [36.0035, -81.0002]]),
  node(6, { highway: 'trailhead', name: 'Creek Trailhead' }, 36.0001, -81.0001),
  node(7, { amenity: 'parking', name: 'Public lot' }, 36.0004, -81.0),
  node(8, { amenity: 'parking', name: 'Residents only', access: 'private' }, 36.0003, -80.996),
  way(9, { highway: 'track', name: 'Old logging track', surface: 'dirt' }, [[36.0, -80.995], [36.002, -80.995], [36.002, -80.9985]]),
];

test('access tags: private / no / customers are blocked, public tags recognised, permit separated', () => {
  assert.equal(accessOf({ access: 'private' }), 'blocked'); assert.equal(accessOf({ access: 'no' }), 'blocked'); assert.equal(accessOf({ foot: 'no' }), 'blocked'); assert.equal(accessOf({ access: 'customers' }), 'blocked');
  assert.equal(accessOf({ access: 'yes' }), 'public'); assert.equal(accessOf({ foot: 'designated' }), 'public'); assert.equal(accessOf({}), 'unknown'); assert.equal(accessOf({ access: 'permit' }), 'permit');
});
test('geometry helpers are metre-accurate', () => {
  assert.ok(Math.abs(dist({ lat: 36, lng: -81 }, { lat: 36.001, lng: -81 }) - 110.5) < 1);
  const r = nearestOnLine({ lat: 36.001, lng: -80.9995 }, [{ lat: 36, lng: -81 }, { lat: 36, lng: -80.999 }]); assert.ok(Math.abs(r.d - 110.5) < 2);
});
test('access finder: finds entrance, parking (private excluded), road, bridge crossing, paths, and computes a real walking route', () => {
  const r = analyzeAccess(net(), T);
  assert.equal(r.nearestRoad?.name, 'Mill Rd'); assert.ok(r.nearestRoad!.straight_m > 500 && r.nearestRoad!.straight_m < 650, `${r.nearestRoad!.straight_m}`);
  assert.deepEqual(r.parking.map((p) => p.name), ['Public lot']);                     // private lot excluded
  assert.equal(r.trailheads[0].name, 'Creek Trailhead'); assert.ok(r.trailheads[0].walk_m! > 600 && r.trailheads[0].walk_m! < 1100, `${r.trailheads[0].walk_m}`);
  const b = r.bridges[0]; assert.equal(b.name, 'Footbridge'); assert.equal(b.crossesWaterway, true); assert.equal(b.waterway, 'Test Creek');
  assert.ok(r.paths.some((p) => p.name === 'Creek Trail' && p.closest_m < 60));
  assert.ok(r.routes.length >= 2); const best = r.routes[0];
  assert.ok(best.walk_m > 700 && best.walk_m < 1100, `route ${best.walk_m}`); assert.ok(best.ways.includes('Creek Trail')); assert.ok(best.coords.length >= 3);
  for (const rt of r.routes) assert.ok(!rt.ways.includes('Private shortcut'), 'must never route over a way tagged private');
  assert.equal(best.confidence === 'tagged-public' || best.confidence === 'unverified', true);
  assert.ok(r.warnings.some((w) => /private \/ no access/.test(w))); assert.equal(r.counts.blocked, 1);
  assert.ok(best.minutes >= 8 && best.minutes <= 16, `${best.minutes} min`);
});
test('routes are sorted by walking distance and each ends at the spot', () => {
  const r = analyzeAccess(net(), T); for (let i = 1; i < r.routes.length; i++) assert.ok(r.routes[i].walk_m >= r.routes[i - 1].walk_m);
  const last = r.routes[0].coords[r.routes[0].coords.length - 1]; assert.ok(dist({ lat: last[1], lng: last[0] }, T) < 300);
});
test('the private shortcut would be shorter — proves it was skipped on purpose', () => {
  const open = net().map((w) => (w.id === 3 ? { ...w, tags: { highway: 'path', name: 'Private shortcut' } } : w));
  const r = analyzeAccess(open, T); assert.ok(r.routes[0].walk_m < analyzeAccess(net(), T).routes[0].walk_m); assert.ok(r.routes.some((x) => x.ways.includes('Private shortcut')));
});
test('no walking path near the spot -> no routes, clear warning, no crash', () => {
  const r = analyzeAccess(net().filter((w) => w.id === 1), { lat: 36.02, lng: -80.9 }); assert.equal(r.routes.length, 0); assert.ok(r.warnings.length > 0);
  const empty = analyzeAccess([], T); assert.equal(empty.routes.length, 0); assert.ok(/No paths or roads/.test(empty.warnings[0]));
});

test('feature registry: 30 colourable features in 4 groups with sane defaults', () => {
  assert.ok(FEATURES.length >= 30); for (const g of ['Trails', 'Water', 'Land', 'Other']) assert.ok(FEATURES.some((f) => f.group === g));
  for (const f of FEATURES) { assert.match(f.color, /^#[0-9A-F]{6}$/); assert.ok(f.opacity > 0 && f.opacity <= 1 && f.width > 0 && f.size > 0); }
  for (const id of ['hikingTrail', 'walkingPath', 'dirtRoad', 'offroadTrail', 'privateTrail', 'unpavedRoad', 'creek', 'smallStream', 'river', 'waterfall', 'lake', 'pond', 'wetland', 'propertyBoundary', 'forest', 'field', 'rocky', 'cliff', 'contours', 'hills', 'shading', 'publicRoad', 'privateRoad', 'bridge', 'parking', 'buildings', 'campsite', 'trailEntrance', 'creekAccess', 'saved', 'customPin']) assert.ok(FEATURE_BY_ID[id as keyof typeof FEATURE_BY_ID], id);
});
test('OSM classification covers every requested feature type', () => {
  const c = (t: any, g: any = 'line') => classifyOsm(t, g);
  assert.equal(c({ highway: 'path', name: 'Ridge Trail' }), 'hikingTrail'); assert.equal(c({ highway: 'footway' }), 'walkingPath'); assert.equal(c({ highway: 'path' }), 'walkingPath');
  assert.equal(c({ highway: 'track' }), 'dirtRoad'); assert.equal(c({ highway: 'track', tracktype: 'grade5' }), 'offroadTrail'); assert.equal(c({ highway: 'track', '4wd_only': 'yes' }), 'offroadTrail');
  assert.equal(c({ highway: 'path', access: 'private' }), 'privateTrail'); assert.equal(c({ highway: 'residential', surface: 'gravel' }), 'unpavedRoad'); assert.equal(c({ highway: 'residential' }), 'publicRoad');
  assert.equal(c({ highway: 'service', access: 'private' }), 'privateRoad'); assert.equal(c({ waterway: 'stream', name: 'Mill Creek' }), 'creek'); assert.equal(c({ waterway: 'stream' }), 'smallStream');
  assert.equal(c({ waterway: 'river' }), 'river'); assert.equal(c({ waterway: 'waterfall' }, 'point'), 'waterfall'); assert.equal(c({ natural: 'water' }, 'area'), 'lake'); assert.equal(c({ natural: 'water', water: 'pond' }, 'area'), 'pond');
  assert.equal(c({ natural: 'wetland' }, 'area'), 'wetland'); assert.equal(c({ landuse: 'forest' }, 'area'), 'forest'); assert.equal(c({ landuse: 'meadow' }, 'area'), 'field'); assert.equal(c({ natural: 'bare_rock' }, 'area'), 'rocky');
  assert.equal(c({ natural: 'cliff' }), 'cliff'); assert.equal(c({ natural: 'peak' }, 'point'), 'hills'); assert.equal(c({ highway: 'footway', bridge: 'yes' }), 'bridge'); assert.equal(c({ amenity: 'parking' }, 'area'), 'parking');
  assert.equal(c({ amenity: 'parking', access: 'private' }, 'area'), null); assert.equal(c({ building: 'house' }, 'area'), 'buildings'); assert.equal(c({ tourism: 'camp_site' }, 'point'), 'campsite');
  assert.equal(c({ highway: 'trailhead' }, 'point'), 'trailEntrance'); assert.equal(c({ waterway: 'access_point' }, 'point'), 'creekAccess'); assert.equal(c({ leisure: 'slipway' }, 'point'), 'creekAccess');
  assert.equal(c({ boundary: 'protected_area' }, 'area'), 'propertyBoundary'); assert.equal(c({ highway: 'motorway' }), 'publicRoad'); assert.equal(c({ shop: 'bakery' }, 'point'), null);
});
test('feature styles: resolve defaults, sanitise hostile input, clamp ranges', () => {
  assert.equal(resolveFeature({}, 'hikingTrail').color, '#FF7A00'); assert.equal(resolveFeature({ hikingTrail: { color: '#00ff00', width: 6 } }, 'hikingTrail').custom, true); assert.equal(resolveFeature({}, 'creek').custom, false);
  const s = sanitizeFeatureStyles({ creek: { color: 'javascript:1', width: 999, opacity: -4, dash: 'yes', size: 50, evil: 1 }, river: { color: '#abc', width: 7 }, nope: { color: '#fff' } });
  assert.equal(s.creek!.color, undefined); assert.equal(s.creek!.width, 14); assert.equal(s.creek!.opacity, 0.05); assert.equal(s.creek!.dash, undefined); assert.equal(s.creek!.size, 2.5);
  assert.equal(s.river!.color, '#AABBCC'); assert.equal((s as any).nope, undefined); assert.equal((s.creek as any).evil, undefined);
  assert.ok(OFFICIAL_SCHEMES.length >= 4); assert.equal(sanitizeSchemes([{ name: '<b>x</b>', styles: { river: { color: '#123456' } } }])[0].styles.river!.color, '#123456');
});
test('map presets carry feature styles, overlay mode and halo through sanitising + libraries', () => {
  const p = sanitizeMapPreset({ ...OFFICIAL_MAP_PRESETS[0], featureStyles: { hikingTrail: { color: '#ff7a00', width: 5, dash: true } }, overlay: 'on', halo: false });
  assert.equal(p.featureStyles.hikingTrail!.color, '#FF7A00'); assert.equal(p.overlay, 'on'); assert.equal(p.halo, false); assert.equal(sanitizeMapPreset({ overlay: 'bogus' }).overlay, 'auto');
  const lib = defaultLibrary(); lib.mapPresets = [p] as any; (lib as any).colorSchemes = [{ id: 'x', name: 'Mine', styles: { creek: { color: '#0000ff' } } }];
  const back = sanitizeLibrary(JSON.parse(JSON.stringify(lib))); assert.equal(back.colorSchemes[0].styles.creek!.color, '#0000FF'); assert.equal(back.mapPresets[0].featureStyles.hikingTrail!.width, 5);
});

const styleJson = { version: 8, sources: { v: { type: 'vector' } }, layers: [
  { id: 'bg', type: 'background' }, { id: 'waterway_river', type: 'line', 'source-layer': 'waterway', filter: ['==', 'class', 'river'], paint: { 'line-color': '#00f', 'line-width': 2 } },
  { id: 'waterway_stream', type: 'line', 'source-layer': 'waterway', filter: ['==', 'class', 'stream'], paint: { 'line-color': '#08f' } }, { id: 'water', type: 'fill', 'source-layer': 'water', paint: { 'fill-color': '#44f' } },
  { id: 'road_major', type: 'line', 'source-layer': 'transportation', filter: ['==', 'class', 'primary'], paint: { 'line-color': '#fff', 'line-width': 3 } }, { id: 'road_path', type: 'line', 'source-layer': 'transportation', filter: ['==', 'class', 'path'], paint: { 'line-color': '#c80' } },
  { id: 'bridge_street', type: 'line', 'source-layer': 'transportation', filter: ['==', 'brunnel', 'bridge'] }, { id: 'landcover_wood', type: 'fill', 'source-layer': 'landcover', filter: ['==', 'class', 'wood'] },
  { id: 'building', type: 'fill', 'source-layer': 'building' }, { id: 'contour_line', type: 'line', 'source-layer': 'contour' }, { id: 'hillshade', type: 'hillshade' }, { id: 'place_label', type: 'symbol', 'source-layer': 'place', layout: { 'text-field': '{name}' } } ] };
test('base style layers map to user features', () => {
  const m = Object.fromEntries(styleJson.layers.map((l) => [l.id, baseLayerFeature(l)]));
  assert.deepEqual(m, { bg: null, waterway_river: 'river', waterway_stream: 'creek', water: 'lake', road_major: 'publicRoad', road_path: 'hikingTrail', bridge_street: 'bridge', landcover_wood: 'forest', building: 'buildings', contour_line: 'contours', hillshade: 'shading', place_label: null });
});
test('recolour applies exactly the customised features to the base style (colour, width, opacity, dash, visibility) and nothing else', () => {
  const before = JSON.stringify(styleJson); const base = sanitizeMapPreset(OFFICIAL_MAP_PRESETS[0]);
  const none = transformStyle(styleJson, base); assert.equal(none.layers.find((l: any) => l.id === 'waterway_river').paint['line-color'], '#00f');
  const p = sanitizeMapPreset({ ...base, featureStyles: { river: { color: '#112233', width: 8, opacity: 0.5 }, hikingTrail: { color: '#FF7A00', dash: true }, lake: { color: '#00FF00', opacity: 0.3 }, publicRoad: { visible: false }, buildings: { color: '#FF00FF' }, shading: { color: '#333333', opacity: 0.5 } } });
  const o = transformStyle(styleJson, p); const L = (id: string) => o.layers.find((l: any) => l.id === id);
  assert.equal(L('waterway_river').paint['line-color'], '#112233'); assert.equal(L('waterway_river').paint['line-opacity'], 0.5); assert.ok(Array.isArray(L('waterway_river').paint['line-width']));
  assert.equal(L('waterway_stream').paint['line-color'], '#08f');                      // creek untouched
  assert.equal(L('road_path').paint['line-color'], '#FF7A00'); assert.deepEqual(L('road_path').paint['line-dasharray'], [3, 2]); assert.equal(L('water').paint['fill-color'], '#00FF00'); assert.equal(L('water').paint['fill-opacity'], 0.3);
  assert.equal(L('road_major').layout.visibility, 'none'); assert.equal(L('building').paint['fill-color'], '#FF00FF'); assert.equal(L('hillshade').paint['hillshade-shadow-color'], '#333333');
  assert.equal(JSON.stringify(styleJson), before); assert.ok(summarize(o).road.hidden >= 1); void recolor;
});

test('overlay: OSM elements become classified GeoJSON; layer specs follow user colours; visibility + halo respected', () => {
  const fc = toGeoJSON([...net(), way(20, { natural: 'water', water: 'pond' }, [[36, -81], [36, -80.999], [36.001, -80.999], [36, -81]]), way(21, { amenity: 'parking' }, [[36, -81], [36, -80.9995], [36.0005, -80.9995], [36, -81]])]);
  const f = (id: string) => fc.features.filter((x) => x.properties.f === id); assert.ok(f('publicRoad').length >= 1 && f('hikingTrail').length === 1 && f('privateTrail').length === 1 && f('bridge').length === 1 && f('smallStream').length + f('creek').length === 1);
  assert.equal(f('pond')[0].geometry.type, 'Polygon'); assert.ok(f('parking').some((x) => x.geometry.type === 'Polygon') && f('parking').some((x) => x.geometry.type === 'Point')); assert.equal(f('trailEntrance')[0].geometry.type, 'Point');
  const specs = overlayLayerSpecs({ hikingTrail: { color: '#FF00AA', width: 6, dash: true, opacity: 0.8 }, creek: { visible: false } }, true, 14);
  const hl = specs.find((s) => s.id === 'cf-line-hikingTrail'); assert.equal(hl.paint['line-color'], '#FF00AA'); assert.equal(hl.paint['line-opacity'], 0.8); assert.deepEqual(hl.paint['line-dasharray'], [3, 2]); assert.ok(specs.some((s) => s.id === 'cf-casing-hikingTrail'));
  assert.ok(!specs.some((s) => /-creek$/.test(s.id))); assert.ok(!overlayLayerSpecs({}, false, 14).some((s) => s.id.startsWith('cf-casing')));
  assert.ok(!overlayLayerSpecs({}, true, 13).some((s) => s.id === 'cf-fill-buildings')); assert.ok(overlayLayerSpecs({}, true, 16).some((s) => s.id === 'cf-fill-buildings'));
  const ids = specs.map((s) => s.id); assert.ok(ids.indexOf('cf-fill-forest') < ids.indexOf('cf-line-hikingTrail') && ids.indexOf('cf-line-hikingTrail') < ids.indexOf('cf-pt-saved'));
});
test('overlay box: grid snapping, zoom gate, size cap', () => {
  assert.equal(overlayBox({ bounds: [-81.7, 36.2, -81.69, 36.21], zoom: 11 }), null);
  const a = overlayBox({ bounds: [-81.7, 36.2, -81.69, 36.21], zoom: 14 })!; const b = overlayBox({ bounds: [-81.699, 36.201, -81.691, 36.209], zoom: 14 })!; assert.equal(a.key, b.key);
  assert.equal(overlayBox({ bounds: [-82, 36, -81, 37], zoom: 14 }), null);
});

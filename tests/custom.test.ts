import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, OFFICIAL_MAP_PRESETS, DETAIL_IDS, NAV_IDS, TRACK_IDS, WIDGET_TYPES, defaultLibrary, officialProfiles, sanitize, sanitizeLibrary, sanitizeMapPreset, sanitizeWidgets, sanitizeTheme, THEME_PRESETS } from '../src/custom/schema';
import { contrastRatio, ensureContrast, hsvToHex, isHex, mix, normHex, onColor, rgbToHsv, toRgb } from '../src/custom/colorUtils';
import { buildPalette, paletteFor, resolveSeeds } from '../src/custom/themeEngine';
import { checksum, decodeShare, encodeShare } from '../src/custom/share';
import { classifyLayer, summarize, transformStyle } from '../src/custom/styleTransform';
import { markerPixels } from '../src/custom/markerImage';
import { isQuietNow, deliveryMode } from '../src/custom/quiet';
import { arrayMove } from '../src/custom/arrays';
import { flattenFolders, descendantIds, sortPlaces, filterPlaces, folderPath } from '../src/custom/organize';
import * as store from '../src/custom/store';
import { officialDesigns } from '../src/custom/officialDesigns';

test('colour utils: hex parsing, mixing, contrast, hsv round trip', () => {
  assert.equal(normHex('abc'), '#AABBCC'); assert.equal(normHex('#1f5a43'), '#1F5A43'); assert.equal(normHex('zzz', '#000000'), '#000000');
  assert.ok(isHex('#12ab34')); assert.ok(!isHex('#12ab3'));
  assert.equal(mix('#000000', '#FFFFFF', 0.5), '#808080');
  assert.ok(contrastRatio('#000000', '#FFFFFF') > 20); assert.equal(onColor('#FFFFFF'), '#0B0F0D'); assert.equal(onColor('#000000'), '#FFFFFF');
  const c = ensureContrast('#888888', '#999999', 4.5); assert.ok(contrastRatio(c, '#999999') >= 4.5);
  const [h, s, v] = rgbToHsv(toRgb('#1B8FD0')); assert.equal(hsvToHex(h, s, v), '#1B8FD0');
});

test('every theme preset builds a readable palette in light and dark', () => {
  for (const p of THEME_PRESETS) for (const mode of ['light', 'dark'] as const) {
    const { palette } = paletteFor({ presetId: p.id, mode, overrides: {} }, false);
    assert.ok(contrastRatio(palette.ink, palette.bg) >= 7, `${p.id}/${mode} text on bg`);
    assert.ok(contrastRatio(palette.ink, palette.surface) >= 7, `${p.id}/${mode} text on card`);
    assert.ok(contrastRatio(palette.onPrimary, palette.primary) >= 4.5, `${p.id}/${mode} onPrimary`);
    assert.ok(contrastRatio(palette.onButton, palette.button) >= 4.5, `${p.id}/${mode} onButton`);
  }
});
test('midnight is always dark; system mode follows the OS; overrides apply', () => {
  assert.equal(resolveSeeds({ presetId: 'midnight', mode: 'light', overrides: {} }, false).dark, true);
  assert.equal(resolveSeeds({ presetId: 'forest', mode: 'system', overrides: {} }, true).dark, true);
  assert.equal(resolveSeeds({ presetId: 'forest', mode: 'system', overrides: {} }, false).dark, false);
  assert.equal(resolveSeeds({ presetId: 'forest', mode: 'light', overrides: { primary: '#FF0000' } }, false).seeds.primary, '#FF0000');
  const pal = buildPalette({ ...resolveSeeds({ presetId: 'forest', mode: 'light', overrides: { markerSaved: '#123456' } }, false).seeds }, false);
  assert.equal(pal.markerSaved, '#123456');
});
test('high contrast guarantees AAA text and strong colours even for ugly custom colours', () => {
  const { palette } = paletteFor({ presetId: 'custom', mode: 'light', overrides: { primary: '#FFFF99', text: '#CCCCCC', background: '#EEEEEE' } }, false, true);
  assert.ok(contrastRatio(palette.ink, palette.bg) >= 15); assert.ok(contrastRatio(palette.primary, palette.bg) >= 7);
});

test('sanitize: defaults are stable and valid', () => {
  const d = DEFAULTS(); assert.deepEqual(sanitize(d), d); assert.deepEqual(sanitize(undefined), d); assert.deepEqual(sanitize('junk'), d);
});
test('sanitize: rejects/cleans hostile or malformed input (no code, no unknown keys)', () => {
  const bad: any = { theme: { presetId: '<script>alert(1)</script>', mode: 'purple', overrides: { primary: 'javascript:alert(1)', accent: '#ff0000', evil: '#000' } }, display: { textScale: 99, font: 'comic', cornerz: 1 }, __proto__: { polluted: true },
    home: { widgets: [{ type: 'explore_map', size: 'huge', bg: 'url(x)', visible: 'yes' }, { type: 'steal_data' }, { type: 'shortcuts', shortcuts: ['map', 5, '<img onerror=1>'] }] }, mapPresetId: 'x'.repeat(500), notifications: { quiet: { from: '25:99' } } };
  const s: any = sanitize(bad);
  assert.equal(s.theme.presetId, 'forest'); assert.equal(s.theme.mode, 'system'); assert.deepEqual(s.theme.overrides, { accent: '#FF0000' });
  assert.equal(s.display.textScale, 1.6); assert.equal(s.display.font, 'inter'); assert.equal(s.display.cornerz, undefined);
  assert.ok(!s.home.widgets.some((w: any) => w.type === 'steal_data')); assert.equal(s.home.widgets.find((w: any) => w.type === 'explore_map').bg, 'default');
  assert.ok(s.mapPresetId.length <= 40); assert.equal(s.notifications.quiet.from, '22:00'); assert.equal(({} as any).polluted, undefined);
  const sc = s.home.widgets.find((w: any) => w.type === 'shortcuts'); assert.ok(sc.shortcuts.every((x: string) => typeof x === 'string'));
});
test('sanitize: lists keep user order, drop unknown ids, and append new options (extensibility)', () => {
  const s = sanitize({ detail: { sections: [{ id: 'weather', visible: true }, { id: 'nope', visible: true }, { id: 'gallery', visible: false }] } });
  assert.equal(s.detail.sections[0].id, 'weather'); assert.equal(s.detail.sections[1].id, 'gallery'); assert.equal(s.detail.sections[1].visible, false);
  assert.equal(s.detail.sections.length, DETAIL_IDS.length);
  assert.equal(sanitize({ tracking: { stats: [{ id: 'time', visible: true }] } }).tracking.stats.length, TRACK_IDS.length);
  assert.equal(sanitize({ home: { widgets: [] } }).home.widgets.length, WIDGET_TYPES.length);
});
test('navigation: profile is always visible and at least 3 tabs stay', () => {
  const s = sanitize({ nav: { items: NAV_IDS.map((id) => ({ id, visible: false })) } });
  assert.ok(s.nav.items.find((i) => i.id === 'profile')!.visible); assert.ok(s.nav.items.filter((i) => i.visible).length >= 3);
  const lab = sanitize({ nav: { items: [{ id: 'home', visible: true, label: 'Base camp 12345678901234567890', icon: 'not-allowed-icon' }] } }).nav.items[0];
  assert.ok((lab.label ?? '').length <= 14); assert.equal(lab.icon, undefined);
});
test('official map presets and profiles are valid and distinct', () => {
  assert.ok(OFFICIAL_MAP_PRESETS.length >= 6); for (const p of OFFICIAL_MAP_PRESETS) assert.deepEqual(sanitizeMapPreset(p, p.id), { ...p, official: true });
  const ps = officialProfiles(); assert.deepEqual(ps.map((p) => p.name), ['Explorer', 'Fishing', 'Hiking', 'Minimal']);
  assert.equal(ps[1].settings.mapPresetId, 'map-fishing'); assert.equal(ps[2].settings.mapPresetId, 'map-hiking'); assert.equal(ps[3].settings.detail.layout, 'compact');
  assert.equal(ps[3].settings.nav.items.filter((i) => i.visible).length, 4);
  for (const p of ps) assert.deepEqual(sanitize(p.settings), p.settings);
});

test('share codes round-trip every kind and detect tampering', () => {
  const s = DEFAULTS();
  for (const [kind, payload] of [['theme', { spec: s.theme }], ['layout', { widgets: s.home.widgets }], ['profile', { icon: 'fish', settings: s }], ['mappreset', { preset: OFFICIAL_MAP_PRESETS[1] }], ['library', { library: defaultLibrary() }]] as const) {
    const code = encodeShare(kind as any, 'Test ✓ name', payload); assert.ok(code.startsWith('CF1:'));
    const d = decodeShare(code); assert.equal(d.ok, true, kind); if (d.ok) assert.equal(d.kind, kind);
  }
  const code = encodeShare('theme', 'T', { spec: { presetId: 'ocean', mode: 'dark', overrides: { primary: '#112233' } } });
  const d = decodeShare(code); assert.ok(d.ok && d.kind === 'theme' && d.spec.presetId === 'ocean' && d.spec.overrides.primary === '#112233');
  assert.equal(decodeShare(code.slice(0, -6)).ok, false);                                 // truncated
  assert.equal(decodeShare('hello').ok, false); assert.equal(decodeShare('CF1:@@@').ok, false);
  const tampered = 'CF1:' + btoa(unescape(encodeURIComponent(JSON.stringify({ v: 3, kind: 'theme', name: 'T', payload: { spec: { presetId: 'forest', mode: 'dark', overrides: { primary: '#000000' } } }, sum: 'deadbeef' }))));
  const t = decodeShare(tampered); assert.ok(!t.ok && /checksum/.test(t.error));
  assert.equal(checksum('a') === checksum('b'), false);
});
test('hostile imported payloads are sanitised, never executed', () => {
  const evil = { v: 3, kind: 'profile', name: '<b>x</b>', payload: { icon: 'x', settings: { theme: { overrides: { primary: 'red; background:url(javascript:1)' } }, home: { widgets: [{ type: 'rm_rf' }] } } } };
  const body = JSON.stringify(evil.payload); const sum = checksum(`profile|${evil.name}|${body}`);
  const code = 'CF1:' + btoa(unescape(encodeURIComponent(JSON.stringify({ ...evil, sum }))));
  const d = decodeShare(code); assert.ok(d.ok && d.kind === 'profile');
  if (d.ok && d.kind === 'profile') { assert.deepEqual(d.settings.theme.overrides, {}); assert.ok(!d.name.includes('<')); assert.ok(!d.settings.home.widgets.some((w) => (w as any).type === 'rm_rf')); }
});

const style = { version: 8, sources: { sat: { type: 'raster' }, v: { type: 'vector' } }, layers: [
  { id: 'background', type: 'background' }, { id: 'sat', type: 'raster', source: 'sat' }, { id: 'water', type: 'fill', 'source-layer': 'water' },
  { id: 'waterway_river', type: 'line', 'source-layer': 'waterway' }, { id: 'road_major', type: 'line', 'source-layer': 'transportation', filter: ['==', 'class', 'primary'] },
  { id: 'road_path', type: 'line', 'source-layer': 'transportation', filter: ['==', 'class', 'path'] }, { id: 'contour_line', type: 'line', 'source-layer': 'contour' }, { id: 'hillshade_shade', type: 'hillshade' },
  { id: 'place_label', type: 'symbol', 'source-layer': 'place', layout: { 'text-field': '{name}' } }, { id: 'contour_label', type: 'symbol', 'source-layer': 'contour', layout: { 'text-field': '{ele}' } } ] };
test('map style transformer hides exactly the chosen layer classes and never mutates the input', () => {
  const before = JSON.stringify(style);
  const base = OFFICIAL_MAP_PRESETS[0];
  const all = sanitizeMapPreset({ ...base, layers: { labels: true, roads: true, trails: true, waterways: true, contours: true, hillshade: true } });
  const s0 = summarize(transformStyle(style, all)); for (const k of Object.keys(s0)) assert.equal(s0[k].hidden, 0, k);
  const off = (k: string) => summarize(transformStyle(style, sanitizeMapPreset({ ...all, layers: { ...all.layers, [k]: false } })));
  assert.equal(off('labels').label.hidden, 2); assert.equal(off('roads').road.hidden, 1); assert.equal(off('trails').trail.hidden, 1); assert.equal(off('waterways').waterway.hidden, 1);
  assert.equal(off('contours').contour.hidden, 1); assert.equal(off('hillshade').hillshade.hidden, 1);
  assert.equal(off('roads').trail.hidden, 0); assert.equal(off('labels').road.hidden, 0);   // only that class is touched
  assert.equal(JSON.stringify(style), before);
  const bright = transformStyle(style, sanitizeMapPreset({ ...all, brightness: -0.4 })); assert.equal((bright.layers.find((l: any) => l.id === 'sat').paint)['raster-brightness-max'], 0.6);
  const hik = transformStyle(style, sanitizeMapPreset({ ...all, show: { ...all.show, hikingTrails: true } })); assert.ok(hik.sources['cf-hiking'] && hik.layers.at(-1).id === 'cf-hiking');
  assert.equal(classifyLayer({ id: 'x', type: 'circle' }), 'other');
});
test('marker images: every shape renders distinct, colour-correct, anti-aliased pixels', () => {
  const shapes = ['circle', 'square', 'diamond', 'triangle', 'star', 'ring'] as const; const seen = new Set<string>();
  for (const sh of shapes) {
    const { width, height, data } = markerPixels(sh, '#FF0000', 48); assert.equal(data.length, width * height * 4);
    let opaque = 0, red = 0, partial = 0; for (let i = 0; i < data.length; i += 4) { if (data[i + 3] > 250) opaque++; if (data[i + 3] > 0 && data[i + 3] < 250) partial++; if (data[i + 3] > 250 && data[i] > 240 && data[i + 1] < 20) red++; }
    assert.ok(opaque > 100 && red > 20 && partial > 10, sh); seen.add(`${opaque}`);
  }
  assert.equal(seen.size, shapes.length);                         // each shape covers a different area
  const ring = markerPixels('ring', '#00FF00', 48); const mid = (24 * 48 + 24) * 4; assert.equal(ring.data[mid + 3], 0);   // ring is hollow
  const circle = markerPixels('circle', '#00FF00', 48); assert.equal(circle.data[mid + 1], 255);
});

test('quiet hours: same-day and overnight windows, day selection, flood override', () => {
  const q = { enabled: true, from: '22:00', to: '07:00', days: [true, true, true, true, true, true, true], allowFloodDuringQuiet: true };
  const at = (d: string) => new Date(d);
  assert.equal(isQuietNow(q, at('2026-11-18T23:30:00')), true); assert.equal(isQuietNow(q, at('2026-11-19T03:00:00')), true);
  assert.equal(isQuietNow(q, at('2026-11-19T12:00:00')), false); assert.equal(isQuietNow({ ...q, enabled: false }, at('2026-11-18T23:30:00')), false);
  const daytime = { ...q, from: '09:00', to: '17:00' }; assert.equal(isQuietNow(daytime, at('2026-11-18T10:00:00')), true); assert.equal(isQuietNow(daytime, at('2026-11-18T18:00:00')), false);
  const noWed = { ...q, days: [true, true, true, false, true, true, true] };           // 2026-11-18 is a Wednesday
  assert.equal(isQuietNow(noWed, at('2026-11-18T23:30:00')), false); assert.equal(isQuietNow(noWed, at('2026-11-19T03:00:00')), false); assert.equal(isQuietNow(noWed, at('2026-11-19T23:30:00')), true);
  const n: any = { ...DEFAULTS().notifications, quiet: q };
  assert.equal(deliveryMode(n, 'flood', true, at('2026-11-18T23:30:00')), 'system'); assert.equal(deliveryMode(n, 'weather', true, at('2026-11-18T23:30:00')), 'inbox');
  assert.equal(deliveryMode(n, 'nearby', false, at('2026-11-18T23:30:00')), 'inbox'); assert.equal(deliveryMode(n, 'nearby', false, at('2026-11-19T12:00:00')), 'system');
  assert.equal(deliveryMode({ ...n, deliver: 'inbox' }, 'flood', true, at('2026-11-19T12:00:00')), 'inbox');
});

test('arrayMove', () => { assert.deepEqual(arrayMove([1, 2, 3, 4], 0, 2), [2, 3, 1, 4]); assert.deepEqual(arrayMove([1, 2, 3], 2, 0), [3, 1, 2]); assert.deepEqual(arrayMove([1, 2], 5, 0), [1, 2]); });

const F = (id: string, name: string, parent: string | null = null, sort = 0): any => ({ id, name, parent_id: parent, sort, private: 0, icon: 'folder', color: null, system_key: null, user_id: null });
const P = (id: string, name: string, o: any = {}): any => ({ id, name, kind: 'creek', lat: 36, lng: -81, altitude_m: null, rating: null, favorite: 0, tags: null, folder_id: null, notes: null, description: null, created_at: '2026-01-01T00:00:00Z', ...o });
test('folders: nesting, descendants, path, cycles are survivable', () => {
  const fs = [F('a', 'A'), F('b', 'B', 'a'), F('c', 'C', 'b'), F('d', 'D')];
  assert.deepEqual(flattenFolders(fs).map((n) => `${n.depth}${n.folder.id}`), ['0a', '1b', '2c', '0d']);
  assert.deepEqual(descendantIds(fs, 'a').sort(), ['a', 'b', 'c']); assert.equal(folderPath(fs, 'c'), 'A › B › C');
  assert.equal(flattenFolders([F('x', 'X', 'y'), F('y', 'Y', 'x')]).length, 0);       // a cycle never loops forever
});
test('sorting: date / name / distance / rating / elevation, missing last, favorites first', () => {
  const ps = [P('1', 'Beta', { created_at: '2026-02-01T00:00:00Z', rating: 3, altitude_m: 500, lat: 36.1 }), P('2', 'alpha', { created_at: '2026-03-01T00:00:00Z', rating: 5, altitude_m: 100, lat: 36.5, favorite: 1 }), P('3', 'Gamma', { created_at: '2026-01-15T00:00:00Z', lat: 36.01 })];
  const ids = (o: any) => sortPlaces(ps, o).map((p) => p.id).join('');
  assert.equal(ids({ sort: 'date', dir: 'desc' }), '213'); assert.equal(ids({ sort: 'date', dir: 'asc' }), '312'); assert.equal(ids({ sort: 'name', dir: 'asc' }), '213');
  assert.equal(ids({ sort: 'rating', dir: 'desc' }), '213'); assert.equal(ids({ sort: 'rating', dir: 'asc' }), '123'); assert.equal(ids({ sort: 'elevation', dir: 'asc' }), '213'); assert.equal(ids({ sort: 'elevation', dir: 'desc' }), '123');
  assert.equal(ids({ sort: 'distance', dir: 'asc', me: { lat: 36, lng: -81 } }), '312'); assert.equal(ids({ sort: 'date', dir: 'asc', favoritesFirst: true }), '231');
});
test('filtering: folder tree, tags, favorites, kind, search', () => {
  const ps = [P('1', 'Mossy Falls', { folder_id: 'b', tags: '["shady","kids"]', favorite: 1 }), P('2', 'Open Run', { folder_id: 'd', kind: 'river' }), P('3', 'Loose', {})];
  const tags = (p: any) => (p.tags ? JSON.parse(p.tags) : []); const f = (o: any) => filterPlaces(ps, o, tags).map((p) => p.id).join('');
  assert.equal(f({ folderIds: ['a', 'b'] }), '1'); assert.equal(f({ folderIds: 'none' }), '3'); assert.equal(f({ tag: 'kids' }), '1'); assert.equal(f({ favoritesOnly: true }), '1'); assert.equal(f({ kind: 'river' }), '2'); assert.equal(f({ search: 'SHADY' }), '1'); assert.equal(f({}), '123');
});

test('store: edits go to the active profile; profiles, themes, presets, reset', () => {
  store._resetForTests();
  const base = store.getSettings(); assert.equal(base.display.textScale, 1);
  store.mutate((s) => { s.display.textScale = 1.3; s.theme.presetId = 'ocean'; }); assert.equal(store.getSettings().display.textScale, 1.3); assert.equal(store.getSettings().theme.presetId, 'ocean');
  store.mutate((s) => { s.display.textScale = 50; }); assert.equal(store.getSettings().display.textScale, 1.6);          // clamped
  const first = store.getLibrary().activeProfileId; store.switchProfile('profile-fishing'); assert.equal(store.getSettings().mapPresetId, 'map-fishing');
  store.mutate((s) => { s.display.textScale = 0.9; }); store.switchProfile(first); assert.equal(store.getSettings().display.textScale, 1.6); store.switchProfile('profile-fishing'); assert.equal(store.getSettings().display.textScale, 0.9);   // profiles are independent
  const id = store.createProfile('Kayaking', 'boat'); assert.equal(store.getLibrary().activeProfileId, id); assert.equal(store.getSettings().display.textScale, 0.9);
  assert.equal(store.deleteProfile(id), true); assert.notEqual(store.getLibrary().activeProfileId, id);
  const tid = store.saveTheme('Mine', { presetId: 'sunset', mode: 'dark', overrides: { primary: '#abcdef' } }); assert.equal(store.getLibrary().themes[0].spec.overrides.primary, '#ABCDEF'); store.deleteTheme(tid); assert.equal(store.getLibrary().themes.length, 0);
  store.resetSection('display'); assert.equal(store.getSettings().display.textScale, 1);
  store.mutate((s) => { s.home.widgets = s.home.widgets.slice().reverse(); }); store.resetAll(); assert.deepEqual(store.getSettings(), DEFAULTS());
});
test('store: built-in map presets are never modified — first edit forks a personal copy', () => {
  store._resetForTests();
  const before = JSON.stringify(OFFICIAL_MAP_PRESETS[0]);
  store.updateActiveMapPreset((p) => { p.markers.size = 1.5; p.layers.labels = false; });
  const cur = store.getMapPreset(); assert.equal(cur.official, undefined); assert.equal(cur.markers.size, 1.5); assert.equal(cur.layers.labels, false); assert.match(cur.name, /\(mine\)/);
  assert.equal(JSON.stringify(OFFICIAL_MAP_PRESETS[0]), before);
  const id = cur.id; store.updateActiveMapPreset((p) => { p.brightness = 0.2; }); assert.equal(store.getMapPreset().id, id);   // second edit updates the same copy
  store.deleteMapPreset(id); assert.equal(store.getSettings().mapPresetId, 'map-default');
});
test('store: notifies subscribers and persists through the hook', async () => {
  store._resetForTests(); let n = 0; const off = store.subscribe(() => n++); let saved: any = null; store.setPersistHook((l) => { saved = l; });
  store.mutate((s) => { s.nav.style = 'compact'; }); assert.equal(n, 1); await new Promise((r) => setTimeout(r, 400)); assert.equal(saved.profiles.find((p: any) => p.id === saved.activeProfileId).settings.nav.style, 'compact'); off();
  const lib = sanitizeLibrary(JSON.parse(JSON.stringify(saved))); assert.equal(lib.profiles.length, saved.profiles.length);
});
test('marketplace: official designs exist for every kind and are valid', () => {
  assert.ok(officialDesigns('theme').length >= 6); assert.ok(officialDesigns('layout').length >= 4); assert.equal(officialDesigns('profile').length, 4); assert.ok(officialDesigns('mappreset').length >= 6);
  for (const d of officialDesigns('layout')) { assert.deepEqual(sanitizeWidgets(d.widgets), d.widgets); assert.ok(d.widgets!.filter((w) => w.visible).length >= 3); }
  for (const d of officialDesigns('theme')) assert.deepEqual(sanitizeTheme(d.spec), d.spec);
});

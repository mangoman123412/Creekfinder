import test from 'node:test';
import assert from 'node:assert/strict';
import { classify, isTree, looksLikeWater, nearestTown, waterPhotosNear, type El, type GuidePhoto } from '../src/lib/guidePure';
import { describeWeather } from '../src/lib/weatherPure';

const C = { lat: 36.2, lng: -81.6 };
const el = (id: number, dLat: number, tags: Record<string, string>, type = 'node'): El => ({ type, id, lat: C.lat + dLat, lon: C.lng, tags });

test('classify sorts features into guide sections by distance', () => {
  const s = classify([
    el(1, 0.005, { waterway: 'waterfall', name: 'Upper Falls' }),
    el(2, 0.001, { waterway: 'waterfall' }),
    el(3, 0.002, { amenity: 'parking', name: 'Trailhead lot' }),
    el(4, 0.003, { amenity: 'parking', access: 'private' }),
    el(5, 0.004, { tourism: 'camp_site', name: 'Pine Camp' }),
    el(6, 0.004, { tourism: 'camp_site', name: 'Members Camp', access: 'private' }),
    el(7, 0.001, { highway: 'residential', name: 'Mill Road' }),
    el(8, 0.002, { highway: 'path', name: 'Creek Trail' }),
    el(9, 0.002, { man_made: 'bridge' }),
    el(10, 0.006, { natural: 'cliff' }),
    el(11, 0.003, { leisure: 'swimming_area', name: 'Swim hole' }),
  ], C);
  assert.deepEqual(s.waterfalls.map((f) => f.name), ['Waterfall', 'Upper Falls']);
  assert.equal(s.parking.length, 1);                      // private lot excluded
  assert.equal(s.parking[0].name, 'Trailhead lot');
  assert.deepEqual(s.camping.map((f) => f.name), ['Pine Camp']); // private campground excluded
  assert.equal(s.roads[0].name, 'Mill Road');
  assert.equal(s.trails[0].name, 'Creek Trail');
  assert.equal(s.bridges[0].name, 'Bridge');
  assert.equal(s.rocks[0].name, 'Cliff');
  assert.equal(s.swimming[0].name, 'Swim hole');
  assert.ok(s.waterfalls[0].distance_m < s.waterfalls[1].distance_m);
});

test('classify returns empty lists, never invented data', () => {
  const s = classify([], C);
  for (const k of Object.keys(s) as (keyof typeof s)[]) assert.deepEqual(s[k], []);
});

const photo = (id: string, title: string, dLat: number): GuidePhoto => ({ id, url: 'u', full: 'u', title, credit: 'x', license: 'CC', pageUrl: 'p', lat: C.lat + dLat, lng: C.lng });
test('waterPhotosNear keeps only water photos, nearest first, name matches first', () => {
  const photos = [photo('a', 'Church steeple', 0.001), photo('b', 'Linville Falls overlook', 0.01), photo('c', 'Mill Creek riffles', 0.002), photo('d', 'Mill Creek at dusk', 0.03)];
  const r = waterPhotosNear(photos, C, 'Mill Creek', 3).map((p) => p.id);
  assert.ok(!r.includes('a'));
  assert.equal(r[0], 'c');
  assert.ok(r.includes('d'));       // far, but title matches the creek's name
  assert.ok(looksLikeWater('Beautiful waterfall in autumn'));
  assert.ok(!looksLikeWater('Town hall'));
});

test('tree detection', () => {
  assert.ok(isTree('Red Maple'));
  assert.ok(isTree('Eastern Hemlock'));
  assert.ok(!isTree('Cardinal Flower'));
});

test('nearestTown', () => {
  const t = nearestTown([{ name: 'A', lat: 36.3, lng: -81.6 }, { name: 'B', lat: 36.21, lng: -81.6 }], C);
  assert.equal(t?.name, 'B');
  assert.equal(nearestTown([], C), null);
});

test('describeWeather maps WMO codes', () => {
  assert.deepEqual(describeWeather(0, true), { label: 'Clear', icon: 'sunny' });
  assert.equal(describeWeather(0, false).icon, 'moon');
  assert.equal(describeWeather(63, true).label, 'Rain');
  assert.equal(describeWeather(95, true).icon, 'thunderstorm');
  assert.equal(describeWeather(73, true).icon, 'snow');
});

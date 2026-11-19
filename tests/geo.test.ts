import test from 'node:test';
import assert from 'node:assert/strict';
import { haversine, bearing, boundsAround, estimateTileCount, elevationGain, formatDistance, formatDuration, toGPX, nearestIndex, pathLength, compassLabel, formatDMS } from '../src/lib/geo';

test('haversine: 1 degree of latitude ≈ 111.2 km', () => {
  const d = haversine({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
  assert.ok(Math.abs(d - 111195) < 200, String(d));
});
test('haversine: NYC -> LA ≈ 3936 km', () => {
  const d = haversine({ lat: 40.7128, lng: -74.006 }, { lat: 34.0522, lng: -118.2437 });
  assert.ok(Math.abs(d / 1000 - 3936) < 15, String(d / 1000));
});
test('bearing cardinal directions', () => {
  const o = { lat: 10, lng: 10 };
  assert.ok(Math.abs(bearing(o, { lat: 11, lng: 10 }) - 0) < 0.01);
  assert.ok(Math.abs(bearing(o, { lat: 10, lng: 11 }) - 90) < 0.6);
  assert.ok(Math.abs(bearing(o, { lat: 9, lng: 10 }) - 180) < 0.01);
  assert.ok(Math.abs(bearing(o, { lat: 10, lng: 9 }) - 270) < 0.6);
  assert.equal(compassLabel(92), 'E');
});
test('boundsAround contains centre and is ~radius wide', () => {
  const c = { lat: 36, lng: -80 };
  const [w, s, e, n] = boundsAround(c, 5000);
  assert.ok(w < c.lng && e > c.lng && s < c.lat && n > c.lat);
  assert.ok(Math.abs(haversine({ lat: c.lat, lng: w }, c) - 5000) < 20);
  assert.ok(Math.abs(haversine({ lat: s, lng: c.lng }, c) - 5000) < 20);
});
test('estimateTileCount grows with zoom and area', () => {
  const b = boundsAround({ lat: 36, lng: -80 }, 8000);
  const a = estimateTileCount(b, 5, 12);
  const c = estimateTileCount(b, 5, 14);
  assert.ok(c > a && a > 0);
  assert.equal(estimateTileCount([-1, -1, 1, 1], 0, 0), 1);
});
test('elevationGain ignores noise under threshold', () => {
  assert.equal(elevationGain([100, 101, 100, 101, 100]), 0);
  assert.equal(elevationGain([100, 110, 120, 115, 130]), 35);
  assert.equal(elevationGain([null, 100, null, 110]), 10);
});
test('format helpers', () => {
  assert.equal(formatDuration(65), '1:05');
  assert.equal(formatDuration(3725), '1:02:05');
  assert.equal(formatDistance(1609.344, true), '1.0 mi');
  assert.equal(formatDistance(1500, false), '1.5 km');
  assert.equal(formatDistance(250, false), '250 m');
  assert.match(formatDMS(36.5, -80.25), /36°30'0\.0"N 80°15'0\.0"W/);
});
test('path helpers', () => {
  const pts = [{ lat: 0, lng: 0 }, { lat: 0, lng: 0.001 }, { lat: 0, lng: 0.002 }];
  assert.ok(Math.abs(pathLength(pts) - 222.4) < 1);
  assert.equal(nearestIndex(pts, { lat: 0, lng: 0.0019 }), 2);
});
test('toGPX escapes and includes points', () => {
  const g = toGPX('A & B <creek>', [{ lat: 1, lng: 2, alt: 3, ts: 0 }]);
  assert.ok(g.includes('A &amp; B &lt;creek&gt;'));
  assert.ok(g.includes('<trkpt lat="1" lon="2"><ele>3.0</ele><time>1970-01-01T00:00:00.000Z</time>'));
});

export interface LL { lat: number; lng: number }

const R = 6371008.8;
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Great-circle distance in metres. */
export function haversine(a: LL, b: LL): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Initial bearing from a to b in degrees 0..360 (0 = north). */
export function bearing(a: LL, b: LL): number {
  const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng));
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

export function compassLabel(b: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(b / 45) % 8];
}

export function formatDistance(m: number, imperial = true): string {
  if (!isFinite(m)) return '–';
  if (imperial) {
    const ft = m * 3.28084;
    if (ft < 1000) return `${Math.round(ft / 10) * 10 || Math.round(ft)} ft`;
    const mi = m / 1609.344;
    return `${mi < 10 ? mi.toFixed(1) : Math.round(mi)} mi`;
  }
  if (m < 1000) return `${Math.round(m)} m`;
  const km = m / 1000;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

export function formatDuration(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const p = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${p(m)}:${p(sec)}` : `${m}:${p(sec)}`;
}

export function formatCoords(lat: number, lng: number, digits = 5): string {
  return `${lat.toFixed(digits)}, ${lng.toFixed(digits)}`;
}

/** Degrees-minutes-seconds style, useful to read out over a radio/phone. */
export function formatDMS(lat: number, lng: number): string {
  const f = (v: number, pos: string, neg: string) => {
    const a = Math.abs(v);
    const d = Math.floor(a);
    const m = Math.floor((a - d) * 60);
    const s = ((a - d - m / 60) * 3600).toFixed(1);
    return `${d}°${m}'${s}"${v >= 0 ? pos : neg}`;
  };
  return `${f(lat, 'N', 'S')} ${f(lng, 'E', 'W')}`;
}

export function boundsAround(c: LL, radiusM: number): [number, number, number, number] {
  const dLat = deg(radiusM / R);
  const dLng = deg(radiusM / (R * Math.cos(rad(c.lat))));
  return [c.lng - dLng, c.lat - dLat, c.lng + dLng, c.lat + dLat]; // west, south, east, north
}

export function boundsOfPoints(pts: LL[]): [number, number, number, number] | null {
  if (!pts.length) return null;
  let w = 180, s = 90, e = -180, n = -90;
  for (const p of pts) {
    w = Math.min(w, p.lng); e = Math.max(e, p.lng);
    s = Math.min(s, p.lat); n = Math.max(n, p.lat);
  }
  return [w, s, e, n];
}

export function pathLength(pts: LL[]): number {
  let d = 0;
  for (let i = 1; i < pts.length; i++) d += haversine(pts[i - 1], pts[i]);
  return d;
}

/** Slippy-map tile count for a bbox over a zoom range – used to warn before big offline downloads. */
export function estimateTileCount(b: [number, number, number, number], minZoom: number, maxZoom: number): number {
  const [w, s, e, n] = b;
  const tx = (lng: number, z: number) => Math.floor(((lng + 180) / 360) * 2 ** z);
  const ty = (lat: number, z: number) => {
    const l = rad(Math.max(-85.0511, Math.min(85.0511, lat)));
    return Math.floor(((1 - Math.log(Math.tan(l) + 1 / Math.cos(l)) / Math.PI) / 2) * 2 ** z);
  };
  let total = 0;
  for (let z = minZoom; z <= maxZoom; z++) {
    total += (Math.abs(tx(e, z) - tx(w, z)) + 1) * (Math.abs(ty(s, z) - ty(n, z)) + 1);
  }
  return total;
}

/** Sum of positive altitude changes, ignoring GPS noise below `threshold` metres. */
export function elevationGain(alts: (number | null)[], threshold = 3): number {
  let gain = 0;
  let ref: number | null = null;
  for (const a of alts) {
    if (a == null) continue;
    if (ref == null) { ref = a; continue; }
    if (a - ref >= threshold) { gain += a - ref; ref = a; }
    else if (ref - a >= threshold) ref = a;
  }
  return gain;
}

/** Index of the point on `pts` closest to `p`. */
export function nearestIndex(pts: LL[], p: LL): number {
  let best = 0, bd = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const d = haversine(pts[i], p);
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

export function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function toGPX(name: string, pts: { lat: number; lng: number; alt: number | null; ts: number }[], waypoints: { name: string; lat: number; lng: number }[] = []): string {
  const wpt = waypoints.map((w) => `<wpt lat="${w.lat}" lon="${w.lng}"><name>${escapeXml(w.name)}</name></wpt>`).join('');
  const trkpt = pts
    .map((p) => `<trkpt lat="${p.lat}" lon="${p.lng}">${p.alt != null ? `<ele>${p.alt.toFixed(1)}</ele>` : ''}<time>${new Date(p.ts).toISOString()}</time></trkpt>`)
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="CreekFinder" xmlns="http://www.topografix.com/GPX/1/1">${wpt}<trk><name>${escapeXml(name)}</name><trkseg>${trkpt}</trkseg></trk></gpx>`;
}

/** Google Maps / Apple Maps deep links for turn-by-turn driving or walking directions. */
export function directionsUrls(lat: number, lng: number, label: string) {
  const q = encodeURIComponent(label);
  return {
    apple: `http://maps.apple.com/?daddr=${lat},${lng}&q=${q}&dirflg=d`,
    google: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
    geo: `geo:${lat},${lng}?q=${lat},${lng}(${q})`,
  };
}

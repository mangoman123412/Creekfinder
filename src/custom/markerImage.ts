import { toRgb } from './colorUtils';
import type { MarkerShape } from './schema';

/**
 * Rasterises a map-marker (shape + fill colour + white outline) to RGBA pixels with analytic anti-aliasing.
 * Pure JS (no canvas), so it runs on web, native and in unit tests.
 */
export function markerPixels(shape: MarkerShape, fill: string, px = 64, stroke = '#FFFFFF'): { width: number; height: number; data: Uint8Array } {
  const data = new Uint8Array(px * px * 4);
  const c = px / 2, r = px * 0.36, sw = px * 0.075;           // shape "radius", outline width
  const F = toRgb(fill), S = toRgb(stroke);
  const star = (x: number, y: number) => { // signed distance to a 5-point star (approx via polygon test + edge distance)
    const pts: [number, number][] = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5; const rr = i % 2 ? r * 0.48 : r * 1.12; pts.push([c + Math.cos(a) * rr, c + Math.sin(a) * rr]); }
    return polySdf(pts, x, y);
  };
  const sdf = (x: number, y: number): number => {
    const dx = x - c, dy = y - c;
    switch (shape) {
      case 'square': { const q = Math.max(Math.abs(dx), Math.abs(dy)) - r * 0.92; return q; }
      case 'diamond': return (Math.abs(dx) + Math.abs(dy)) / Math.SQRT2 - r * 1.02;
      case 'triangle': return polySdf([[c, c - r * 1.1], [c + r * 1.05, c + r * 0.85], [c - r * 1.05, c + r * 0.85]], x, y);
      case 'star': return star(x, y);
      default: return Math.hypot(dx, dy) - r; // circle + ring
    }
  };
  for (let y = 0; y < px; y++) for (let x = 0; x < px; x++) {
    const d = sdf(x + 0.5, y + 0.5);
    const outer = clamp01(0.5 - d);                         // inside the shape incl. outline
    const inner = clamp01(0.5 - (d + sw));                  // inside the fill area
    const hole = shape === 'ring' ? clamp01(0.5 - (d + sw * 2.6)) : 0; // ring: transparent centre
    const fillA = Math.max(0, inner - hole);
    const strokeA = Math.max(0, outer - inner) + (shape === 'ring' ? hole * 0.0 : 0);
    const a = Math.min(1, fillA + strokeA + (shape === 'ring' ? Math.max(0, hole) * 0 : 0));
    const i = (y * px + x) * 4;
    if (a <= 0) continue;
    const wf = a ? fillA / (fillA + strokeA || 1) : 0;
    data[i] = S[0] + (F[0] - S[0]) * wf; data[i + 1] = S[1] + (F[1] - S[1]) * wf; data[i + 2] = S[2] + (F[2] - S[2]) * wf; data[i + 3] = Math.round(a * 255);
  }
  return { width: px, height: px, data };
}
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
function polySdf(p: [number, number][], x: number, y: number): number {
  let d = Infinity, inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [x1, y1] = p[i], [x2, y2] = p[j];
    if ((y1 > y) !== (y2 > y) && x < ((x2 - x1) * (y - y1)) / (y2 - y1) + x1) inside = !inside;
    const vx = x2 - x1, vy = y2 - y1, t = Math.max(0, Math.min(1, ((x - x1) * vx + (y - y1) * vy) / (vx * vx + vy * vy || 1)));
    d = Math.min(d, Math.hypot(x - (x1 + vx * t), y - (y1 + vy * t)));
  }
  return inside ? -d : d;
}

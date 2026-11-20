export const HEX_RE = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
export function normHex(s: string | undefined | null, fallback = '#000000'): string {
  if (!s) return fallback;
  const m = s.trim().match(HEX_RE);
  if (!m) return fallback;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return `#${h.toUpperCase()}`;
}
export const isHex = (s: string) => HEX_RE.test(s.trim());
export type RGB = [number, number, number];
export function toRgb(hex: string): RGB { const h = normHex(hex).slice(1); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
export function toHex([r, g, b]: RGB): string { const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0'); return `#${c(r)}${c(g)}${c(b)}`.toUpperCase(); }
export function mix(a: string, b: string, t: number): string { const A = toRgb(a), B = toRgb(b); return toHex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]); }
export function rgba(hex: string, alpha: number): string { const [r, g, b] = toRgb(hex); return `rgba(${r},${g},${b},${alpha})`; }
export function luminance(hex: string): number {
  const f = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  const [r, g, b] = toRgb(hex); return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
export function contrastRatio(a: string, b: string): number { const la = luminance(a), lb = luminance(b); const [hi, lo] = la > lb ? [la, lb] : [lb, la]; return (hi + 0.05) / (lo + 0.05); }
/** Readable text colour (black or white) for a background. */
export const onColor = (bg: string) => (contrastRatio(bg, '#FFFFFF') >= contrastRatio(bg, '#0B0F0D') ? '#FFFFFF' : '#0B0F0D');
/** Nudge `fg` toward black/white until it reaches `ratio` against `bg`. */
export function ensureContrast(fg: string, bg: string, ratio = 4.5): string {
  if (contrastRatio(fg, bg) >= ratio) return fg;
  const target = contrastRatio('#000000', bg) >= contrastRatio('#FFFFFF', bg) ? '#000000' : '#FFFFFF';   // whichever extreme can actually reach the ratio
  for (let t = 0.1; t <= 1.0001; t += 0.1) { const c = mix(fg, target, t); if (contrastRatio(c, bg) >= ratio) return c; }
  return target;
}
export function rgbToHsv([r, g, b]: RGB): [number, number, number] {
  r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0;
  if (d) { if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; if (h < 0) h += 360; }
  return [h, mx ? d / mx : 0, mx];
}
export function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c; let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0]; else if (h < 120) [r, g, b] = [x, c, 0]; else if (h < 180) [r, g, b] = [0, c, x]; else if (h < 240) [r, g, b] = [0, x, c]; else if (h < 300) [r, g, b] = [x, 0, c]; else [r, g, b] = [c, 0, x];
  return toHex([(r + m) * 255, (g + m) * 255, (b + m) * 255]);
}

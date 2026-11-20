import { SCHEMA_VERSION, defaultLibrary, sanitize, sanitizeLibrary, sanitizeMapPreset, sanitizeTheme, sanitizeWidgets, type AppProfile, type Library, type MapPreset, type Settings, type ThemeSpec, type WidgetInstance } from './schema';

/**
 * Export / import format (also used by the marketplace). It is DATA ONLY:
 *   "CF1:" + base64( JSON { v, kind, name, payload, sum } )
 * On import every field is validated and clamped against the schema (unknown keys are dropped, colours must be hex, lists must use
 * known ids…). Nothing is ever evaluated or executed. `sum` is an integrity checksum (detects truncated/corrupted codes).
 */
export type ShareKind = 'theme' | 'layout' | 'profile' | 'mappreset' | 'library';
export const MAX_CODE = 120_000;
const PREFIX = 'CF1:';

export function checksum(s: string): string { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16).padStart(8, '0'); }
const b64 = (s: string) => btoa(unescape(encodeURIComponent(s)));
const unb64 = (s: string) => decodeURIComponent(escape(atob(s)));

export interface ThemePayload { spec: ThemeSpec }
export interface LayoutPayload { widgets: WidgetInstance[] }
export interface ProfilePayload { icon: string; settings: Settings }
export interface MapPayload { preset: MapPreset }

export function encodeShare(kind: ShareKind, name: string, payload: unknown): string {
  const body = JSON.stringify(payload);
  return PREFIX + b64(JSON.stringify({ v: SCHEMA_VERSION, kind, name: name.slice(0, 40), payload: JSON.parse(body), sum: checksum(`${kind}|${name}|${body}`) }));
}

export type Decoded =
  | { ok: true; kind: 'theme'; name: string; spec: ThemeSpec }
  | { ok: true; kind: 'layout'; name: string; widgets: WidgetInstance[] }
  | { ok: true; kind: 'profile'; name: string; icon: string; settings: Settings }
  | { ok: true; kind: 'mappreset'; name: string; preset: MapPreset }
  | { ok: true; kind: 'library'; name: string; library: Library }
  | { ok: false; error: string };

export function decodeShare(text: string): Decoded {
  try {
    const t = text.trim();
    if (!t.startsWith(PREFIX)) return { ok: false, error: 'This is not a CreekFinder design code (it should start with CF1:).' };
    if (t.length > MAX_CODE) return { ok: false, error: 'This code is too large to be a design.' };
    const o = JSON.parse(unb64(t.slice(PREFIX.length)));
    if (!o || typeof o !== 'object' || typeof o.kind !== 'string') return { ok: false, error: 'The code is damaged.' };
    if (typeof o.v !== 'number' || o.v > SCHEMA_VERSION) return { ok: false, error: 'This design was made with a newer version of CreekFinder. Please update the app.' };
    const body = JSON.stringify(o.payload);
    if (o.sum !== checksum(`${o.kind}|${o.name}|${body}`)) return { ok: false, error: 'The code is incomplete or was changed (checksum mismatch).' };
    const name = typeof o.name === 'string' ? o.name.replace(/[\u0000-\u001f<>]/g, '').slice(0, 40) || 'Shared design' : 'Shared design';
    const p = o.payload ?? {};
    switch (o.kind as ShareKind) {
      case 'theme': return { ok: true, kind: 'theme', name, spec: sanitizeTheme(p.spec) };
      case 'layout': return { ok: true, kind: 'layout', name, widgets: sanitizeWidgets(p.widgets) };
      case 'profile': return { ok: true, kind: 'profile', name, icon: typeof p.icon === 'string' ? p.icon.slice(0, 30) : 'leaf', settings: sanitize(p.settings) };
      case 'mappreset': return { ok: true, kind: 'mappreset', name, preset: sanitizeMapPreset({ ...p.preset, name }) };
      case 'library': return { ok: true, kind: 'library', name, library: sanitizeLibrary(p.library) };
      default: return { ok: false, error: 'Unknown design type.' };
    }
  } catch { return { ok: false, error: 'Could not read this code.' }; }
}

export const profileToPayload = (p: AppProfile): ProfilePayload => ({ icon: p.icon, settings: p.settings });
void defaultLibrary;

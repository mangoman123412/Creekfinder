import type { Palette } from '../theme';
import { SEED_KEYS, presetById, type Seeds, type ThemeSpec } from './schema';
import { contrastRatio, ensureContrast, mix, onColor, rgba } from './colorUtils';

export function resolveSeeds(spec: ThemeSpec, systemDark: boolean): { seeds: Seeds; dark: boolean } {
  const p = presetById(spec.presetId);
  const dark = !!p.forceDark || spec.mode === 'dark' || (spec.mode === 'system' && systemDark);
  const seeds = { ...(dark ? p.dark : p.light) } as Seeds;
  for (const k of SEED_KEYS) { const v = spec.overrides[k]; if (v) seeds[k] = v; }
  return { seeds, dark };
}

/** Turn the 13 user-editable seed colours into the full palette used by every component. */
export function buildPalette(seeds: Seeds, dark: boolean, highContrast = false): Palette {
  let { primary, secondary, accent, background: bg, card, text, button, nav } = seeds;
  if (highContrast) {
    text = dark ? '#FFFFFF' : '#000000'; bg = dark ? '#000000' : '#FFFFFF'; card = dark ? '#0A0A0A' : '#FFFFFF'; nav = card;
    primary = ensureContrast(primary, bg, 7); secondary = ensureContrast(secondary, bg, 4.5); button = ensureContrast(button, bg, 4.5); accent = ensureContrast(accent, bg, 4.5);
  }
  const surface = card;
  const surface2 = mix(card, text, highContrast ? 0.1 : 0.06);
  const surface3 = mix(card, text, highContrast ? 0.2 : 0.12);
  const muted = mix(text, bg, highContrast ? 0.1 : 0.38);
  const faint = ensureContrast(mix(text, bg, highContrast ? 0.2 : 0.58), card, highContrast ? 4.5 : 3);
  const danger = dark ? '#F0705E' : '#C8402F', ok = dark ? '#5CC48A' : '#2E7D4F';
  const primaryDeep = mix(primary, '#000000', dark ? 0.55 : 0.4);
  const waterDeep = mix(secondary, '#000000', 0.3);
  return {
    bg, surface, surface2, surface3, ink: text, muted, faint, line: rgba(text, highContrast ? 0.5 : 0.09),
    primary, primaryDeep, onPrimary: onColor(primary), button, onButton: onColor(button), navBg: nav,
    water: secondary, waterDeep, waterTint: mix(secondary, bg, dark ? 0.78 : 0.86),
    amber: accent, amberTint: mix(accent, bg, dark ? 0.8 : 0.86),
    danger, dangerTint: mix(danger, bg, dark ? 0.8 : 0.88), ok, okTint: mix(ok, bg, dark ? 0.8 : 0.88),
    overlay: rgba(nav, 0.93), scrim: dark ? 'rgba(0,0,0,0.62)' : 'rgba(8,16,12,0.55)',
    markerSaved: seeds.markerSaved, markerCommunity: seeds.markerCommunity, markerOsm: seeds.markerOsm, markerVisited: seeds.markerVisited, markerParking: seeds.markerParking,
    forest: primary, forestDark: primaryDeep, moss: '#6E9A59', sand: bg, card, waterLight: mix(secondary, bg, dark ? 0.78 : 0.86), earth: '#9A7B54',
    warn: dark ? '#F0B04A' : '#B7791F', warnBg: mix(accent, bg, dark ? 0.8 : 0.86), dangerBg: mix(danger, bg, dark ? 0.8 : 0.88), white: '#FFFFFF',
  };
}

export const paletteFor = (spec: ThemeSpec, systemDark: boolean, highContrast = false) => { const r = resolveSeeds(spec, systemDark); return { palette: buildPalette(r.seeds, r.dark, highContrast), dark: r.dark, seeds: r.seeds }; };
export { contrastRatio };

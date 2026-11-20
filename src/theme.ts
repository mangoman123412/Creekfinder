/**
 * CreekFinder design tokens. EVERYTHING here is driven by the user's customization (src/custom):
 *   colors  -> built from the chosen theme + overrides (+ high-contrast)
 *   radius / space / shadow / font -> scaled by corners, density and card-style settings
 * `colors`, `radius`, `space` and `shadow` read the *current* values each time, so a re-render picks up changes instantly.
 */
export interface Palette {
  bg: string; surface: string; surface2: string; surface3: string;
  ink: string; muted: string; faint: string; line: string;
  primary: string; primaryDeep: string; onPrimary: string;
  button: string; onButton: string; navBg: string;
  water: string; waterDeep: string; waterTint: string;
  amber: string; amberTint: string;
  danger: string; dangerTint: string; ok: string; okTint: string;
  overlay: string; scrim: string;
  markerSaved: string; markerCommunity: string; markerOsm: string; markerVisited: string; markerParking: string;
  // legacy aliases kept so every older screen keeps working
  forest: string; forestDark: string; moss: string; sand: string; card: string; waterLight: string;
  earth: string; warn: string; warnBg: string; dangerBg: string; white: string;
}

export interface Runtime {
  dark: boolean; corner: number; density: number; cardStyle: 'elevated' | 'flat' | 'outlined' | 'glass'; textScale: number; fontId: string; bold: boolean;
  buttonH: number; iconScale: number; motion: number; largeTargets: boolean; highContrast: boolean; screenReader: boolean; iconStyle: 'auto' | 'outline' | 'filled';
}
export const runtime: Runtime = { dark: false, corner: 1, density: 1, cardStyle: 'elevated', textScale: 1, fontId: 'inter', bold: false, buttonH: 1, iconScale: 1, motion: 1, largeTargets: false, highContrast: false, screenReader: false, iconStyle: 'auto' };

const fallback: Palette = {
  bg: '#F3F1EA', surface: '#FFFFFF', surface2: '#ECE9DF', surface3: '#E2DED1', ink: '#121C17', muted: '#5B6961', faint: '#8B978F', line: 'rgba(18,28,23,0.09)',
  primary: '#1F5A43', primaryDeep: '#133A2B', onPrimary: '#FFFFFF', button: '#1F5A43', onButton: '#FFFFFF', navBg: '#FFFFFF', water: '#1B8FD0', waterDeep: '#0F6AA3', waterTint: '#DDF0FA',
  amber: '#D98E1F', amberTint: '#FFF1D6', danger: '#C8402F', dangerTint: '#FCE9E5', ok: '#2E7D4F', okTint: '#DDF3E5', overlay: 'rgba(255,255,255,0.92)', scrim: 'rgba(8,16,12,0.55)',
  markerSaved: '#1F5A43', markerCommunity: '#1B8FD0', markerOsm: '#7A8F86', markerVisited: '#8E5BD1', markerParking: '#3B6EA8',
  forest: '#1F5A43', forestDark: '#133A2B', moss: '#6E9A59', sand: '#F3F1EA', card: '#FFFFFF', waterLight: '#DDF0FA', earth: '#9A7B54', warn: '#B7791F', warnBg: '#FFF1D6', dangerBg: '#FCE9E5', white: '#FFFFFF',
};
let current: Palette = fallback;
export function applyPalette(p: Palette, dark: boolean) { current = p; runtime.dark = dark; }
export const isDark = () => runtime.dark;
export const colors: Palette = new Proxy({} as Palette, { get: (_t, k) => (current as any)[k] });

export const radius = {
  get xs() { return 8 * runtime.corner; }, get sm() { return 12 * runtime.corner; }, get md() { return 18 * runtime.corner; },
  get lg() { return 26 * runtime.corner; }, get xl() { return 34 * runtime.corner; }, pill: 999,
};
export const space = {
  get xs() { return 4 * runtime.density; }, get sm() { return 8 * runtime.density; }, get md() { return 12 * runtime.density; },
  get lg() { return 16 * runtime.density; }, get xl() { return 24 * runtime.density; }, get xxl() { return 32 * runtime.density; },
};
/** horizontal screen gutter */
export const gutter = () => Math.round(18 * runtime.density);

export const shadow = {
  get card() { return runtime.cardStyle === 'flat' || runtime.cardStyle === 'outlined' ? {} : { shadowColor: '#000', shadowOpacity: runtime.dark ? 0.4 : 0.1, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 5 }; },
  get soft() { return runtime.cardStyle === 'flat' || runtime.cardStyle === 'outlined' ? {} : { shadowColor: '#000', shadowOpacity: runtime.dark ? 0.3 : 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2 }; },
  get float() { return { shadowColor: '#000', shadowOpacity: runtime.dark ? 0.55 : 0.25, shadowRadius: 22, shadowOffset: { width: 0, height: 12 }, elevation: 12 }; },
};
/** Extra style a "card" gets from the chosen card appearance. */
export const cardExtra = () => {
  switch (runtime.cardStyle) {
    case 'outlined': return { borderWidth: runtime.highContrast ? 2 : 1, borderColor: runtime.highContrast ? current.ink : current.line };
    case 'glass': return { backgroundColor: current.overlay, borderWidth: 1, borderColor: current.line };
    default: return runtime.highContrast ? { borderWidth: 1.5, borderColor: current.ink } : {};
  }
};

export type FontSet = { regular: string; semi: string; bold: string; black: string };
export const FONT_SETS: Record<string, FontSet> = {
  inter: { regular: 'Inter_400Regular', semi: 'Inter_600SemiBold', bold: 'Inter_700Bold', black: 'Inter_800ExtraBold' },
  nunito: { regular: 'Nunito_400Regular', semi: 'Nunito_600SemiBold', bold: 'Nunito_700Bold', black: 'Nunito_800ExtraBold' },
  lora: { regular: 'Lora_400Regular', semi: 'Lora_600SemiBold', bold: 'Lora_700Bold', black: 'Lora_700Bold' },
  atkinson: { regular: 'AtkinsonHyperlegible_400Regular', semi: 'AtkinsonHyperlegible_700Bold', bold: 'AtkinsonHyperlegible_700Bold', black: 'AtkinsonHyperlegible_700Bold' },
};
export const FONT = new Proxy({} as FontSet, { get: (_t, k) => (FONT_SETS[runtime.fontId] ?? FONT_SETS.inter)[k as keyof FontSet] });

export const font = {
  get display() { return { fontSize: 34, lineHeight: 38, fontWeight: '800' as const, color: colors.ink, letterSpacing: -0.8 }; },
  get h1() { return { fontSize: 28, lineHeight: 33, fontWeight: '800' as const, color: colors.ink, letterSpacing: -0.5 }; },
  get h2() { return { fontSize: 20, lineHeight: 26, fontWeight: '700' as const, color: colors.ink, letterSpacing: -0.2 }; },
  get h3() { return { fontSize: 16, lineHeight: 21, fontWeight: '700' as const, color: colors.ink }; },
  get body() { return { fontSize: 15.5, lineHeight: 22, color: colors.ink }; },
  get small() { return { fontSize: 13, lineHeight: 18, color: colors.muted }; },
  get label() { return { fontSize: 11.5, lineHeight: 14, fontWeight: '700' as const, color: colors.faint, letterSpacing: 0.9, textTransform: 'uppercase' as const }; },
};

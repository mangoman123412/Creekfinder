/**
 * CreekFinder design system. Light + dark palettes behind one `colors` object.
 * `colors` reads the ACTIVE palette every time, so screens stay correct after a theme change
 * (the root remounts with a new key when the scheme flips — see state/theme.tsx).
 */
export interface Palette {
  bg: string; surface: string; surface2: string; surface3: string;
  ink: string; muted: string; faint: string; line: string;
  primary: string; primaryDeep: string; onPrimary: string;
  water: string; waterDeep: string; waterTint: string;
  amber: string; amberTint: string;
  danger: string; dangerTint: string; ok: string; okTint: string;
  overlay: string; scrim: string;
  // legacy aliases kept so every older screen keeps working
  forest: string; forestDark: string; moss: string; sand: string; card: string; waterLight: string;
  earth: string; warn: string; warnBg: string; dangerBg: string; white: string;
}

const base = { white: '#FFFFFF', earth: '#9A7B54', moss: '#6E9A59' };

export const lightPalette: Palette = {
  ...base,
  bg: '#F3F1EA', surface: '#FFFFFF', surface2: '#ECE9DF', surface3: '#E2DED1',
  ink: '#121C17', muted: '#5B6961', faint: '#8B978F', line: 'rgba(18,28,23,0.09)',
  primary: '#1F5A43', primaryDeep: '#133A2B', onPrimary: '#FFFFFF',
  water: '#1B8FD0', waterDeep: '#0F6AA3', waterTint: '#DDF0FA',
  amber: '#D98E1F', amberTint: '#FFF1D6',
  danger: '#C8402F', dangerTint: '#FCE9E5', ok: '#2E7D4F', okTint: '#DDF3E5',
  overlay: 'rgba(255,255,255,0.92)', scrim: 'rgba(8,16,12,0.55)',
  forest: '#1F5A43', forestDark: '#133A2B', sand: '#F3F1EA', card: '#FFFFFF', waterLight: '#DDF0FA',
  warn: '#B7791F', warnBg: '#FFF1D6', dangerBg: '#FCE9E5',
};

export const darkPalette: Palette = {
  ...base,
  bg: '#0C1310', surface: '#16201B', surface2: '#1E2B25', surface3: '#2A3A33',
  ink: '#EDF3EF', muted: '#9AAAA1', faint: '#6F7F76', line: 'rgba(237,243,239,0.10)',
  primary: '#3C9C73', primaryDeep: '#1F5A43', onPrimary: '#FFFFFF',
  water: '#4FB4EE', waterDeep: '#2D8FCB', waterTint: '#15303F',
  amber: '#F0B04A', amberTint: '#3A2E14',
  danger: '#F0705E', dangerTint: '#3C1D18', ok: '#5CC48A', okTint: '#163626',
  overlay: 'rgba(22,32,27,0.92)', scrim: 'rgba(0,0,0,0.62)',
  forest: '#3C9C73', forestDark: '#0F2C21', sand: '#0C1310', card: '#16201B', waterLight: '#15303F',
  warn: '#F0B04A', warnBg: '#3A2E14', dangerBg: '#3C1D18',
};

let current: Palette = lightPalette;
let currentScheme: 'light' | 'dark' = 'light';
export function applyScheme(s: 'light' | 'dark') { currentScheme = s; current = s === 'dark' ? darkPalette : lightPalette; }
export const isDark = () => currentScheme === 'dark';

export const colors: Palette = new Proxy({} as Palette, { get: (_t, k) => (current as any)[k] });

export const radius = { xs: 8, sm: 12, md: 18, lg: 26, xl: 34, pill: 999 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const shadow = {
  get card() {
    return { shadowColor: '#000', shadowOpacity: currentScheme === 'dark' ? 0.4 : 0.1, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 5 };
  },
  get soft() {
    return { shadowColor: '#000', shadowOpacity: currentScheme === 'dark' ? 0.3 : 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2 };
  },
  get float() {
    return { shadowColor: '#000', shadowOpacity: currentScheme === 'dark' ? 0.55 : 0.25, shadowRadius: 22, shadowOffset: { width: 0, height: 12 }, elevation: 12 };
  },
};
// legacy: spread-able card shadow
export const shadowLegacy = shadow.card;

export const FONT = { regular: 'Inter_400Regular', semi: 'Inter_600SemiBold', bold: 'Inter_700Bold', black: 'Inter_800ExtraBold' };

export const font = {
  get display() { return { fontSize: 34, lineHeight: 38, fontWeight: '800' as const, color: colors.ink, letterSpacing: -0.8 }; },
  get h1() { return { fontSize: 28, lineHeight: 33, fontWeight: '800' as const, color: colors.ink, letterSpacing: -0.5 }; },
  get h2() { return { fontSize: 20, lineHeight: 26, fontWeight: '700' as const, color: colors.ink, letterSpacing: -0.2 }; },
  get h3() { return { fontSize: 16, lineHeight: 21, fontWeight: '700' as const, color: colors.ink }; },
  get body() { return { fontSize: 15.5, lineHeight: 22, color: colors.ink }; },
  get small() { return { fontSize: 13, lineHeight: 18, color: colors.muted }; },
  get label() { return { fontSize: 11.5, lineHeight: 14, fontWeight: '700' as const, color: colors.faint, letterSpacing: 0.9, textTransform: 'uppercase' as const }; },
};

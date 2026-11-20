import { applyPalette, runtime } from '../theme';
import { paletteFor } from './themeEngine';
import type { Settings } from './schema';

export const MOTION_FACTOR = { off: 0, subtle: 0.5, normal: 1, lively: 1.5 } as const;
let systemReduceMotion = false;
export const setSystemReduceMotion = (v: boolean) => { systemReduceMotion = v; };

/** Push the user's settings into the live design tokens. Called whenever settings or the system theme change. */
export function applySettings(s: Settings, systemDark: boolean) {
  const { palette, dark } = paletteFor(s.theme, systemDark, s.a11y.highContrast);
  applyPalette(palette, dark);
  const d = s.display;
  runtime.corner = { sharp: 0.35, soft: 1, round: 1.55 }[d.corners];
  runtime.density = { compact: 0.82, comfortable: 1, spacious: 1.22 }[d.density];
  runtime.cardStyle = d.cardStyle; runtime.textScale = d.textScale; runtime.fontId = d.font; runtime.bold = d.boldText || s.a11y.highContrast;
  runtime.buttonH = { small: 0.88, medium: 1, large: 1.22 }[d.buttonSize] * (s.a11y.largeTargets ? 1.15 : 1);
  runtime.iconScale = { small: 0.85, medium: 1, large: 1.25 }[d.iconSize];
  runtime.motion = s.a11y.reduceMotion || systemReduceMotion ? 0 : MOTION_FACTOR[d.motion];
  runtime.largeTargets = s.a11y.largeTargets; runtime.highContrast = s.a11y.highContrast; runtime.screenReader = s.a11y.screenReader; runtime.iconStyle = s.nav.iconStyle;
}

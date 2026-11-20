import { runtime } from '../theme';

/** Animation helper: returns undefined when motion is off; scales duration/delay by the user's intensity setting. */
export function fx(anim: any, duration = 380, delay = 0): any {
  if (runtime.motion <= 0) return undefined;
  return anim.duration(duration / Math.max(0.5, runtime.motion)).delay(delay * runtime.motion);
}
export const pressScale = (base: number) => (runtime.motion <= 0 ? 1 : 1 - (1 - base) * Math.min(1.4, runtime.motion));

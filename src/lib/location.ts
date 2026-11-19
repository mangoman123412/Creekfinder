import * as Location from 'expo-location';
import { Linking } from 'react-native';

export interface Fix { lat: number; lng: number; accuracy: number | null; altitude: number | null; heading: number | null; ts: number }

export async function ensureForegroundPermission(): Promise<boolean> {
  const cur = await Location.getForegroundPermissionsAsync();
  if (cur.granted) return true;
  if (!cur.canAskAgain) return false;
  return (await Location.requestForegroundPermissionsAsync()).granted;
}

export const openSettings = () => Linking.openSettings();

const toFix = (l: Location.LocationObject): Fix => ({
  lat: l.coords.latitude, lng: l.coords.longitude, accuracy: l.coords.accuracy, altitude: l.coords.altitude, heading: l.coords.heading, ts: l.timestamp,
});

export async function lastKnown(): Promise<Fix | null> {
  try {
    const l = await Location.getLastKnownPositionAsync();
    return l ? toFix(l) : null;
  } catch { return null; }
}

/**
 * Get a high-accuracy fix. Waits briefly for the GPS to settle on a good accuracy so
 * "Save this creek" captures a precise coordinate, then returns the best fix seen.
 */
export async function getPreciseFix(opts: { targetAccuracyM?: number; timeoutMs?: number } = {}): Promise<Fix> {
  const target = opts.targetAccuracyM ?? 15;
  const timeout = opts.timeoutMs ?? 12000;
  let best: Fix | null = null;
  await new Promise<void>(async (resolve) => {
    let sub: Location.LocationSubscription | null = null;
    const finish = () => { sub?.remove(); resolve(); };
    const timer = setTimeout(finish, timeout);
    try {
      sub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.BestForNavigation, timeInterval: 500, distanceInterval: 0 }, (l) => {
        const f = toFix(l);
        if (!best || (f.accuracy ?? 1e9) < (best.accuracy ?? 1e9)) best = f;
        if ((f.accuracy ?? 1e9) <= target) { clearTimeout(timer); finish(); }
      });
    } catch { clearTimeout(timer); finish(); }
  });
  if (!best) {
    const l = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    return toFix(l);
  }
  return best;
}

export async function watchFixes(cb: (f: Fix) => void, distanceInterval = 5): Promise<() => void> {
  const sub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, distanceInterval, timeInterval: 2000 }, (l) => cb(toFix(l)));
  return () => sub.remove();
}

export async function watchHeading(cb: (deg: number) => void): Promise<() => void> {
  const sub = await Location.watchHeadingAsync((h) => cb(h.trueHeading >= 0 ? h.trueHeading : h.magHeading));
  return () => sub.remove();
}

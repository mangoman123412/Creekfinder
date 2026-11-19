import * as Location from 'expo-location';
import { getActiveAdventureId, kvSet, recordFixes, startAdventure } from '../db/local';

/** Web: no background location exists in browsers. Recording works while the app/tab is open (screen kept awake). */
export const TRACK_TASK = 'creekfinder-track';
let sub: Location.LocationSubscription | null = null;

const attach = async (id: string) => {
  sub?.remove();
  sub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 5, timeInterval: 3000 }, (l) => {
    void recordFixes(id, [{ lat: l.coords.latitude, lng: l.coords.longitude, alt: l.coords.altitude, acc: l.coords.accuracy, ts: l.timestamp }]);
  });
};
export type StartResult = { adventureId: string; background: boolean };
export async function startTracking(name?: string): Promise<StartResult> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (!fg.granted) throw new Error('Location permission is required to record a trail.');
  const adventureId = await startAdventure(name);
  await attach(adventureId);
  await kvSet('track_background', '0');
  return { adventureId, background: false };
}
export async function stopTrackingUpdates() { sub?.remove(); sub = null; }
export async function resumeIfNeeded(): Promise<string | null> {
  const id = await getActiveAdventureId();
  if (id && !sub) { try { await attach(id); } catch {} }
  return id;
}
export const isAndroid = false;

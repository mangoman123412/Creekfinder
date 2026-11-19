import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { getActiveAdventureId, kvGet, kvSet, recordFixes, startAdventure, type RawFix } from '../db/local';

export const TRACK_TASK = 'creekfinder-track';

const toRaw = (l: Location.LocationObject): RawFix => ({
  lat: l.coords.latitude, lng: l.coords.longitude, alt: l.coords.altitude, acc: l.coords.accuracy, ts: l.timestamp,
});

/**
 * Must run at module scope (imported from app/_layout.tsx) so the OS can wake it while the app is
 * backgrounded or the screen is off. It writes straight to local SQLite, so it needs no network.
 */
TaskManager.defineTask(TRACK_TASK, async ({ data, error }) => {
  if (error) return;
  const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations;
  if (!locations?.length) return;
  const id = await getActiveAdventureId();
  if (!id) return;
  await recordFixes(id, locations.map(toRaw));
});

let fgSub: Location.LocationSubscription | null = null;

export type StartResult = { adventureId: string; background: boolean };

export async function startTracking(name?: string): Promise<StartResult> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (!fg.granted) throw new Error('Location permission is required to record a trail.');
  let bg = false;
  try {
    const b = await Location.requestBackgroundPermissionsAsync();
    bg = b.granted;
  } catch { bg = false; }

  const adventureId = await startAdventure(name);
  if (bg) {
    await Location.startLocationUpdatesAsync(TRACK_TASK, {
      accuracy: Location.Accuracy.BestForNavigation,
      distanceInterval: 5,
      timeInterval: 4000,
      deferredUpdatesInterval: 4000,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      activityType: Location.ActivityType.Fitness,
      foregroundService: {
        notificationTitle: 'CreekFinder is recording your trail',
        notificationBody: 'Tap to return to the app. Location is only used for your trail.',
        notificationColor: '#1F4D3A',
        killServiceOnDestroy: false,
      },
    });
  } else {
    // No "always" permission: still record, but only while the app stays open.
    fgSub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 5, timeInterval: 3000 }, (l) => {
      void recordFixes(adventureId, [toRaw(l)]);
    });
  }
  await kvSet('track_background', bg ? '1' : '0');
  return { adventureId, background: bg };
}

export async function stopTrackingUpdates() {
  try {
    if (await TaskManager.isTaskRegisteredAsync(TRACK_TASK)) {
      if (await Location.hasStartedLocationUpdatesAsync(TRACK_TASK)) await Location.stopLocationUpdatesAsync(TRACK_TASK);
    }
  } catch {}
  fgSub?.remove();
  fgSub = null;
}

/** After an app restart: re-attach the foreground fallback if a recording was in progress. */
export async function resumeIfNeeded(): Promise<string | null> {
  const id = await getActiveAdventureId();
  if (!id) return null;
  const bgMode = (await kvGet('track_background')) === '1';
  if (!bgMode && !fgSub) {
    try {
      fgSub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 5, timeInterval: 3000 }, (l) => {
        void recordFixes(id, [toRaw(l)]);
      });
    } catch {}
  }
  return id;
}

export const isAndroid = Platform.OS === 'android';

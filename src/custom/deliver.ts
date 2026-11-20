import * as Notifications from 'expo-notifications';
import type { SoundId } from './schema';

export async function notifPermission(): Promise<'granted' | 'denied' | 'undetermined'> { try { return (await Notifications.getPermissionsAsync()).status as any; } catch { return 'denied'; } }
export async function requestNotifPermission(): Promise<boolean> { try { return (await Notifications.requestPermissionsAsync()).granted; } catch { return false; } }

/** Native: show a local notification. Sound is the system default or silent (custom sound files need a native build step). */
export async function deliverSystem(title: string, body: string, safety: boolean, sound: SoundId) {
  try {
    if ((await Notifications.getPermissionsAsync()).status !== 'granted') return;
    await Notifications.scheduleNotificationAsync({ content: { title: safety ? `⚠️ SAFETY · ${title}` : title, body, sound: sound !== 'silent' }, trigger: null });
  } catch {}
}
export function previewSound(_s: SoundId) { /* native sounds are controlled by the OS */ }
export const canChooseSound = false;

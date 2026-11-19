import { Linking, Platform, Share } from 'react-native';
import { Alert } from './alert';
import * as Clipboard from 'expo-clipboard';
import { countPlaces } from '../db/local';
import { FREE_PLACE_LIMIT } from '../config';
import { directionsUrls, formatCoords, formatDMS } from './geo';

/** Returns true when the user may save another place, otherwise routes to the paywall. */
export async function canSaveMore(premium: boolean, push: (href: any) => void): Promise<boolean> {
  if (premium) return true;
  const n = await countPlaces();
  if (n >= FREE_PLACE_LIMIT) {
    push({ pathname: '/premium', params: { reason: 'limit' } });
    return false;
  }
  return true;
}

export async function shareLocation(name: string, lat: number, lng: number, emergency = false) {
  const maps = `https://www.google.com/maps?q=${lat},${lng}`;
  const apple = `https://maps.apple.com/?ll=${lat},${lng}&q=${encodeURIComponent(name)}`;
  const msg = emergency
    ? `I need help / this is my location.\n${formatCoords(lat, lng, 6)}\n${formatDMS(lat, lng)}\nGoogle Maps: ${maps}\nApple Maps: ${apple}\n(Sent from CreekFinder at ${new Date().toLocaleString()})`
    : `${name}\n${formatCoords(lat, lng, 6)}\nGoogle Maps: ${maps}\nApple Maps: ${apple}`;
  if (Platform.OS === 'web') {
    const nav: any = navigator;
    if (nav.share) { try { await nav.share({ title: name, text: msg }); return; } catch (e: any) { if (e?.name === 'AbortError') return; } }
    await Clipboard.setStringAsync(msg);
    Alert.alert('Copied', 'Your location details were copied. Paste them into a message to send.');
    return;
  }
  await Share.share(Platform.OS === 'ios' ? { message: msg } : { message: msg, title: name });
}

export async function openDirections(name: string, lat: number, lng: number) {
  const u = directionsUrls(lat, lng, name);
  const url = Platform.OS === 'ios' ? u.apple : u.google;
  try { await Linking.openURL(url); } catch { Alert.alert('Could not open Maps', 'No maps app was found on this device.'); }
}

export async function copyCoords(lat: number, lng: number) {
  await Clipboard.setStringAsync(formatCoords(lat, lng, 6));
}

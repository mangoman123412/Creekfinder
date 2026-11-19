import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Directory, File, Paths } from 'expo-file-system';
import * as Crypto from 'expo-crypto';

const dir = () => {
  const d = new Directory(Paths.document, 'photos');
  if (!d.exists) d.create({ intermediates: true, idempotent: true });
  return d;
};

/** Resize + compress, then copy into the app's permanent storage so photos survive and work offline. */
async function persist(uri: string): Promise<string> {
  const out = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1600 } }], { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG });
  const dest = new File(dir(), `${Crypto.randomUUID()}.jpg`);
  await new File(out.uri).copy(dest);
  try { new File(out.uri).delete(); } catch {}
  return dest.uri;
}

export async function takePhoto(): Promise<string | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) throw new Error('Camera permission was denied. You can enable it in Settings.');
  const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9 });
  if (r.canceled || !r.assets[0]) return null;
  return persist(r.assets[0].uri);
}

export async function pickPhotos(): Promise<string[]> {
  // The system photo picker needs no permission on modern iOS/Android.
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 6, quality: 0.9 });
  if (r.canceled) return [];
  const out: string[] = [];
  for (const a of r.assets) out.push(await persist(a.uri));
  return out;
}

export function removeLocalFile(uri: string | null) {
  if (!uri) return;
  try { const f = new File(uri); if (f.exists) f.delete(); } catch {}
}

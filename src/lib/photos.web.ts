import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

/** Web: photos are resized and stored as data: URLs inside the local database (works offline, survives reloads). */
async function persist(uri: string): Promise<string> {
  const out = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1400 } }], { compress: 0.72, format: ImageManipulator.SaveFormat.JPEG, base64: true });
  return `data:image/jpeg;base64,${out.base64}`;
}
export async function takePhoto(): Promise<string | null> {
  const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9 });
  if (r.canceled || !r.assets[0]) return null;
  return persist(r.assets[0].uri);
}
export async function pickPhotos(): Promise<string[]> {
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 6, quality: 0.9 });
  if (r.canceled) return [];
  const out: string[] = [];
  for (const a of r.assets) out.push(await persist(a.uri));
  return out;
}
export function removeLocalFile(_uri: string | null) {}
export async function readBytes(uri: string): Promise<Uint8Array> {
  return new Uint8Array(await (await fetch(uri)).arrayBuffer());
}

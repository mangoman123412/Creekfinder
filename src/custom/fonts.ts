import * as Font from 'expo-font';
import type { FontFamilyId } from './schema';

const loaded = new Set<string>(['inter']);
const loaders: Record<string, () => Promise<Record<string, any>>> = {
  nunito: async () => { const m = await import('@expo-google-fonts/nunito'); return { Nunito_400Regular: m.Nunito_400Regular, Nunito_600SemiBold: m.Nunito_600SemiBold, Nunito_700Bold: m.Nunito_700Bold, Nunito_800ExtraBold: m.Nunito_800ExtraBold }; },
  lora: async () => { const m = await import('@expo-google-fonts/lora'); return { Lora_400Regular: m.Lora_400Regular, Lora_600SemiBold: m.Lora_600SemiBold, Lora_700Bold: m.Lora_700Bold }; },
  atkinson: async () => { const m = await import('@expo-google-fonts/atkinson-hyperlegible'); return { AtkinsonHyperlegible_400Regular: m.AtkinsonHyperlegible_400Regular, AtkinsonHyperlegible_700Bold: m.AtkinsonHyperlegible_700Bold }; },
};
/** Lazily loads a font family the first time the user picks it (keeps the initial download small). */
export async function ensureFontFamily(id: FontFamilyId): Promise<boolean> {
  if (loaded.has(id)) return false;
  const l = loaders[id]; if (!l) return false;
  await Font.loadAsync(await l()); loaded.add(id); return true;
}
export const fontReady = (id: string) => loaded.has(id);

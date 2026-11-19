import * as SecureStore from 'expo-secure-store';
/** Auth tokens in iOS Keychain / Android Keystore. SecureStore values are ~2KB max, so large sessions are chunked. */
const CHUNK = 1800;
export const secureAdapter = {
  async getItem(key: string): Promise<string | null> {
    const n = await SecureStore.getItemAsync(`${key}.n`);
    if (!n) return SecureStore.getItemAsync(key);
    let out = '';
    for (let i = 0; i < Number(n); i++) { const part = await SecureStore.getItemAsync(`${key}.${i}`); if (part == null) return null; out += part; }
    return out;
  },
  async setItem(key: string, value: string): Promise<void> {
    await this.removeItem(key);
    if (value.length <= CHUNK) return SecureStore.setItemAsync(key, value);
    const parts = Math.ceil(value.length / CHUNK);
    for (let i = 0; i < parts; i++) await SecureStore.setItemAsync(`${key}.${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK));
    await SecureStore.setItemAsync(`${key}.n`, String(parts));
  },
  async removeItem(key: string): Promise<void> {
    const n = await SecureStore.getItemAsync(`${key}.n`);
    if (n) { for (let i = 0; i < Number(n); i++) await SecureStore.deleteItemAsync(`${key}.${i}`); await SecureStore.deleteItemAsync(`${key}.n`); }
    await SecureStore.deleteItemAsync(key);
  },
};

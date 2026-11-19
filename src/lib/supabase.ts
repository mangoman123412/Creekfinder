import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { config, hasBackend } from '../config';

/**
 * Auth tokens are stored in the iOS Keychain / Android Keystore via SecureStore.
 * SecureStore values are limited to ~2KB, so large sessions are split into chunks.
 */
const CHUNK = 1800;
const secureAdapter = {
  async getItem(key: string): Promise<string | null> {
    const n = await SecureStore.getItemAsync(`${key}.n`);
    if (!n) return SecureStore.getItemAsync(key);
    let out = '';
    for (let i = 0; i < Number(n); i++) {
      const part = await SecureStore.getItemAsync(`${key}.${i}`);
      if (part == null) return null;
      out += part;
    }
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
    if (n) {
      for (let i = 0; i < Number(n); i++) await SecureStore.deleteItemAsync(`${key}.${i}`);
      await SecureStore.deleteItemAsync(`${key}.n`);
    }
    await SecureStore.deleteItemAsync(key);
  },
};

export const supabase = hasBackend
  ? createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { storage: secureAdapter, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
    })
  : null;

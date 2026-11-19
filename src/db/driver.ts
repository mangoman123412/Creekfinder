import * as SQLite from 'expo-sqlite';

/** Minimal database surface used by the app. Native = expo-sqlite; web = sql.js persisted to IndexedDB (driver.web.ts). */
export interface Db {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...params: any[]): Promise<unknown>;
  getAllAsync<T = any>(sql: string, ...params: any[]): Promise<T[]>;
  getFirstAsync<T = any>(sql: string, ...params: any[]): Promise<T | null>;
}
export const openDb = (): Promise<Db> => SQLite.openDatabaseAsync('creekfinder.db') as unknown as Promise<Db>;

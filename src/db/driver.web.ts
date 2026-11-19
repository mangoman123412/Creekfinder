/**
 * Web database: real SQLite (sql.js / WebAssembly) running in the browser, with the whole database file
 * saved to IndexedDB after every change, so data survives reloads and works offline.
 */
import type { Db } from './driver';
export type { Db };

const IDB_NAME = 'creekfinder';
const STORE = 'files';
const KEY = 'creekfinder.sqlite';

function idb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(IDB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbGet(): Promise<Uint8Array | null> {
  const d = await idb();
  return new Promise((res, rej) => { const q = d.transaction(STORE).objectStore(STORE).get(KEY); q.onsuccess = () => res((q.result as Uint8Array) ?? null); q.onerror = () => rej(q.error); });
}
async function idbPut(bytes: Uint8Array): Promise<void> {
  const d = await idb();
  return new Promise((res, rej) => { const tx = d.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put(bytes, KEY); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
}

function loadScript(src: string): Promise<void> {
  return new Promise((res, rej) => {
    if ((window as any).initSqlJs) return res();
    const s = document.createElement('script');
    s.src = src; s.onload = () => res(); s.onerror = () => rej(new Error('Could not load database engine'));
    document.head.appendChild(s);
  });
}

const norm = (p: any[]) => (p.length === 1 && Array.isArray(p[0]) ? p[0] : p).map((v) => (v === undefined ? null : v));

class WebDb implements Db {
  private timer: ReturnType<typeof setTimeout> | null = null;
  constructor(private db: any) {
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') void this.flush(); });
    window.addEventListener('pagehide', () => { void this.flush(); });
  }
  private dirty() { if (this.timer) return; this.timer = setTimeout(() => { this.timer = null; void this.flush(); }, 400); }
  async flush() { try { await idbPut(this.db.export()); } catch {} }
  async execAsync(sql: string) { this.db.exec(sql); this.dirty(); }
  async runAsync(sql: string, ...params: any[]) { this.db.run(sql, norm(params)); this.dirty(); return {}; }
  async getAllAsync<T>(sql: string, ...params: any[]): Promise<T[]> {
    const st = this.db.prepare(sql);
    try { st.bind(norm(params)); const out: T[] = []; while (st.step()) out.push(st.getAsObject() as T); return out; } finally { st.free(); }
  }
  async getFirstAsync<T>(sql: string, ...params: any[]): Promise<T | null> { return (await this.getAllAsync<T>(sql, ...params))[0] ?? null; }
}

export async function openDb(): Promise<Db> {
  await loadScript('/vendor/sql-wasm.js');
  const SQL = await (window as any).initSqlJs({ locateFile: (f: string) => `/vendor/${f}` });
  let saved: Uint8Array | null = null;
  try { saved = await idbGet(); } catch {}
  try { await navigator.storage?.persist?.(); } catch {}
  return new WebDb(saved ? new SQL.Database(saved) : new SQL.Database());
}

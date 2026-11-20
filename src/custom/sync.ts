import { supabase } from '../lib/supabase';
import { getLibrary, replaceLibrary, setChangeHook } from './store';
import { sanitizeLibrary, type Library } from './schema';
import { kvGet, kvSet } from '../db/local';

/**
 * Cloud sync of customization (themes, layouts, map presets, profiles) — last write wins by timestamp.
 * Local-first: everything works offline and is stored on the device; when signed in + online it is mirrored to the account.
 * Only preferences are stored (no places, photos or locations).
 */
let uid: string | null = null; let timer: ReturnType<typeof setTimeout> | null = null; let busy = false;

export async function pushLibrary(userId: string): Promise<void> {
  if (!supabase) return; const lib = getLibrary();
  const { error } = await supabase.from('user_settings').upsert({ user_id: userId, data: lib, client_updated_at: lib.updatedAt });
  if (error) throw error;
  await kvSet('custom_synced_at', String(lib.updatedAt));
}

export type SyncResult = 'pulled' | 'pushed' | 'same' | 'offline';
export async function syncCustomization(userId: string): Promise<SyncResult> {
  if (!supabase || busy) return 'offline'; busy = true;
  try {
    const { data, error } = await supabase.from('user_settings').select('data,client_updated_at').eq('user_id', userId).maybeSingle();
    if (error) throw error;
    const local = getLibrary();
    if (data && Number(data.client_updated_at) > local.updatedAt) { replaceLibrary(sanitizeLibrary(data.data), 'remote'); await kvSet('custom_synced_at', String(data.client_updated_at)); return 'pulled'; }
    if (!data || local.updatedAt > Number(data.client_updated_at)) { await pushLibrary(userId); await maybeDailyBackup(userId); return 'pushed'; }
    return 'same';
  } finally { busy = false; }
}

/** Call once with a getter for the signed-in user id; pushes (debounced) after every local customization change. */
export function enableAutoPush(getUser: () => string | null) {
  setChangeHook((_l, reason) => {
    if (reason === 'remote') return; uid = getUser(); if (!uid) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { if (uid) void pushLibrary(uid).catch(() => {}); }, 2500);
  });
}

// ------------------------------------------------------------------ backups
export interface BackupInfo { id: string; label: string; created_at: string; local?: boolean }
const LOCAL_KEY = 'custom_local_backups';

async function readLocal(): Promise<{ id: string; label: string; created_at: string; data: Library }[]> { try { const r = await kvGet(LOCAL_KEY); return r ? JSON.parse(r) : []; } catch { return []; } }
export async function createLocalSnapshot(label: string) {
  const all = await readLocal(); all.unshift({ id: `local-${Date.now()}`, label, created_at: new Date().toISOString(), data: getLibrary() });
  await kvSet(LOCAL_KEY, JSON.stringify(all.slice(0, 8)));
}
export async function listBackups(userId: string | null): Promise<BackupInfo[]> {
  const local: BackupInfo[] = (await readLocal()).map((b) => ({ id: b.id, label: b.label, created_at: b.created_at, local: true }));
  if (!supabase || !userId) return local;
  try { const { data } = await supabase.from('settings_backups').select('id,label,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(20); return [...(data ?? []), ...local].sort((a, b) => b.created_at.localeCompare(a.created_at)); } catch { return local; }
}
export async function createBackup(userId: string | null, label: string) {
  await createLocalSnapshot(label);
  if (supabase && userId) { const { error } = await supabase.from('settings_backups').insert({ user_id: userId, label, data: getLibrary() }); if (error) throw error; await prune(userId); }
}
async function prune(userId: string) {
  if (!supabase) return; const { data } = await supabase.from('settings_backups').select('id').eq('user_id', userId).order('created_at', { ascending: false });
  const extra = (data ?? []).slice(15).map((x) => x.id); if (extra.length) await supabase.from('settings_backups').delete().in('id', extra);
}
async function maybeDailyBackup(userId: string) {
  const day = new Date().toDateString(); if ((await kvGet('custom_backup_day')) === day) return;
  await kvSet('custom_backup_day', day); try { await createBackup(userId, 'Automatic daily backup'); } catch {}
}
export async function restoreBackup(userId: string | null, b: BackupInfo): Promise<boolean> {
  await createLocalSnapshot('Before restore');
  let data: unknown = null;
  if (b.local) data = (await readLocal()).find((x) => x.id === b.id)?.data;
  else if (supabase && userId) { const r = await supabase.from('settings_backups').select('data').eq('id', b.id).maybeSingle(); data = r.data?.data; }
  if (!data) return false;
  replaceLibrary(sanitizeLibrary(data), 'edit'); return true;
}

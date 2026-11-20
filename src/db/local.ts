import { openDb, type Db } from './driver';
import * as Crypto from 'expo-crypto';
import type { Adventure, Folder, Photo, Place, TrackPoint } from '../types';
import { pathLength, elevationGain, haversine } from '../lib/geo';

/**
 * Local-first store. EVERYTHING the user creates is written here first (works with no signal),
 * flagged `dirty`, and pushed to Supabase by src/db/sync.ts whenever a connection + account exist.
 */

let dbPromise: Promise<Db> | null = null;

export const newId = () => Crypto.randomUUID();
export const nowIso = () => new Date().toISOString();

const SCHEMA = `
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS folders (
  id TEXT PRIMARY KEY, user_id TEXT, name TEXT NOT NULL, icon TEXT NOT NULL DEFAULT 'folder',
  sort INTEGER NOT NULL DEFAULT 0, system_key TEXT, updated_at TEXT NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0, dirty INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS places (
  id TEXT PRIMARY KEY, user_id TEXT, name TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'creek',
  lat REAL NOT NULL, lng REAL NOT NULL, accuracy_m REAL, altitude_m REAL,
  description TEXT, water_notes TEXT, depth_notes TEXT, surroundings TEXT, notes TEXT,
  folder_id TEXT, visibility TEXT NOT NULL DEFAULT 'private', source_place_id TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0, dirty INTEGER NOT NULL DEFAULT 1, sync_error TEXT
);
CREATE INDEX IF NOT EXISTS places_geo ON places(lat, lng);
CREATE TABLE IF NOT EXISTS photos (
  id TEXT PRIMARY KEY, user_id TEXT, place_id TEXT, adventure_id TEXT,
  local_uri TEXT, storage_path TEXT, caption TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0, dirty INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS photos_place ON photos(place_id);
CREATE TABLE IF NOT EXISTS adventures (
  id TEXT PRIMARY KEY, user_id TEXT, name TEXT NOT NULL, notes TEXT,
  started_at TEXT NOT NULL, ended_at TEXT, distance_m REAL NOT NULL DEFAULT 0,
  duration_s INTEGER NOT NULL DEFAULT 0, elevation_gain_m REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'recording', updated_at TEXT NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0, dirty INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS visits (
  id TEXT PRIMARY KEY, place_id TEXT, name TEXT NOT NULL, kind TEXT, lat REAL NOT NULL, lng REAL NOT NULL, note TEXT, ts INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS trips (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, date TEXT NOT NULL, notes TEXT, stops TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY, cat TEXT NOT NULL, safety INTEGER NOT NULL DEFAULT 0, title TEXT NOT NULL, body TEXT, ref TEXT, dedupe TEXT UNIQUE, ts INTEGER NOT NULL, read INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS track_points (
  adventure_id TEXT NOT NULL, seq INTEGER NOT NULL, lat REAL NOT NULL, lng REAL NOT NULL,
  alt REAL, acc REAL, ts INTEGER NOT NULL, PRIMARY KEY (adventure_id, seq)
);
`;

export function getDb(): Promise<Db> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await openDb();
      await db.execAsync(SCHEMA);
      await migrate(db);
      await ensureDefaultFolders(db);
      return db;
    })();
  }
  return dbPromise;
}

// ------------------------------------------------------------------ change notifications
type Listener = () => void;
const listeners = new Set<Listener>();
let version = 0;
export const subscribeDb = (l: Listener) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const getDbVersion = () => version;
export function notifyDb() { version++; listeners.forEach((l) => l()); }

// ------------------------------------------------------------------ kv
export async function kvGet(key: string): Promise<string | null> {
  const db = await getDb();
  const r = await db.getFirstAsync<{ value: string }>('SELECT value FROM kv WHERE key = ?', key);
  return r?.value ?? null;
}
export async function kvSet(key: string, value: string | null) {
  const db = await getDb();
  if (value == null) await db.runAsync('DELETE FROM kv WHERE key = ?', key);
  else await db.runAsync('INSERT INTO kv(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', key, value);
}

// ------------------------------------------------------------------ folders
export const DEFAULT_FOLDERS = [
  { key: 'favorites', name: 'Favorite Creeks', icon: 'heart' },
  { key: 'swimming', name: 'Swimming Holes', icon: 'body' },
  { key: 'fishing', name: 'Fishing Spots', icon: 'fish' },
  { key: 'waterfalls', name: 'Waterfalls', icon: 'arrow-down-circle' },
  { key: 'gems', name: 'Hidden Gems', icon: 'diamond' },
  { key: 'explore', name: 'Places to Explore', icon: 'compass' },
  { key: 'camping', name: 'Camping Spots', icon: 'bonfire' },
];

async function addColumn(db: Db, table: string, col: string, ddl: string) {
  const cols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  if (!cols.some((c) => c.name === col)) await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${col} ${ddl}`);
}
/** Idempotent upgrades for databases created by older versions. */
async function migrate(db: Db) {
  await addColumn(db, 'places', 'favorite', 'INTEGER NOT NULL DEFAULT 0');
  await addColumn(db, 'places', 'tags', 'TEXT');
  await addColumn(db, 'places', 'rating', 'INTEGER');
  await addColumn(db, 'folders', 'color', 'TEXT');
  await addColumn(db, 'folders', 'parent_id', 'TEXT');
  await addColumn(db, 'folders', 'private', 'INTEGER NOT NULL DEFAULT 0');
}

async function ensureDefaultFolders(db: Db) {
  const done = await db.getFirstAsync<{ value: string }>("SELECT value FROM kv WHERE key='folders_seeded'");
  if (done) return;
  const t = nowIso();
  for (let i = 0; i < DEFAULT_FOLDERS.length; i++) {
    const f = DEFAULT_FOLDERS[i];
    // Deterministic ids so the same defaults on two devices merge instead of duplicating.
    await db.runAsync(
      'INSERT OR IGNORE INTO folders(id,user_id,name,icon,sort,system_key,updated_at,dirty) VALUES(?,?,?,?,?,?,?,1)',
      `sys-${f.key}`, null, f.name, f.icon, i, f.key, t,
    );
  }
  await db.runAsync("INSERT OR REPLACE INTO kv(key,value) VALUES('folders_seeded','1')");
}

export async function listFolders(): Promise<Folder[]> {
  const db = await getDb();
  return db.getAllAsync<Folder>('SELECT id,user_id,name,icon,sort,system_key,color,parent_id,private FROM folders WHERE deleted=0 ORDER BY sort, name');
}
export interface FolderOpts { icon?: string; color?: string | null; parent_id?: string | null; private?: boolean }
export async function createFolder(name: string, o: FolderOpts = {}): Promise<string> {
  const db = await getDb();
  const id = newId();
  const max = await db.getFirstAsync<{ m: number }>('SELECT COALESCE(MAX(sort),0) m FROM folders');
  await db.runAsync('INSERT INTO folders(id,user_id,name,icon,sort,color,parent_id,private,updated_at,dirty) VALUES(?,?,?,?,?,?,?,?,?,1)', id, null, name.trim(), o.icon ?? 'folder', (max?.m ?? 0) + 1, o.color ?? null, o.parent_id ?? null, o.private ? 1 : 0, nowIso());
  notifyDb();
  return id;
}
export async function updateFolder(id: string, patch: FolderOpts & { name?: string }) {
  const db = await getDb();
  const cur = await db.getFirstAsync<Folder>('SELECT * FROM folders WHERE id=?', id);
  if (!cur) return;
  // never allow a folder to become its own ancestor
  let parent = patch.parent_id === undefined ? cur.parent_id : patch.parent_id;
  for (let p = parent, n = 0; p && n < 20; n++) { if (p === id) { parent = cur.parent_id; break; } const r: { parent_id: string | null } | null = await db.getFirstAsync('SELECT parent_id FROM folders WHERE id=?', p); p = r?.parent_id ?? null; }
  await db.runAsync('UPDATE folders SET name=?,icon=?,color=?,parent_id=?,private=?,updated_at=?,dirty=1 WHERE id=?',
    (patch.name ?? cur.name).trim(), patch.icon ?? cur.icon, patch.color === undefined ? cur.color : patch.color, parent ?? null, patch.private === undefined ? cur.private : patch.private ? 1 : 0, nowIso(), id);
  if (patch.private) await db.runAsync("UPDATE places SET visibility='private',dirty=1,updated_at=? WHERE folder_id=? AND visibility='public'", nowIso(), id);
  notifyDb();
}
export async function renameFolder(id: string, name: string) { await updateFolder(id, { name }); }
export async function deleteFolder(id: string) {
  const db = await getDb();
  const t = nowIso();
  const cur = await db.getFirstAsync<Folder>('SELECT * FROM folders WHERE id=?', id);
  await db.runAsync('UPDATE folders SET deleted=1, dirty=1, updated_at=? WHERE id=?', t, id);
  await db.runAsync('UPDATE folders SET parent_id=?, dirty=1, updated_at=? WHERE parent_id=?', cur?.parent_id ?? null, t, id); // children move up one level
  await db.runAsync('UPDATE places SET folder_id=NULL, dirty=1, updated_at=? WHERE folder_id=?', t, id);
  notifyDb();
}
/** Is this place inside a private collection (directly or via a parent folder)? */
export async function isInPrivateCollection(folderId: string | null): Promise<boolean> {
  const db = await getDb();
  for (let f = folderId, n = 0; f && n < 20; n++) { const r = await db.getFirstAsync<{ private: number; parent_id: string | null }>('SELECT private,parent_id FROM folders WHERE id=?', f); if (!r) return false; if (r.private) return true; f = r.parent_id; }
  return false;
}

// ------------------------------------------------------------------ places
export type PlaceInput = Omit<Place, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'favorite' | 'tags' | 'rating'> & { id?: string; favorite?: number; tags?: string[]; rating?: number | null };

export async function countPlaces(): Promise<number> {
  const db = await getDb();
  const r = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) c FROM places WHERE deleted=0');
  return r?.c ?? 0;
}

export async function listPlaces(opts: { folderId?: string | null; search?: string } = {}): Promise<Place[]> {
  const db = await getDb();
  const where: string[] = ['deleted=0'];
  const args: (string | number)[] = [];
  if (opts.folderId === 'none') where.push('folder_id IS NULL');
  else if (opts.folderId) { where.push('folder_id=?'); args.push(opts.folderId); }
  if (opts.search?.trim()) {
    where.push('(name LIKE ? OR notes LIKE ? OR description LIKE ?)');
    const s = `%${opts.search.trim()}%`;
    args.push(s, s, s);
  }
  return db.getAllAsync<Place>(`SELECT * FROM places WHERE ${where.join(' AND ')} ORDER BY created_at DESC`, ...args);
}
export async function getPlace(id: string): Promise<Place | null> {
  const db = await getDb();
  return db.getFirstAsync<Place>('SELECT * FROM places WHERE id=? AND deleted=0', id);
}
export async function savePlace(input: PlaceInput): Promise<string> {
  const db = await getDb();
  const id = input.id ?? newId();
  const t = nowIso();
  const exists = await db.getFirstAsync('SELECT id FROM places WHERE id=?', id);
  if (exists) {
    await db.runAsync(
      `UPDATE places SET name=?,kind=?,lat=?,lng=?,accuracy_m=?,altitude_m=?,description=?,water_notes=?,depth_notes=?,surroundings=?,notes=?,folder_id=?,visibility=?,updated_at=?,dirty=1,sync_error=NULL WHERE id=?`,
      input.name.trim(), input.kind, input.lat, input.lng, input.accuracy_m, input.altitude_m, input.description, input.water_notes,
      input.depth_notes, input.surroundings, input.notes, input.folder_id, (await isInPrivateCollection(input.folder_id)) ? 'private' : input.visibility, t, id,
    );
    if (input.tags) await db.runAsync('UPDATE places SET tags=? WHERE id=?', input.tags.length ? JSON.stringify(input.tags) : null, id);
    if (input.favorite !== undefined) await db.runAsync('UPDATE places SET favorite=? WHERE id=?', input.favorite ? 1 : 0, id);
    if (input.rating !== undefined) await db.runAsync('UPDATE places SET rating=? WHERE id=?', input.rating, id);
  } else {
    await db.runAsync(
      `INSERT INTO places(id,user_id,name,kind,lat,lng,accuracy_m,altitude_m,description,water_notes,depth_notes,surroundings,notes,folder_id,visibility,source_place_id,favorite,tags,rating,created_at,updated_at,dirty)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`,
      id, null, input.name.trim(), input.kind, input.lat, input.lng, input.accuracy_m, input.altitude_m, input.description, input.water_notes,
      input.depth_notes, input.surroundings, input.notes, input.folder_id, (await isInPrivateCollection(input.folder_id)) ? 'private' : input.visibility, input.source_place_id, input.favorite ? 1 : 0, input.tags?.length ? JSON.stringify(input.tags) : null, input.rating ?? null, t, t,
    );
  }
  notifyDb();
  return id;
}
export async function deletePlace(id: string) {
  const db = await getDb();
  const t = nowIso();
  await db.runAsync('UPDATE places SET deleted=1,dirty=1,updated_at=? WHERE id=?', t, id);
  await db.runAsync('UPDATE photos SET deleted=1,dirty=1,updated_at=? WHERE place_id=?', t, id);
  notifyDb();
}
export async function movePlaceToFolder(id: string, folderId: string | null) {
  const db = await getDb();
  await db.runAsync('UPDATE places SET folder_id=?,dirty=1,updated_at=? WHERE id=?', folderId, nowIso(), id);
  if (await isInPrivateCollection(folderId)) await db.runAsync("UPDATE places SET visibility='private' WHERE id=?", id);
  notifyDb();
}
export async function setVisibility(id: string, v: 'private' | 'public') {
  const db = await getDb();
  if (v === 'public') { const r = await db.getFirstAsync<{ folder_id: string | null }>('SELECT folder_id FROM places WHERE id=?', id); if (await isInPrivateCollection(r?.folder_id ?? null)) return; }
  await db.runAsync('UPDATE places SET visibility=?,dirty=1,updated_at=?,sync_error=NULL WHERE id=?', v, nowIso(), id);
  notifyDb();
}

export async function setFavorite(id: string, v: boolean) { const db = await getDb(); await db.runAsync('UPDATE places SET favorite=?,dirty=1,updated_at=? WHERE id=?', v ? 1 : 0, nowIso(), id); notifyDb(); }
export async function setPlaceTags(id: string, tags: string[]) { const db = await getDb(); await db.runAsync('UPDATE places SET tags=?,dirty=1,updated_at=? WHERE id=?', tags.length ? JSON.stringify(tags) : null, nowIso(), id); notifyDb(); }
export async function setPlaceRating(id: string, r: number | null) { const db = await getDb(); await db.runAsync('UPDATE places SET rating=?,dirty=1,updated_at=? WHERE id=?', r, nowIso(), id); notifyDb(); }
export const parseTags = (t: string | null | undefined): string[] => { try { const a = t ? JSON.parse(t) : []; return Array.isArray(a) ? a.filter((x) => typeof x === 'string') : []; } catch { return []; } };
export async function allTags(): Promise<string[]> {
  const db = await getDb(); const rows = await db.getAllAsync<{ tags: string | null }>('SELECT tags FROM places WHERE deleted=0 AND tags IS NOT NULL');
  const set = new Set<string>(); for (const r of rows) for (const t of parseTags(r.tags)) set.add(t); return [...set].sort((a, b) => a.localeCompare(b));
}

// ------------------------------------------------------------------ visits ("historical visits" + recently visited)
export interface Visit { id: string; place_id: string | null; name: string; kind: string | null; lat: number; lng: number; note: string | null; ts: number }
export async function addVisit(v: { place_id?: string | null; name: string; kind?: string | null; lat: number; lng: number; note?: string | null }): Promise<string> {
  const db = await getDb(); const id = newId();
  await db.runAsync('INSERT INTO visits(id,place_id,name,kind,lat,lng,note,ts) VALUES(?,?,?,?,?,?,?,?)', id, v.place_id ?? null, v.name, v.kind ?? null, v.lat, v.lng, v.note ?? null, Date.now());
  notifyDb(); return id;
}
export async function listVisits(limit = 50): Promise<Visit[]> { const db = await getDb(); return db.getAllAsync<Visit>('SELECT * FROM visits ORDER BY ts DESC LIMIT ?', limit); }
export async function visitsNear(lat: number, lng: number, radiusM = 150): Promise<Visit[]> {
  const d = radiusM / 111000; const db = await getDb();
  const rows = await db.getAllAsync<Visit>('SELECT * FROM visits WHERE lat BETWEEN ? AND ? AND lng BETWEEN ? AND ? ORDER BY ts DESC', lat - d, lat + d, lng - d * 1.6, lng + d * 1.6);
  return rows.filter((r) => haversine({ lat, lng }, r) <= radiusM);
}
export async function deleteVisit(id: string) { const db = await getDb(); await db.runAsync('DELETE FROM visits WHERE id=?', id); notifyDb(); }

// ------------------------------------------------------------------ trips (trip planner)
export interface TripStop { name: string; lat: number; lng: number; placeId?: string }
export interface Trip { id: string; name: string; date: string; notes: string | null; stops: TripStop[]; created_at: string }
const toTrip = (r: any): Trip => ({ ...r, stops: (() => { try { return JSON.parse(r.stops); } catch { return []; } })() });
export async function listTrips(): Promise<Trip[]> { const db = await getDb(); return (await db.getAllAsync<any>('SELECT * FROM trips ORDER BY date ASC')).map(toTrip); }
export async function saveTrip(t: { id?: string; name: string; date: string; notes?: string | null; stops: TripStop[] }): Promise<string> {
  const db = await getDb(); const id = t.id ?? newId();
  const ex = await db.getFirstAsync('SELECT id FROM trips WHERE id=?', id);
  if (ex) await db.runAsync('UPDATE trips SET name=?,date=?,notes=?,stops=? WHERE id=?', t.name.trim(), t.date, t.notes ?? null, JSON.stringify(t.stops), id);
  else await db.runAsync('INSERT INTO trips(id,name,date,notes,stops,created_at) VALUES(?,?,?,?,?,?)', id, t.name.trim(), t.date, t.notes ?? null, JSON.stringify(t.stops), nowIso());
  notifyDb(); return id;
}
export async function deleteTrip(id: string) { const db = await getDb(); await db.runAsync('DELETE FROM trips WHERE id=?', id); notifyDb(); }

// ------------------------------------------------------------------ notification inbox
export interface AppNotification { id: string; cat: string; safety: number; title: string; body: string | null; ref: string | null; ts: number; read: number }
export async function addNotification(n: { cat: string; safety: boolean; title: string; body?: string | null; ref?: string | null; dedupe: string }): Promise<boolean> {
  const db = await getDb();
  const ex = await db.getFirstAsync('SELECT id FROM notifications WHERE dedupe=?', n.dedupe); if (ex) return false;
  await db.runAsync('INSERT INTO notifications(id,cat,safety,title,body,ref,dedupe,ts,read) VALUES(?,?,?,?,?,?,?,?,0)', newId(), n.cat, n.safety ? 1 : 0, n.title, n.body ?? null, n.ref ?? null, n.dedupe, Date.now());
  notifyDb(); return true;
}
export async function listNotifications(limit = 100): Promise<AppNotification[]> { const db = await getDb(); return db.getAllAsync<AppNotification>('SELECT * FROM notifications ORDER BY ts DESC LIMIT ?', limit); }
export async function unreadCount(): Promise<number> { const db = await getDb(); const r = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) c FROM notifications WHERE read=0'); return r?.c ?? 0; }
export async function markAllRead() { const db = await getDb(); await db.runAsync('UPDATE notifications SET read=1 WHERE read=0'); notifyDb(); }
export async function clearNotifications() { const db = await getDb(); await db.runAsync('DELETE FROM notifications'); notifyDb(); }

// ------------------------------------------------------------------ photos
export async function listPhotos(placeId?: string | null, adventureId?: string | null): Promise<Photo[]> {
  const db = await getDb();
  if (placeId) return db.getAllAsync<Photo>('SELECT * FROM photos WHERE deleted=0 AND place_id=? ORDER BY created_at', placeId);
  if (adventureId) return db.getAllAsync<Photo>('SELECT * FROM photos WHERE deleted=0 AND adventure_id=? ORDER BY created_at', adventureId);
  return db.getAllAsync<Photo>('SELECT * FROM photos WHERE deleted=0 ORDER BY created_at DESC');
}
export async function firstPhotos(): Promise<Record<string, Photo>> {
  const db = await getDb();
  const rows = await db.getAllAsync<Photo>('SELECT * FROM photos WHERE deleted=0 AND place_id IS NOT NULL ORDER BY created_at DESC');
  const m: Record<string, Photo> = {};
  for (const r of rows) if (r.place_id) m[r.place_id] = r;
  return m;
}
export async function addPhoto(p: { place_id?: string | null; adventure_id?: string | null; local_uri: string; caption?: string | null }): Promise<string> {
  const db = await getDb();
  const id = newId();
  const t = nowIso();
  await db.runAsync('INSERT INTO photos(id,place_id,adventure_id,local_uri,caption,created_at,updated_at,dirty) VALUES(?,?,?,?,?,?,?,1)', id, p.place_id ?? null, p.adventure_id ?? null, p.local_uri, p.caption ?? null, t, t);
  notifyDb();
  return id;
}
export async function deletePhoto(id: string) {
  const db = await getDb();
  await db.runAsync('UPDATE photos SET deleted=1,dirty=1,updated_at=? WHERE id=?', nowIso(), id);
  notifyDb();
}

// ------------------------------------------------------------------ adventures + tracking
export async function listAdventures(): Promise<Adventure[]> {
  const db = await getDb();
  return db.getAllAsync<Adventure>('SELECT id,user_id,name,notes,started_at,ended_at,distance_m,duration_s,elevation_gain_m,status FROM adventures WHERE deleted=0 ORDER BY started_at DESC');
}
export async function getAdventure(id: string): Promise<Adventure | null> {
  const db = await getDb();
  return db.getFirstAsync<Adventure>('SELECT id,user_id,name,notes,started_at,ended_at,distance_m,duration_s,elevation_gain_m,status FROM adventures WHERE id=? AND deleted=0', id);
}
export async function getTrackPoints(adventureId: string): Promise<TrackPoint[]> {
  const db = await getDb();
  return db.getAllAsync<TrackPoint>('SELECT seq,lat,lng,alt,acc,ts FROM track_points WHERE adventure_id=? ORDER BY seq', adventureId);
}
export async function startAdventure(name?: string): Promise<string> {
  const db = await getDb();
  const id = newId();
  const t = nowIso();
  const label = name?.trim() || `Adventure ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
  await db.runAsync("INSERT INTO adventures(id,name,started_at,status,updated_at,dirty) VALUES(?,?,?,'recording',?,0)", id, label, t, t);
  await kvSet('active_adventure', id);
  notifyDb();
  return id;
}
export async function getActiveAdventureId(): Promise<string | null> {
  return kvGet('active_adventure');
}

const MAX_ACCURACY_M = 60;     // ignore very poor fixes
const MIN_STEP_M = 4;          // ignore jitter while standing still

export interface RawFix { lat: number; lng: number; alt: number | null; acc: number | null; ts: number }

/** Called from the background location task AND the foreground fallback. Works fully offline. */
export async function recordFixes(adventureId: string, fixes: RawFix[]) {
  const db = await getDb();
  const adv = await db.getFirstAsync<{ distance_m: number }>("SELECT distance_m FROM adventures WHERE id=? AND status='recording'", adventureId);
  if (!adv) return;
  let last = await db.getFirstAsync<{ seq: number; lat: number; lng: number }>('SELECT seq,lat,lng FROM track_points WHERE adventure_id=? ORDER BY seq DESC LIMIT 1', adventureId);
  let dist = adv.distance_m;
  let seq = last?.seq ?? -1;
  const sorted = [...fixes].sort((a, b) => a.ts - b.ts);
  for (const f of sorted) {
    if (f.acc != null && f.acc > MAX_ACCURACY_M) continue;
    if (last) {
      const d = haversine(last, f);
      if (d < MIN_STEP_M) continue;
      dist += d;
    }
    seq += 1;
    await db.runAsync('INSERT OR IGNORE INTO track_points(adventure_id,seq,lat,lng,alt,acc,ts) VALUES(?,?,?,?,?,?,?)', adventureId, seq, f.lat, f.lng, f.alt, f.acc, f.ts);
    last = { seq, lat: f.lat, lng: f.lng };
  }
  await db.runAsync('UPDATE adventures SET distance_m=? WHERE id=?', dist, adventureId);
  notifyDb();
}

export async function finishAdventure(id: string, opts: { name?: string; notes?: string | null } = {}) {
  const db = await getDb();
  const pts = await getTrackPoints(id);
  const adv = await getAdventure(id);
  if (!adv) return;
  const end = nowIso();
  const duration = Math.max(0, Math.round((Date.now() - new Date(adv.started_at).getTime()) / 1000));
  const dist = pathLength(pts);
  const gain = elevationGain(pts.map((p) => p.alt));
  await db.runAsync(
    "UPDATE adventures SET status='finished', ended_at=?, duration_s=?, distance_m=?, elevation_gain_m=?, name=?, notes=?, updated_at=?, dirty=1 WHERE id=?",
    end, duration, dist, gain, opts.name?.trim() || adv.name, opts.notes ?? adv.notes, end, id,
  );
  if ((await kvGet('active_adventure')) === id) await kvSet('active_adventure', null);
  notifyDb();
}
export async function discardAdventure(id: string) {
  const db = await getDb();
  await db.runAsync('DELETE FROM track_points WHERE adventure_id=?', id);
  await db.runAsync('DELETE FROM adventures WHERE id=?', id);
  if ((await kvGet('active_adventure')) === id) await kvSet('active_adventure', null);
  notifyDb();
}
export async function updateAdventure(id: string, patch: { name?: string; notes?: string | null }) {
  const db = await getDb();
  const a = await getAdventure(id);
  if (!a) return;
  await db.runAsync('UPDATE adventures SET name=?,notes=?,updated_at=?,dirty=1 WHERE id=?', patch.name?.trim() || a.name, patch.notes === undefined ? a.notes : patch.notes, nowIso(), id);
  notifyDb();
}
export async function deleteAdventure(id: string) {
  const db = await getDb();
  await db.runAsync('UPDATE adventures SET deleted=1,dirty=1,updated_at=? WHERE id=?', nowIso(), id);
  notifyDb();
}
export async function countAdventures(): Promise<number> {
  const db = await getDb();
  const r = await db.getFirstAsync<{ c: number }>("SELECT COUNT(*) c FROM adventures WHERE deleted=0 AND status='finished'");
  return r?.c ?? 0;
}

/** Wipe all local user data (sign-out on shared device / account deletion). */
export async function wipeLocal() {
  const db = await getDb();
  await db.execAsync('DELETE FROM places; DELETE FROM photos; DELETE FROM adventures; DELETE FROM track_points; DELETE FROM folders; DELETE FROM visits; DELETE FROM trips; DELETE FROM notifications; DELETE FROM kv WHERE key IN (\'folders_seeded\',\'sync_cursor\',\'active_adventure\');');
  await ensureDefaultFolders(db);
  notifyDb();
}

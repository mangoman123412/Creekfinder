import { supabase } from '../lib/supabase';
import { getDb, kvGet, kvSet, notifyDb, getTrackPoints } from './local';
import { removeLocalFile, readBytes } from '../lib/photos';

export interface SyncResult { pushed: number; pulled: number; errors: string[] }

let running: Promise<SyncResult> | null = null;

/** Push local changes then pull remote ones. Safe to call repeatedly; concurrent calls share one run. */
export function syncNow(userId: string): Promise<SyncResult> {
  if (!running) running = doSync(userId).finally(() => { running = null; });
  return running;
}

async function doSync(uid: string): Promise<SyncResult> {
  const res: SyncResult = { pushed: 0, pulled: 0, errors: [] };
  if (!supabase) return res;
  const db = await getDb();

  // 1. Anything created while signed out (or offline before sign-in) now belongs to this account.
  for (const t of ['folders', 'places', 'photos', 'adventures']) {
    await db.runAsync(`UPDATE ${t} SET user_id=? WHERE user_id IS NULL`, uid);
  }

  // 2. PUSH — folders
  const folders = await db.getAllAsync<any>('SELECT * FROM folders WHERE dirty=1');
  for (const f of folders) {
    const { error } = await supabase.from('folders').upsert({
      user_id: uid, id: f.id, name: f.name, icon: f.icon, sort: f.sort, system_key: f.system_key, deleted_at: f.deleted ? new Date().toISOString() : null,
    });
    if (error) res.errors.push(`folder: ${error.message}`);
    else { await db.runAsync('UPDATE folders SET dirty=0 WHERE id=? AND updated_at=?', f.id, f.updated_at); res.pushed++; }
  }

  // places
  const places = await db.getAllAsync<any>('SELECT * FROM places WHERE dirty=1');
  for (const p of places) {
    const { error } = await supabase.from('places').upsert({
      id: p.id, user_id: uid, name: p.name, kind: p.kind, lat: p.lat, lng: p.lng, accuracy_m: p.accuracy_m, altitude_m: p.altitude_m,
      description: p.description, water_notes: p.water_notes, depth_notes: p.depth_notes, surroundings: p.surroundings, notes: p.notes,
      folder_id: p.folder_id, visibility: p.visibility, source_place_id: p.source_place_id, created_at: p.created_at,
      deleted_at: p.deleted ? new Date().toISOString() : null,
    });
    if (error) {
      const msg = error.message.includes('FREE_LIMIT_REACHED') ? 'FREE_LIMIT_REACHED' : error.message;
      await db.runAsync('UPDATE places SET sync_error=? WHERE id=?', msg, p.id);
      res.errors.push(`place "${p.name}": ${msg}`);
    } else { await db.runAsync('UPDATE places SET dirty=0, sync_error=NULL WHERE id=? AND updated_at=?', p.id, p.updated_at); res.pushed++; }
  }

  // photos (upload the file first, then the row)
  const photos = await db.getAllAsync<any>(`SELECT ph.* FROM photos ph LEFT JOIN places pl ON pl.id=ph.place_id
     WHERE ph.dirty=1 AND (ph.place_id IS NULL OR pl.sync_error IS NULL)`);
  for (const ph of photos) {
    try {
      if (ph.deleted) {
        if (ph.storage_path) {
          await supabase.storage.from('photos').remove([ph.storage_path]);
          await supabase.from('photos').update({ deleted_at: new Date().toISOString() }).eq('id', ph.id);
        }
        removeLocalFile(ph.local_uri);
        await db.runAsync('UPDATE photos SET dirty=0 WHERE id=?', ph.id);
        res.pushed++;
        continue;
      }
      let path = ph.storage_path as string | null;
      if (!path) {
        if (!ph.local_uri) continue;
        const bytes = await readBytes(ph.local_uri);
        path = `${uid}/${ph.id}.jpg`;
        const up = await supabase.storage.from('photos').upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
        if (up.error) throw up.error;
      }
      const { error } = await supabase.from('photos').upsert({
        id: ph.id, user_id: uid, place_id: ph.place_id, adventure_id: ph.adventure_id, storage_path: path, caption: ph.caption, created_at: ph.created_at,
      });
      if (error) throw error;
      await db.runAsync('UPDATE photos SET dirty=0, storage_path=? WHERE id=?', path, ph.id);
      res.pushed++;
    } catch (e: any) {
      res.errors.push(`photo: ${e?.message ?? e}`);
    }
  }

  // adventures (only finished ones; track is stored as compact JSON)
  const advs = await db.getAllAsync<any>("SELECT * FROM adventures WHERE dirty=1 AND status='finished'");
  for (const a of advs) {
    const pts = await getTrackPoints(a.id);
    const { error } = await supabase.from('adventures').upsert({
      id: a.id, user_id: uid, name: a.name, notes: a.notes, started_at: a.started_at, ended_at: a.ended_at, distance_m: a.distance_m,
      duration_s: a.duration_s, elevation_gain_m: a.elevation_gain_m, track: pts.map((p) => [p.lat, p.lng, p.alt, p.ts]),
      deleted_at: a.deleted ? new Date().toISOString() : null,
    });
    if (error) res.errors.push(`adventure: ${error.message}`);
    else { await db.runAsync('UPDATE adventures SET dirty=0 WHERE id=? AND updated_at=?', a.id, a.updated_at); res.pushed++; }
  }

  // 3. PULL — rows changed on other devices (or a reinstall)
  try {
    res.pulled += await pull(uid, 'folders', async (r) => {
      const local = await db.getFirstAsync<{ dirty: number }>('SELECT dirty FROM folders WHERE id=?', r.id);
      if (local?.dirty) return false;
      await db.runAsync(
        `INSERT INTO folders(id,user_id,name,icon,sort,system_key,updated_at,deleted,dirty) VALUES(?,?,?,?,?,?,?,?,0)
         ON CONFLICT(id) DO UPDATE SET name=excluded.name,icon=excluded.icon,sort=excluded.sort,updated_at=excluded.updated_at,deleted=excluded.deleted,user_id=excluded.user_id`,
        r.id, uid, r.name, r.icon, r.sort, r.system_key, r.updated_at, r.deleted_at ? 1 : 0);
      return true;
    });
    res.pulled += await pull(uid, 'places', async (r) => {
      const local = await db.getFirstAsync<{ dirty: number }>('SELECT dirty FROM places WHERE id=?', r.id);
      if (local?.dirty) return false;
      await db.runAsync(
        `INSERT INTO places(id,user_id,name,kind,lat,lng,accuracy_m,altitude_m,description,water_notes,depth_notes,surroundings,notes,folder_id,visibility,source_place_id,created_at,updated_at,deleted,dirty)
         VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0)
         ON CONFLICT(id) DO UPDATE SET name=excluded.name,kind=excluded.kind,lat=excluded.lat,lng=excluded.lng,accuracy_m=excluded.accuracy_m,altitude_m=excluded.altitude_m,
           description=excluded.description,water_notes=excluded.water_notes,depth_notes=excluded.depth_notes,surroundings=excluded.surroundings,notes=excluded.notes,
           folder_id=excluded.folder_id,visibility=excluded.visibility,updated_at=excluded.updated_at,deleted=excluded.deleted`,
        r.id, uid, r.name, r.kind, r.lat, r.lng, r.accuracy_m, r.altitude_m, r.description, r.water_notes, r.depth_notes, r.surroundings, r.notes,
        r.folder_id, r.visibility, r.source_place_id, r.created_at, r.updated_at, r.deleted_at ? 1 : 0);
      return true;
    });
    res.pulled += await pull(uid, 'photos', async (r) => {
      const local = await db.getFirstAsync<{ dirty: number }>('SELECT dirty FROM photos WHERE id=?', r.id);
      if (local?.dirty) return false;
      await db.runAsync(
        `INSERT INTO photos(id,user_id,place_id,adventure_id,storage_path,caption,created_at,updated_at,deleted,dirty) VALUES(?,?,?,?,?,?,?,?,?,0)
         ON CONFLICT(id) DO UPDATE SET storage_path=excluded.storage_path,caption=excluded.caption,deleted=excluded.deleted,updated_at=excluded.updated_at`,
        r.id, uid, r.place_id, r.adventure_id, r.storage_path, r.caption, r.created_at, r.updated_at, r.deleted_at ? 1 : 0);
      return true;
    });
    res.pulled += await pull(uid, 'adventures', async (r) => {
      const local = await db.getFirstAsync<{ dirty: number }>('SELECT dirty FROM adventures WHERE id=?', r.id);
      if (local?.dirty) return false;
      await db.runAsync(
        `INSERT INTO adventures(id,user_id,name,notes,started_at,ended_at,distance_m,duration_s,elevation_gain_m,status,updated_at,deleted,dirty) VALUES(?,?,?,?,?,?,?,?,?,'finished',?,?,0)
         ON CONFLICT(id) DO UPDATE SET name=excluded.name,notes=excluded.notes,updated_at=excluded.updated_at,deleted=excluded.deleted`,
        r.id, uid, r.name, r.notes, r.started_at, r.ended_at, r.distance_m, r.duration_s, r.elevation_gain_m, r.updated_at, r.deleted_at ? 1 : 0);
      const has = await db.getFirstAsync('SELECT 1 FROM track_points WHERE adventure_id=? LIMIT 1', r.id);
      if (!has && Array.isArray(r.track)) {
        let seq = 0;
        for (const p of r.track as [number, number, number | null, number][]) {
          await db.runAsync('INSERT OR IGNORE INTO track_points(adventure_id,seq,lat,lng,alt,acc,ts) VALUES(?,?,?,?,?,NULL,?)', r.id, seq++, p[0], p[1], p[2], p[3]);
        }
      }
      return true;
    });
  } catch (e: any) {
    res.errors.push(`pull: ${e?.message ?? e}`);
  }

  await kvSet('last_sync', new Date().toISOString());
  notifyDb();
  return res;
}

async function pull(uid: string, table: string, apply: (row: any) => Promise<boolean>): Promise<number> {
  const cursorKey = `cursor_${table}`;
  let cursor = (await kvGet(cursorKey)) ?? '1970-01-01T00:00:00Z';
  let n = 0;
  for (;;) {
    const q = supabase!.from(table).select('*').eq('user_id', uid).gt('updated_at', cursor).order('updated_at', { ascending: true }).limit(200);
    const { data, error } = await q;
    if (error) throw error;
    if (!data?.length) break;
    for (const row of data) { if (await apply(row)) n++; }
    cursor = data[data.length - 1].updated_at;
    await kvSet(cursorKey, cursor);
    if (data.length < 200) break;
  }
  return n;
}

export async function pendingCount(): Promise<number> {
  const db = await getDb();
  const r = await db.getFirstAsync<{ c: number }>(`SELECT
    (SELECT COUNT(*) FROM places WHERE dirty=1)+(SELECT COUNT(*) FROM photos WHERE dirty=1)+
    (SELECT COUNT(*) FROM folders WHERE dirty=1)+(SELECT COUNT(*) FROM adventures WHERE dirty=1 AND status='finished') c`);
  return r?.c ?? 0;
}

import type { Folder, Place } from '../types';
import { haversine } from '../lib/geo';
import type { Saved } from './schema';

export interface FolderNode { folder: Folder; depth: number }
/** Flatten folders into display order (parents before children) with depth for indentation. */
export function flattenFolders(folders: Folder[]): FolderNode[] {
  const byParent = new Map<string | null, Folder[]>();
  const ids = new Set(folders.map((f) => f.id));
  for (const f of folders) { const p = f.parent_id && ids.has(f.parent_id) ? f.parent_id : null; if (!byParent.has(p)) byParent.set(p, []); byParent.get(p)!.push(f); }
  const out: FolderNode[] = []; const seen = new Set<string>();
  const walk = (p: string | null, depth: number) => { for (const f of (byParent.get(p) ?? []).sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name))) { if (seen.has(f.id) || depth > 8) continue; seen.add(f.id); out.push({ folder: f, depth }); walk(f.id, depth + 1); } };
  walk(null, 0);
  return out;
}
export function descendantIds(folders: Folder[], id: string): string[] {
  const out = [id]; const q = [id];
  while (q.length) { const cur = q.shift()!; for (const f of folders) if (f.parent_id === cur && !out.includes(f.id)) { out.push(f.id); q.push(f.id); } }
  return out;
}
export function folderPath(folders: Folder[], id: string | null): string {
  const names: string[] = []; let cur = folders.find((f) => f.id === id); let n = 0;
  while (cur && n++ < 10) { names.unshift(cur.name); cur = folders.find((f) => f.id === cur!.parent_id); }
  return names.join(' › ');
}

export interface SortOpts { sort: Saved['sort']; dir: Saved['dir']; me?: { lat: number; lng: number } | null; favoritesFirst?: boolean }
/** Sort saved places by date, distance, name, personal rating or elevation (missing values always sort last). */
export function sortPlaces(list: Place[], o: SortOpts): Place[] {
  const sign = o.dir === 'asc' ? 1 : -1;
  const key = (p: Place): number | string | null => {
    switch (o.sort) {
      case 'name': return p.name.toLowerCase();
      case 'distance': return o.me ? haversine(o.me, p) : null;
      case 'rating': return p.rating ?? null;
      case 'elevation': return p.altitude_m ?? null;
      default: return new Date(p.created_at).getTime();
    }
  };
  return [...list].sort((a, b) => {
    if (o.favoritesFirst && a.favorite !== b.favorite) return b.favorite - a.favorite;
    const ka = key(a), kb = key(b);
    if (ka == null && kb == null) return 0; if (ka == null) return 1; if (kb == null) return -1;
    return (ka < kb ? -1 : ka > kb ? 1 : 0) * sign;
  });
}
export interface FilterOpts { folderIds?: string[] | 'none' | null; tag?: string | null; favoritesOnly?: boolean; kind?: string | null; search?: string }
export function filterPlaces(list: Place[], f: FilterOpts, tagsOf: (p: Place) => string[]): Place[] {
  const s = f.search?.trim().toLowerCase();
  return list.filter((p) => {
    if (f.folderIds === 'none' && p.folder_id) return false;
    if (Array.isArray(f.folderIds) && !(p.folder_id && f.folderIds.includes(p.folder_id))) return false;
    if (f.favoritesOnly && !p.favorite) return false;
    if (f.tag && !tagsOf(p).includes(f.tag)) return false;
    if (f.kind && p.kind !== f.kind) return false;
    if (s && !`${p.name} ${p.notes ?? ''} ${p.description ?? ''} ${tagsOf(p).join(' ')}`.toLowerCase().includes(s)) return false;
    return true;
  });
}
export const FOLDER_ICONS = ['folder', 'heart', 'body', 'fish', 'arrow-down-circle', 'diamond', 'compass', 'bonfire', 'star', 'leaf', 'water', 'camera', 'walk', 'bicycle', 'boat', 'home', 'flag', 'lock-closed', 'sunny', 'moon', 'paw', 'flame', 'rose', 'trophy'];
export const FOLDER_COLORS = ['#1F5A43', '#3C9C73', '#1B8FD0', '#2F6FDB', '#8E44AD', '#D9562B', '#D98E1F', '#C8402F', '#7A5C3A', '#5B6961'];

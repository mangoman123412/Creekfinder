import { useSyncExternalStore } from 'react';
import {
  DEFAULTS, OFFICIAL_MAP_PRESETS, defaultLibrary, sanitize, sanitizeLibrary, sanitizeMapPreset, sanitizeTheme, type AppProfile, type Library, type MapPreset, type SavedTheme, type Settings, type ThemeSpec,
} from './schema';

/**
 * The single source of truth for ALL customization. Everything the user can change lives in `Library`:
 *   profiles[] (each a complete Settings snapshot) · saved themes · saved map presets.
 * The active profile's settings ARE the live app settings — editing settings edits the active profile.
 * Persisted locally (works offline), synced to the account by custom/sync.ts.
 */

const LS_KEY = 'cf_library_v3';
let lib: Library = loadSync();
let hydrated = false;
const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let persistHook: ((l: Library) => void) | null = null;   // set by custom/persist.ts (SQLite) — keeps this file dependency-free for tests
let changeHook: ((l: Library, reason: string) => void) | null = null; // cloud sync

function loadSync(): Library {
  try { if (typeof localStorage !== 'undefined') { const raw = localStorage.getItem(LS_KEY); if (raw) return sanitizeLibrary(JSON.parse(raw)); } } catch {}
  return defaultLibrary();
}
export function setPersistHook(h: typeof persistHook) { persistHook = h; }
export function setChangeHook(h: typeof changeHook) { changeHook = h; }

function emit(reason = 'edit') {
  listeners.forEach((l) => l());
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { if (typeof localStorage !== 'undefined') localStorage.setItem(LS_KEY, JSON.stringify(lib)); } catch {}
    try { persistHook?.(lib); } catch {}
  }, 250);
  if (reason !== 'remote') changeHook?.(lib, reason);
}
function commit(next: Library, reason = 'edit') { lib = { ...next, updatedAt: Date.now() }; emit(reason); }

export const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const getLibrary = () => lib;
export const isHydrated = () => hydrated;
export const activeProfile = (): AppProfile => lib.profiles.find((p) => p.id === lib.activeProfileId) ?? lib.profiles[0];
export const getSettings = (): Settings => activeProfile().settings;

export function hydrateFrom(raw: unknown) {
  if (raw) { try { const incoming = sanitizeLibrary(raw); if (incoming.updatedAt >= lib.updatedAt) { lib = incoming; } } catch {} }
  hydrated = true; emit('remote');
}

export const useLibrary = () => useSyncExternalStore(subscribe, getLibrary, getLibrary);
export const useSettings = () => useSyncExternalStore(subscribe, getSettings, getSettings);

// ------------------------------------------------------------------ editing
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

/** Change settings of the active profile. `fn` mutates a draft; the result is validated before it is stored. */
export function mutate(fn: (draft: Settings) => void, reason = 'edit') {
  const p = activeProfile(); const draft = clone(p.settings); fn(draft);
  commit({ ...lib, profiles: lib.profiles.map((x) => (x.id === p.id ? { ...x, settings: sanitize(draft) } : x)) }, reason);
}
export function setSettings(next: Settings, reason = 'edit') { const p = activeProfile(); commit({ ...lib, profiles: lib.profiles.map((x) => (x.id === p.id ? { ...x, settings: sanitize(next) } : x)) }, reason); }

export type SectionKey = keyof Settings;
export function resetSection(key: SectionKey) { const d = DEFAULTS(); mutate((s) => { (s as any)[key] = (d as any)[key]; }, 'reset'); }
export function resetAll() { setSettings(DEFAULTS(), 'reset'); }

// ------------------------------------------------------------------ profiles
const uid = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
export function switchProfile(id: string) { if (lib.profiles.some((p) => p.id === id)) commit({ ...lib, activeProfileId: id }, 'profile'); }
export function createProfile(name: string, icon = 'leaf', from?: Settings): string {
  const id = uid('profile'); commit({ ...lib, profiles: [...lib.profiles, { id, name: name.trim().slice(0, 30) || 'New profile', icon, settings: sanitize(from ?? getSettings()) }], activeProfileId: id }, 'profile'); return id;
}
export const duplicateProfile = (id: string) => { const p = lib.profiles.find((x) => x.id === id); return p ? createProfile(`${p.name} copy`, p.icon, p.settings) : null; };
export function updateProfileMeta(id: string, patch: { name?: string; icon?: string }) {
  commit({ ...lib, profiles: lib.profiles.map((p) => (p.id === id ? { ...p, name: patch.name?.trim().slice(0, 30) || p.name, icon: patch.icon ?? p.icon } : p)) }, 'profile');
}
export function deleteProfile(id: string): boolean {
  if (lib.profiles.length <= 1) return false;
  const profiles = lib.profiles.filter((p) => p.id !== id);
  commit({ ...lib, profiles, activeProfileId: lib.activeProfileId === id ? profiles[0].id : lib.activeProfileId }, 'profile'); return true;
}
export function addImportedProfile(p: { name: string; icon: string; settings: unknown }): string {
  const id = uid('profile'); commit({ ...lib, profiles: [...lib.profiles, { id, name: p.name.slice(0, 30), icon: p.icon, settings: sanitize(p.settings) }] }, 'import'); return id;
}

// ------------------------------------------------------------------ themes
export function saveTheme(name: string, spec: ThemeSpec): string {
  const id = uid('theme'); const t: SavedTheme = { id, name: name.trim().slice(0, 40) || 'My theme', spec: sanitizeTheme(clone(spec)) };
  commit({ ...lib, themes: [...lib.themes, t] }, 'theme'); return id;
}
export const deleteTheme = (id: string) => commit({ ...lib, themes: lib.themes.filter((t) => t.id !== id) }, 'theme');
export const applyThemeSpec = (spec: ThemeSpec) => mutate((s) => { s.theme = sanitizeTheme(clone(spec)); });

// ------------------------------------------------------------------ map presets
export const allMapPresets = (l: Library = lib): MapPreset[] => [...OFFICIAL_MAP_PRESETS, ...l.mapPresets];
export const getMapPreset = (id?: string, l: Library = lib): MapPreset => allMapPresets(l).find((p) => p.id === (id ?? getSettings().mapPresetId)) ?? OFFICIAL_MAP_PRESETS[0];
export function saveMapPreset(p: MapPreset, select = false): string {
  const clean = sanitizeMapPreset({ ...p, official: false });
  const exists = lib.mapPresets.some((x) => x.id === clean.id);
  commit({ ...lib, mapPresets: exists ? lib.mapPresets.map((x) => (x.id === clean.id ? clean : x)) : [...lib.mapPresets, clean] }, 'map');
  if (select) mutate((s) => { s.mapPresetId = clean.id; }, 'map');
  return clean.id;
}
export function createMapPreset(name: string, from?: MapPreset): string { const base = from ?? getMapPreset(); return saveMapPreset({ ...clone(base), id: uid('map'), name: name.trim().slice(0, 40) || 'My map', official: false }, true); }
export function deleteMapPreset(id: string) {
  commit({ ...lib, mapPresets: lib.mapPresets.filter((p) => p.id !== id) }, 'map');
  if (getSettings().mapPresetId === id) mutate((s) => { s.mapPresetId = 'map-default'; });
}
export const switchMapPreset = (id: string) => mutate((s) => { s.mapPresetId = id; }, 'map');
/** Edit the active map preset. Built-in presets are never changed: the first edit forks a personal copy. */
export function updateActiveMapPreset(fn: (p: MapPreset) => void) {
  const cur = getMapPreset(); const draft = clone(cur); fn(draft);
  if (cur.official) { draft.id = uid('map'); draft.official = false; draft.name = `${cur.name} (mine)`; }
  saveMapPreset(draft, true);
}

export function replaceLibrary(next: Library, reason = 'remote') { lib = { ...sanitizeLibrary(next) }; emit(reason); }
export const _resetForTests = () => { lib = defaultLibrary(); listeners.clear(); };

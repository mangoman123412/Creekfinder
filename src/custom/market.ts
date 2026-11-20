import { supabase } from '../lib/supabase';
import { sanitizeMapPreset, sanitizeTheme, sanitizeWidgets, sanitize } from './schema';

export { officialDesigns } from './officialDesigns';
export type { Design, DesignKind } from './officialDesigns';
import type { Design, DesignKind } from './officialDesigns';

/** Community designs (Supabase). Payloads are re-validated here and again on apply — they are data, never code. */
export async function communityDesigns(kind: DesignKind): Promise<Design[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('shared_designs').select('id,kind,name,description,payload,downloads,user_id,created_at').eq('kind', kind).eq('official', false).order('created_at', { ascending: false }).limit(40);
  if (error) throw error;
  const ids = (data ?? []).map((d) => d.id);
  const { data: rs } = ids.length ? await supabase.from('design_ratings').select('design_id,stars').in('design_id', ids) : { data: [] as { design_id: string; stars: number }[] };
  const { data: profs } = (data ?? []).length ? await supabase.from('profiles').select('id,display_name').in('id', [...new Set((data ?? []).map((d) => d.user_id).filter(Boolean))]) : { data: [] as { id: string; display_name: string }[] };
  const names = new Map((profs ?? []).map((p) => [p.id, p.display_name]));
  return (data ?? []).map((d): Design => {
    const stars = (rs ?? []).filter((r) => r.design_id === d.id).map((r) => r.stars);
    const base: Design = { id: d.id, kind: d.kind, name: String(d.name).slice(0, 40), description: String(d.description ?? '').slice(0, 200), official: false, author: names.get(d.user_id) ?? 'Explorer', downloads: d.downloads, rating: stars.length ? stars.reduce((a, b) => a + b, 0) / stars.length : null, ratingCount: stars.length };
    const p = d.payload ?? {};
    if (kind === 'theme') base.spec = sanitizeTheme(p.spec); else if (kind === 'layout') base.widgets = sanitizeWidgets(p.widgets); else if (kind === 'profile') { base.settings = sanitize(p.settings); base.icon = typeof p.icon === 'string' ? p.icon.slice(0, 30) : 'leaf'; } else base.preset = sanitizeMapPreset({ ...p.preset, name: base.name });
    return base;
  });
}

export function payloadOf(d: Design): unknown {
  if (d.kind === 'theme') return { spec: d.spec }; if (d.kind === 'layout') return { widgets: d.widgets }; if (d.kind === 'profile') return { icon: d.icon, settings: d.settings }; return { preset: d.preset };
}
export async function publishDesign(userId: string, kind: DesignKind, name: string, description: string, payload: unknown) {
  if (!supabase) throw new Error('Sharing needs an account and an internet connection.');
  const { error } = await supabase.from('shared_designs').insert({ user_id: userId, kind, name: name.slice(0, 40), description: description.slice(0, 200), payload });
  if (error) throw error;
}
export async function rateDesign(userId: string, designId: string, stars: number) { if (!supabase) throw new Error('Offline'); const { error } = await supabase.from('design_ratings').upsert({ design_id: designId, user_id: userId, stars }); if (error) throw error; }
export async function noteDownload(designId: string) { try { await supabase?.rpc('bump_design_downloads', { design: designId }); } catch {} }
export async function deleteMyDesign(id: string) { if (!supabase) return; await supabase.from('shared_designs').delete().eq('id', id); }

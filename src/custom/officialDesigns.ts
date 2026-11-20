import { OFFICIAL_MAP_PRESETS, OFFICIAL_THEMES, officialProfiles, DEFAULT_WIDGETS, type MapPreset, type Settings, type ThemeSpec, type WidgetInstance } from './schema';

export type DesignKind = 'theme' | 'layout' | 'profile' | 'mappreset';
export interface Design {
  id: string; kind: DesignKind; name: string; description: string; official: boolean; author?: string; downloads?: number; rating?: number | null; ratingCount?: number;
  spec?: ThemeSpec; widgets?: WidgetInstance[]; settings?: Settings; icon?: string; preset?: MapPreset;
}

const hide = (xs: WidgetInstance[], keep: string[]) => xs.map((w) => ({ ...w, visible: keep.includes(w.type) }));
const order = (types: string[], size: Record<string, 'small' | 'medium' | 'large'> = {}): WidgetInstance[] => {
  const base = DEFAULT_WIDGETS(); const out: WidgetInstance[] = [];
  for (const t of types) { const b = base.find((x) => x.type === t); if (b) out.push({ ...b, visible: true, size: size[t] ?? b.size }); }
  for (const b of base) if (!out.some((o) => o.type === b.type)) out.push({ ...b, visible: false });
  return out;
};

/** Official CreekFinder designs (bundled, always available offline). */
export function officialDesigns(kind: DesignKind): Design[] {
  if (kind === 'theme') return OFFICIAL_THEMES.map((t) => ({ id: t.id, kind, name: t.name, description: 'Official CreekFinder theme', official: true, spec: t.spec }));
  if (kind === 'mappreset') return OFFICIAL_MAP_PRESETS.map((p) => ({ id: p.id, kind, name: p.name, description: 'Official map preset', official: true, preset: p }));
  if (kind === 'profile') return officialProfiles().map((p) => ({ id: p.id, kind, name: p.name, description: 'Official profile — complete app setup', official: true, settings: p.settings, icon: p.icon }));
  void hide;
  return [
    { id: 'layout-photo', kind, name: 'Photo-first', description: 'Big map and large photo cards', official: true, widgets: order(['explore_map', 'nearby', 'popular_waterfalls', 'new_discoveries', 'recent_saved'], { explore_map: 'large', nearby: 'large', popular_waterfalls: 'medium' }) },
    { id: 'layout-trailhead', kind, name: 'Trailhead dashboard', description: 'Conditions, weather, GPS and tracking up front', official: true, widgets: order(['header', 'weather', 'conditions', 'gps_coords', 'tracking', 'quick_save', 'trip_planner'], { weather: 'medium', conditions: 'large' }) },
    { id: 'layout-minimal', kind, name: 'Minimal', description: 'Just a map, your favorites and one-tap save', official: true, widgets: order(['explore_map', 'quick_save', 'favorites'], { explore_map: 'medium', quick_save: 'small', favorites: 'small' }) },
    { id: 'layout-planner', kind, name: 'Trip planner', description: 'Plan trips and keep your saved places close', official: true, widgets: order(['trip_planner', 'favorites', 'recent_saved', 'weather', 'shortcuts'], { trip_planner: 'large' }) },
  ];
}


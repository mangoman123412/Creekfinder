import { normHex } from './colorUtils';

/**
 * THE central customization schema. Every customizable thing in the app is described here once:
 * its type, default, allowed values and sanitiser. To add a new option: add it to `Settings`, to `DEFAULTS`,
 * and (if needed) to `sanitize()` — storage, profiles, cloud sync, import/export and the marketplace pick it up automatically.
 */

export const SCHEMA_VERSION = 3;

// ------------------------------------------------------------------ theme
export interface Seeds {
  primary: string; secondary: string; accent: string; background: string; card: string; text: string; button: string; nav: string;
  markerSaved: string; markerCommunity: string; markerOsm: string; markerVisited: string; markerParking: string;
}
export const SEED_KEYS = ['primary', 'secondary', 'accent', 'background', 'card', 'text', 'button', 'nav', 'markerSaved', 'markerCommunity', 'markerOsm', 'markerVisited', 'markerParking'] as const;
export const SEED_LABELS: Record<keyof Seeds, string> = {
  primary: 'Primary', secondary: 'Secondary', accent: 'Accent', background: 'Background', card: 'Cards', text: 'Text', button: 'Buttons', nav: 'Navigation bar',
  markerSaved: 'Saved markers', markerCommunity: 'Community markers', markerOsm: 'Nearby-water markers', markerVisited: 'Visited markers', markerParking: 'Parking markers',
};

export interface ThemeSpec { presetId: string; mode: 'system' | 'light' | 'dark'; overrides: Partial<Seeds> }
export interface SavedTheme { id: string; name: string; spec: ThemeSpec; official?: boolean }

const mk = (primary: string, secondary: string, accent: string, background: string, card: string, text: string, nav: string, osm: string, visited: string, parking: string): Seeds =>
  ({ primary, secondary, accent, background, card, text, button: primary, nav, markerSaved: primary, markerCommunity: secondary, markerOsm: osm, markerVisited: visited, markerParking: parking });

export interface ThemePreset { id: string; name: string; light: Seeds; dark: Seeds; forceDark?: boolean; blurb: string }
export const THEME_PRESETS: ThemePreset[] = [
  { id: 'forest', name: 'Forest green', blurb: 'Deep greens and water blue — the classic.',
    light: mk('#1F5A43', '#1B8FD0', '#D98E1F', '#F3F1EA', '#FFFFFF', '#121C17', '#FFFFFF', '#7A8F86', '#8E5BD1', '#3B6EA8'),
    dark: mk('#3C9C73', '#4FB4EE', '#F0B04A', '#0C1310', '#16201B', '#EDF3EF', '#16201B', '#9DB1A7', '#B88CF0', '#6FA3E0') },
  { id: 'ocean', name: 'Ocean blue', blurb: 'Open-water blues and teal.',
    light: mk('#0B6E99', '#00A3A3', '#F2A541', '#EEF6F9', '#FFFFFF', '#0C2430', '#FFFFFF', '#6F8C98', '#8E5BD1', '#C96B3B'),
    dark: mk('#3AB0DE', '#2ED3C6', '#F5B85C', '#07161D', '#0F2530', '#E6F3F8', '#0F2530', '#8FB0BD', '#B88CF0', '#E8946A') },
  { id: 'river', name: 'River blue', blurb: 'Bright river blues, crisp and modern.',
    light: mk('#2F6FDB', '#5CB8E6', '#E8A33D', '#F1F4FA', '#FFFFFF', '#111A2B', '#FFFFFF', '#7B8AA6', '#9B5DE5', '#2BA38A'),
    dark: mk('#6E9BFF', '#6CC4F0', '#F2B24E', '#0A101C', '#131C2E', '#E8EEFB', '#131C2E', '#9AA8C4', '#C08CFF', '#4FD1B0') },
  { id: 'midnight', name: 'Midnight black', blurb: 'True black for OLED screens and night use.', forceDark: true,
    light: mk('#4FD1A5', '#5AA9FF', '#FFC857', '#000000', '#0E0E10', '#F2F2F2', '#0E0E10', '#8A9A93', '#B88CF0', '#6FA3E0'),
    dark: mk('#4FD1A5', '#5AA9FF', '#FFC857', '#000000', '#0E0E10', '#F2F2F2', '#0E0E10', '#8A9A93', '#B88CF0', '#6FA3E0') },
  { id: 'earth', name: 'Earth tones', blurb: 'Warm soil, bark and moss.',
    light: mk('#7A5C3A', '#5E8C61', '#C8742B', '#F4EEE3', '#FFFBF3', '#2A2118', '#FFFBF3', '#8C8070', '#8E5BD1', '#3B6EA8'),
    dark: mk('#C9A27A', '#8DB38F', '#E39A4F', '#17120D', '#241D15', '#F2E9DB', '#241D15', '#A69A88', '#B88CF0', '#6FA3E0') },
  { id: 'sunset', name: 'Sunset', blurb: 'Coral, amber and dusk purple.',
    light: mk('#D9562B', '#8E44AD', '#F2A33A', '#FFF3EA', '#FFFFFF', '#2B1612', '#FFFFFF', '#9A7F78', '#2E86AB', '#3B6EA8'),
    dark: mk('#FF7A4D', '#B779D6', '#FFB74D', '#1A0E12', '#2A171C', '#FFE9DD', '#2A171C', '#B89E96', '#5BB5D8', '#6FA3E0') },
  { id: 'custom', name: 'Custom colours', blurb: 'Start from Forest and change anything.',
    light: mk('#1F5A43', '#1B8FD0', '#D98E1F', '#F3F1EA', '#FFFFFF', '#121C17', '#FFFFFF', '#7A8F86', '#8E5BD1', '#3B6EA8'),
    dark: mk('#3C9C73', '#4FB4EE', '#F0B04A', '#0C1310', '#16201B', '#EDF3EF', '#16201B', '#9DB1A7', '#B88CF0', '#6FA3E0') },
];
export const presetById = (id: string) => THEME_PRESETS.find((p) => p.id === id) ?? THEME_PRESETS[0];

export const OFFICIAL_THEMES: SavedTheme[] = THEME_PRESETS.filter((p) => p.id !== 'custom').map((p) => ({ id: `official-${p.id}`, name: p.name, official: true, spec: { presetId: p.id, mode: 'system', overrides: {} } }));

// ------------------------------------------------------------------ display + accessibility
export type FontFamilyId = 'inter' | 'nunito' | 'lora' | 'atkinson';
export const FONT_OPTIONS: { id: FontFamilyId; label: string; sample: string }[] = [
  { id: 'inter', label: 'Inter — clean & modern', sample: 'Find your creek' }, { id: 'nunito', label: 'Nunito — friendly & rounded', sample: 'Find your creek' },
  { id: 'lora', label: 'Lora — classic serif', sample: 'Find your creek' }, { id: 'atkinson', label: 'Atkinson Hyperlegible — easiest to read', sample: 'Find your creek' },
];
export interface Display {
  textScale: number; font: FontFamilyId; boldText: boolean; buttonSize: 'small' | 'medium' | 'large'; iconSize: 'small' | 'medium' | 'large';
  cardStyle: 'elevated' | 'flat' | 'outlined' | 'glass'; corners: 'sharp' | 'soft' | 'round'; density: 'compact' | 'comfortable' | 'spacious'; motion: 'off' | 'subtle' | 'normal' | 'lively';
}
export interface A11y { highContrast: boolean; reduceMotion: boolean; largeTargets: boolean; screenReader: boolean }

// ------------------------------------------------------------------ home widgets
export type WidgetType = 'header' | 'explore_map' | 'quick_save' | 'nearby' | 'recent_saved' | 'favorites' | 'weather' | 'tracking' | 'popular_waterfalls' | 'new_discoveries' | 'recent_visited' | 'gps_coords' | 'trip_planner' | 'conditions' | 'shortcuts';
export type WidgetSize = 'small' | 'medium' | 'large';
export type WidgetBg = 'default' | 'tint' | 'primary' | 'dark' | 'glass' | 'none' | 'custom';
export interface WidgetInstance { id: string; type: WidgetType; size: WidgetSize; bg: WidgetBg; customBg?: string; visible: boolean; shortcuts?: string[] }
export const WIDGET_META: Record<WidgetType, { title: string; icon: string; blurb: string; sizes: WidgetSize[]; multi?: boolean }> = {
  header: { title: 'Greeting & weather', icon: 'sunny', blurb: 'Hello, your town, live weather, profile and alerts bell', sizes: ['small', 'medium'] },
  explore_map: { title: 'Explore map', icon: 'map', blurb: 'Interactive map with saved and nearby creeks', sizes: ['small', 'medium', 'large'] },
  quick_save: { title: 'Quick save button', icon: 'location', blurb: 'One tap to save your exact spot', sizes: ['small', 'medium', 'large'] },
  nearby: { title: 'Nearby creeks', icon: 'water', blurb: 'Closest named water from OpenStreetMap + community', sizes: ['small', 'medium', 'large'] },
  recent_saved: { title: 'Recently saved', icon: 'time', blurb: 'Your newest saved places', sizes: ['small', 'medium', 'large'] },
  favorites: { title: 'Favorite locations', icon: 'heart', blurb: 'Places you marked as favorites', sizes: ['small', 'medium', 'large'] },
  weather: { title: 'Weather', icon: 'partly-sunny', blurb: 'Current conditions and 3-day outlook', sizes: ['small', 'medium', 'large'] },
  tracking: { title: 'Adventure tracking', icon: 'footsteps', blurb: 'Start a trail or resume recording', sizes: ['small', 'medium', 'large'] },
  popular_waterfalls: { title: 'Popular waterfalls', icon: 'arrow-down-circle', blurb: 'Notable waterfalls near you', sizes: ['small', 'medium', 'large'] },
  new_discoveries: { title: 'New discoveries', icon: 'sparkles', blurb: 'Recently shared by the community', sizes: ['small', 'medium', 'large'] },
  recent_visited: { title: 'Recently visited', icon: 'walk', blurb: 'Places you checked in at', sizes: ['small', 'medium', 'large'] },
  gps_coords: { title: 'GPS coordinates', icon: 'compass', blurb: 'Your live position, accuracy and elevation', sizes: ['small', 'medium'] },
  trip_planner: { title: 'Trip planner', icon: 'calendar', blurb: 'Your next planned trip', sizes: ['small', 'medium', 'large'] },
  conditions: { title: 'Creek conditions', icon: 'analytics', blurb: 'Live gauge flow, level & temperature near you', sizes: ['small', 'medium', 'large'] },
  shortcuts: { title: 'Custom shortcuts', icon: 'flash', blurb: 'Your own one-tap shortcuts', sizes: ['small', 'medium', 'large'] },
};
export const WIDGET_TYPES = Object.keys(WIDGET_META) as WidgetType[];
export const SHORTCUT_OPTIONS: { id: string; label: string; icon: string; href: string }[] = [
  { id: 'map', label: 'Map', icon: 'map', href: '/map' }, { id: 'explore', label: 'Explore', icon: 'compass', href: '/explore' }, { id: 'places', label: 'My Places', icon: 'bookmark', href: '/places' },
  { id: 'track', label: 'Track hike', icon: 'footsteps', href: '/track' }, { id: 'save', label: 'Save a creek', icon: 'location', href: '/save' }, { id: 'offline', label: 'Offline maps', icon: 'cloud-download', href: '/offline' },
  { id: 'safety', label: 'Safety', icon: 'shield-checkmark', href: '/safety' }, { id: 'alerts', label: 'Alerts', icon: 'notifications', href: '/alerts' }, { id: 'trips', label: 'Trips', icon: 'calendar', href: '/trips' },
  { id: 'history', label: 'History', icon: 'time', href: '/adventures' }, { id: 'folders', label: 'Folders', icon: 'folder', href: '/folders' }, { id: 'settings', label: 'Customize', icon: 'color-palette', href: '/settings' },
];
const w = (type: WidgetType, size: WidgetSize = 'medium', extra: Partial<WidgetInstance> = {}): WidgetInstance => ({ id: type, type, size, bg: 'default', visible: true, ...extra });
export const DEFAULT_WIDGETS = (): WidgetInstance[] => [
  w('header', 'medium', { visible: false }), w('explore_map', 'large', { bg: 'none' }), w('shortcuts', 'medium', { shortcuts: ['track', 'offline', 'safety', 'history'] }), w('recent_saved'), w('nearby'), w('popular_waterfalls'), w('new_discoveries'),
  w('favorites', 'medium', { visible: false }), w('weather', 'medium', { visible: false }), w('tracking', 'medium', { visible: false }), w('recent_visited', 'medium', { visible: false }), w('gps_coords', 'medium', { visible: false }),
  w('trip_planner', 'medium', { visible: false }), w('conditions', 'medium', { visible: false }), w('quick_save', 'medium', { visible: false }),
];

// ------------------------------------------------------------------ navigation
export type NavId = 'home' | 'explore' | 'map' | 'places' | 'profile' | 'track' | 'trips' | 'alerts';
export interface NavItem { id: NavId; visible: boolean; label?: string; icon?: string }
export const NAV_META: Record<NavId, { label: string; icon: string; href: string; essential?: boolean; icons: string[] }> = {
  home: { label: 'Home', icon: 'home', href: '/', icons: ['home', 'leaf', 'compass', 'sunny', 'grid', 'star'] },
  explore: { label: 'Explore', icon: 'compass', href: '/explore', icons: ['compass', 'search', 'telescope', 'earth', 'binoculars', 'navigate'] },
  map: { label: 'Map', icon: 'map', href: '/map', icons: ['map', 'location', 'navigate', 'layers', 'pin', 'globe'] },
  places: { label: 'My Places', icon: 'bookmark', href: '/places', icons: ['bookmark', 'heart', 'folder', 'albums', 'star', 'water'] },
  profile: { label: 'Profile', icon: 'person-circle', href: '/profile', essential: true, icons: ['person-circle', 'person', 'settings', 'happy', 'menu', 'color-palette'] },
  track: { label: 'Track', icon: 'footsteps', href: '/track', icons: ['footsteps', 'walk', 'speedometer', 'radio-button-on', 'trail-sign', 'stopwatch'] },
  trips: { label: 'Trips', icon: 'calendar', href: '/trips', icons: ['calendar', 'briefcase', 'bonfire', 'flag', 'rocket', 'time'] },
  alerts: { label: 'Alerts', icon: 'notifications', href: '/alerts', icons: ['notifications', 'warning', 'shield-checkmark', 'cloud', 'rainy', 'megaphone'] },
};
export const NAV_IDS = Object.keys(NAV_META) as NavId[];
export interface Nav { style: 'floating' | 'bottom' | 'compact' | 'expanded'; iconStyle: 'auto' | 'outline' | 'filled'; labels: 'auto' | 'always' | 'never'; items: NavItem[] }

// ------------------------------------------------------------------ map presets
export type MapStyleId = 'standard' | 'satellite' | 'hybrid' | 'terrain' | 'topo' | 'dark' | 'light';
export const MAP_STYLE_OPTIONS: { id: MapStyleId; label: string; icon: string; premium: boolean; needsKey: boolean }[] = [
  { id: 'standard', label: 'Standard', icon: 'map', premium: false, needsKey: false }, { id: 'satellite', label: 'Satellite', icon: 'earth', premium: true, needsKey: true },
  { id: 'hybrid', label: 'Hybrid satellite', icon: 'layers', premium: true, needsKey: true }, { id: 'terrain', label: 'Terrain', icon: 'trail-sign', premium: true, needsKey: true },
  { id: 'topo', label: 'Topographic', icon: 'analytics', premium: true, needsKey: true }, { id: 'dark', label: 'Dark map', icon: 'moon', premium: false, needsKey: false }, { id: 'light', label: 'Light map', icon: 'sunny', premium: false, needsKey: false },
];
export type MarkerShape = 'circle' | 'square' | 'diamond' | 'triangle' | 'star' | 'ring';
export const MARKER_SHAPES: MarkerShape[] = ['circle', 'square', 'diamond', 'triangle', 'star', 'ring'];
export interface MapPreset {
  id: string; name: string; icon: string; official?: boolean;
  style: MapStyleId;
  markers: { size: number; shape: MarkerShape; colors: Partial<Pick<Seeds, 'markerSaved' | 'markerCommunity' | 'markerOsm' | 'markerVisited' | 'markerParking'>> };
  layers: { labels: boolean; roads: boolean; trails: boolean; waterways: boolean; contours: boolean; hillshade: boolean };
  brightness: number;
  defaultZoom: number; autoCenter: boolean;
  show: { saved: boolean; community: boolean; visited: boolean; parking: boolean; hikingTrails: boolean; nearbyWater: boolean };
}
const preset = (id: string, name: string, icon: string, style: MapStyleId, over: Partial<MapPreset> = {}): MapPreset => ({
  id, name, icon, official: true, style, markers: { size: 1, shape: 'circle', colors: {} },
  layers: { labels: true, roads: true, trails: true, waterways: true, contours: false, hillshade: true }, brightness: 0, defaultZoom: 12, autoCenter: true,
  show: { saved: true, community: false, visited: false, parking: false, hikingTrails: false, nearbyWater: true }, ...over,
});
export const OFFICIAL_MAP_PRESETS: MapPreset[] = [
  preset('map-default', 'Default', 'map', 'standard'),
  preset('map-hiking', 'Hiking Map', 'walk', 'terrain', { layers: { labels: true, roads: true, trails: true, waterways: true, contours: true, hillshade: true }, show: { saved: true, community: false, visited: true, parking: true, hikingTrails: true, nearbyWater: true }, defaultZoom: 13 }),
  preset('map-creek', 'Creek Hunting Map', 'water', 'hybrid', { markers: { size: 1.2, shape: 'diamond', colors: {} }, layers: { labels: true, roads: false, trails: true, waterways: true, contours: false, hillshade: true }, show: { saved: true, community: true, visited: false, parking: true, hikingTrails: false, nearbyWater: true }, defaultZoom: 14 }),
  preset('map-waterfall', 'Waterfall Map', 'arrow-down-circle', 'terrain', { markers: { size: 1.3, shape: 'triangle', colors: { markerSaved: '#1B8FD0' } }, layers: { labels: true, roads: true, trails: true, waterways: true, contours: true, hillshade: true }, show: { saved: true, community: true, visited: false, parking: true, hikingTrails: true, nearbyWater: true }, defaultZoom: 13 }),
  preset('map-fishing', 'Fishing Map', 'fish', 'standard', { markers: { size: 1.1, shape: 'star', colors: {} }, layers: { labels: true, roads: true, trails: false, waterways: true, contours: false, hillshade: false }, show: { saved: true, community: true, visited: true, parking: true, hikingTrails: false, nearbyWater: true }, defaultZoom: 14 }),
  preset('map-satellite', 'Satellite Exploration', 'earth', 'satellite', { markers: { size: 1.15, shape: 'ring', colors: {} }, layers: { labels: false, roads: false, trails: false, waterways: true, contours: false, hillshade: false }, show: { saved: true, community: true, visited: false, parking: false, hikingTrails: false, nearbyWater: true }, defaultZoom: 15 }),
];
export const defaultMapPreset = () => OFFICIAL_MAP_PRESETS[0];

// ------------------------------------------------------------------ creek detail sections
export type DetailSectionId = 'gallery' | 'coordinates' | 'elevation' | 'depth' | 'clarity' | 'temperature' | 'flow' | 'width' | 'waterfalls' | 'terrain' | 'trails' | 'parking' | 'access' | 'reviews' | 'reports' | 'weather' | 'nearby' | 'history';
export const DETAIL_META: Record<DetailSectionId, { title: string; icon: string; group: 'top' | 'water' | 'around' | 'community' | 'other' }> = {
  gallery: { title: 'Photo gallery', icon: 'images', group: 'top' }, coordinates: { title: 'GPS coordinates & map', icon: 'location', group: 'other' }, elevation: { title: 'Elevation', icon: 'trending-up', group: 'other' },
  depth: { title: 'Water depth', icon: 'arrow-down', group: 'water' }, clarity: { title: 'Water clarity', icon: 'eye', group: 'water' }, temperature: { title: 'Water temperature', icon: 'thermometer', group: 'water' },
  flow: { title: 'Flow conditions', icon: 'speedometer', group: 'water' }, width: { title: 'Creek width', icon: 'resize', group: 'water' }, waterfalls: { title: 'Nearby waterfalls', icon: 'arrow-down-circle', group: 'around' },
  terrain: { title: 'Surrounding terrain', icon: 'leaf', group: 'around' }, trails: { title: 'Hiking trails', icon: 'walk', group: 'around' }, parking: { title: 'Parking', icon: 'car', group: 'around' },
  access: { title: 'Access information', icon: 'key', group: 'around' }, reviews: { title: 'Reviews', icon: 'star', group: 'community' }, reports: { title: 'Community reports', icon: 'chatbubbles', group: 'community' },
  weather: { title: 'Weather & safety', icon: 'partly-sunny', group: 'other' }, nearby: { title: 'Nearby locations', icon: 'navigate-circle', group: 'around' }, history: { title: 'Historical visits', icon: 'time', group: 'other' },
};
export const DETAIL_IDS = Object.keys(DETAIL_META) as DetailSectionId[];
export interface Detail { layout: 'compact' | 'standard' | 'detailed'; sections: { id: DetailSectionId; visible: boolean }[] }

// ------------------------------------------------------------------ saved locations
export interface Saved { sort: 'date' | 'distance' | 'name' | 'rating' | 'elevation'; dir: 'asc' | 'desc'; view: 'cards' | 'compact'; showFavoritesFirst: boolean }

// ------------------------------------------------------------------ tracking
export type TrackStatId = 'distance' | 'time' | 'avgSpeed' | 'speed' | 'elevation' | 'gain' | 'coordinates' | 'history' | 'visited';
export const TRACK_META: Record<TrackStatId, { title: string; icon: string }> = {
  distance: { title: 'Distance', icon: 'resize' }, time: { title: 'Time', icon: 'time' }, avgSpeed: { title: 'Average speed', icon: 'speedometer' }, speed: { title: 'Current speed', icon: 'flash' },
  elevation: { title: 'Elevation', icon: 'trending-up' }, gain: { title: 'Total elevation gain', icon: 'trending-up' }, coordinates: { title: 'Coordinates', icon: 'location' },
  history: { title: 'Route history', icon: 'footsteps' }, visited: { title: 'Visited locations', icon: 'flag' },
};
export const TRACK_IDS = Object.keys(TRACK_META) as TrackStatId[];
export interface Tracking { layout: 'classic' | 'dashboard' | 'mapfocus' | 'minimal'; stats: { id: TrackStatId; visible: boolean }[]; keepAwake: boolean }

// ------------------------------------------------------------------ notifications
export type NotifCat = 'nearby' | 'waterfalls' | 'weather' | 'flood' | 'community' | 'comments' | 'trips' | 'saved';
export const NOTIF_META: Record<NotifCat, { title: string; blurb: string; safety: boolean; icon: string }> = {
  flood: { title: 'Flash flood alerts', blurb: 'Flood & flash-flood warnings at your location (US NWS)', safety: true, icon: 'water' },
  weather: { title: 'Weather warnings', blurb: 'Severe weather alerts at your location (US NWS)', safety: true, icon: 'thunderstorm' },
  nearby: { title: 'Nearby creek discoveries', blurb: 'New named creeks found near you', safety: false, icon: 'compass' },
  waterfalls: { title: 'New waterfall discoveries', blurb: 'New waterfalls near you', safety: false, icon: 'arrow-down-circle' },
  community: { title: 'Community activity', blurb: 'New public creeks shared near you', safety: false, icon: 'people' },
  comments: { title: 'Comments', blurb: 'New comments on places you shared', safety: false, icon: 'chatbubble' },
  trips: { title: 'Trip reminders', blurb: 'Reminders before your planned trips', safety: false, icon: 'calendar' },
  saved: { title: 'Saved location updates', blurb: 'New ratings or photos on places you shared', safety: false, icon: 'bookmark' },
};
export const NOTIF_CATS = Object.keys(NOTIF_META) as NotifCat[];
export type SoundId = 'default' | 'chime' | 'siren' | 'silent';
export interface Notifs {
  enabled: Record<NotifCat, boolean>; deliver: 'inbox' | 'system'; quiet: { enabled: boolean; from: string; to: string; days: boolean[]; allowFloodDuringQuiet: boolean };
  sounds: { safety: SoundId; social: SoundId }; tripLeadHours: number;
}

// ------------------------------------------------------------------ privacy
export interface Privacy { defaultVisibility: 'private' | 'public'; confirmShare: boolean; autoCheckIn: boolean }

// ------------------------------------------------------------------ the whole thing
export interface Settings {
  theme: ThemeSpec; display: Display; a11y: A11y; home: { widgets: WidgetInstance[] }; nav: Nav; mapPresetId: string; detail: Detail; saved: Saved; tracking: Tracking; notifications: Notifs; privacy: Privacy;
}

export const DEFAULTS = (): Settings => ({
  theme: { presetId: 'forest', mode: 'system', overrides: {} },
  display: { textScale: 1, font: 'inter', boldText: false, buttonSize: 'medium', iconSize: 'medium', cardStyle: 'elevated', corners: 'soft', density: 'comfortable', motion: 'normal' },
  a11y: { highContrast: false, reduceMotion: false, largeTargets: false, screenReader: false },
  home: { widgets: DEFAULT_WIDGETS() },
  nav: { style: 'floating', iconStyle: 'auto', labels: 'auto', items: [{ id: 'home', visible: true }, { id: 'explore', visible: true }, { id: 'map', visible: true }, { id: 'places', visible: true }, { id: 'profile', visible: true }, { id: 'track', visible: false }, { id: 'trips', visible: false }, { id: 'alerts', visible: false }] },
  mapPresetId: 'map-default',
  detail: { layout: 'standard', sections: DETAIL_IDS.map((id) => ({ id, visible: true })) },
  saved: { sort: 'date', dir: 'desc', view: 'cards', showFavoritesFirst: false },
  tracking: { layout: 'classic', stats: TRACK_IDS.map((id) => ({ id, visible: !['coordinates', 'history', 'visited', 'elevation', 'gain', 'avgSpeed', 'speed'].includes(id) })), keepAwake: true },
  notifications: {
    enabled: { flood: true, weather: true, nearby: false, waterfalls: false, community: false, comments: true, trips: true, saved: false }, deliver: 'system',
    quiet: { enabled: false, from: '22:00', to: '07:00', days: [true, true, true, true, true, true, true], allowFloodDuringQuiet: true }, sounds: { safety: 'siren', social: 'default' }, tripLeadHours: 24,
  },
  privacy: { defaultVisibility: 'private', confirmShare: true, autoCheckIn: false },
});

// ------------------------------------------------------------------ sanitising (used for storage, import, marketplace, cloud sync)
const clamp = (n: unknown, lo: number, hi: number, d: number) => { const x = typeof n === 'number' && isFinite(n) ? n : d; return Math.min(hi, Math.max(lo, x)); };
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], d: T): T => (allowed.includes(v as T) ? (v as T) : d);
const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
const str = (v: unknown, d: string, max = 60) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f<>]/g, '').slice(0, max) : d);
const hex = (v: unknown, d: string) => (typeof v === 'string' && /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v.trim()) ? normHex(v) : d);
const time = (v: unknown, d: string) => (typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : d);

/** Reorderable list: keep known ids in the saved order/visibility, drop unknown ids, append anything new at the end. */
function orderedList<T extends string>(raw: unknown, ids: readonly T[], defaults: { id: T; visible: boolean }[]): { id: T; visible: boolean }[] {
  const seen = new Set<string>(); const out: { id: T; visible: boolean }[] = [];
  if (Array.isArray(raw)) for (const r of raw) { const id = r?.id as T; if (ids.includes(id) && !seen.has(id)) { seen.add(id); out.push({ id, visible: bool(r.visible, true) }); } }
  for (const d of defaults) if (!seen.has(d.id)) out.push({ ...d });
  return out;
}

export function sanitizeTheme(raw: any): ThemeSpec {
  const d = DEFAULTS().theme;
  const ov: Partial<Seeds> = {};
  if (raw?.overrides && typeof raw.overrides === 'object') for (const k of SEED_KEYS) if (typeof raw.overrides[k] === 'string' && /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(raw.overrides[k].trim())) ov[k] = normHex(raw.overrides[k]);
  return { presetId: THEME_PRESETS.some((p) => p.id === raw?.presetId) ? raw.presetId : d.presetId, mode: oneOf(raw?.mode, ['system', 'light', 'dark'] as const, d.mode), overrides: ov };
}

export function sanitizeWidgets(raw: unknown): WidgetInstance[] {
  const out: WidgetInstance[] = []; const ids = new Set<string>();
  if (Array.isArray(raw)) for (const r of raw.slice(0, 40)) {
    const type = r?.type as WidgetType; if (!WIDGET_TYPES.includes(type)) continue;
    let id = str(r.id, type, 40) || type; if (ids.has(id)) id = `${type}-${ids.size}`; ids.add(id);
    const meta = WIDGET_META[type];
    const w: WidgetInstance = { id, type, size: meta.sizes.includes(r.size) ? r.size : meta.sizes[Math.min(1, meta.sizes.length - 1)], bg: oneOf(r.bg, ['default', 'tint', 'primary', 'dark', 'glass', 'none', 'custom'] as const, 'default'), visible: bool(r.visible, true) };
    if (r.customBg) w.customBg = hex(r.customBg, '#FFFFFF');
    if (type === 'shortcuts') w.shortcuts = Array.isArray(r.shortcuts) ? r.shortcuts.filter((s: unknown) => typeof s === 'string').slice(0, 12).map((s: string) => s.slice(0, 80)) : [];
    out.push(w);
  }
  // every non-repeatable widget type must exist at least once (hidden if the user removed it) so it can be re-added from the list
  for (const d of DEFAULT_WIDGETS()) if (!out.some((o) => o.type === d.type)) out.push({ ...d, visible: false });
  return out;
}

export function sanitizeMapPreset(raw: any, fallbackId = 'map-custom'): MapPreset {
  const d = defaultMapPreset(); const m = raw?.markers ?? {}; const l = raw?.layers ?? {}; const s = raw?.show ?? {};
  const colors: MapPreset['markers']['colors'] = {};
  for (const k of ['markerSaved', 'markerCommunity', 'markerOsm', 'markerVisited', 'markerParking'] as const) if (m.colors?.[k]) colors[k] = hex(m.colors[k], '#888888');
  return {
    id: str(raw?.id, fallbackId, 40) || fallbackId, name: str(raw?.name, 'My map', 40) || 'My map', icon: str(raw?.icon, 'map', 30), official: raw?.official === true ? true : undefined,
    style: oneOf(raw?.style, MAP_STYLE_OPTIONS.map((o) => o.id), d.style),
    markers: { size: clamp(m.size, 0.6, 1.8, 1), shape: oneOf(m.shape, MARKER_SHAPES, 'circle'), colors },
    layers: { labels: bool(l.labels, true), roads: bool(l.roads, true), trails: bool(l.trails, true), waterways: bool(l.waterways, true), contours: bool(l.contours, false), hillshade: bool(l.hillshade, true) },
    brightness: clamp(raw?.brightness, -0.6, 0.6, 0), defaultZoom: clamp(raw?.defaultZoom, 3, 18, 12), autoCenter: bool(raw?.autoCenter, true),
    show: { saved: bool(s.saved, true), community: bool(s.community, false), visited: bool(s.visited, false), parking: bool(s.parking, false), hikingTrails: bool(s.hikingTrails, false), nearbyWater: bool(s.nearbyWater, true) },
  };
}

export function sanitize(raw: any): Settings {
  const d = DEFAULTS(); const r = raw && typeof raw === 'object' ? raw : {};
  const ds = r.display ?? {}, ac = r.a11y ?? {}, nv = r.nav ?? {}, dt = r.detail ?? {}, sv = r.saved ?? {}, tr = r.tracking ?? {}, nt = r.notifications ?? {}, pv = r.privacy ?? {};
  const enabled = {} as Record<NotifCat, boolean>; for (const c of NOTIF_CATS) enabled[c] = bool(nt.enabled?.[c], d.notifications.enabled[c]);
  const navItems = orderedList(nv.items, NAV_IDS, d.nav.items.map((i) => ({ id: i.id, visible: i.visible }))).map((i) => {
    const src = Array.isArray(nv.items) ? nv.items.find((x: any) => x?.id === i.id) : null;
    const icon = typeof src?.icon === 'string' && NAV_META[i.id].icons.includes(src.icon) ? src.icon : undefined;
    const item: NavItem = { id: i.id, visible: NAV_META[i.id].essential ? true : i.visible };
    const label = src?.label ? str(src.label, '', 14) : ''; if (label) item.label = label; if (icon) item.icon = icon;
    return item;
  });
  if (navItems.filter((i) => i.visible).length < 3) for (const i of navItems) if (!i.visible && navItems.filter((x) => x.visible).length < 3 && ['home', 'map', 'places', 'explore'].includes(i.id)) i.visible = true;
  const q = nt.quiet ?? {};
  return {
    theme: sanitizeTheme(r.theme),
    display: { textScale: clamp(ds.textScale, 0.8, 1.6, 1), font: oneOf(ds.font, FONT_OPTIONS.map((f) => f.id), 'inter'), boldText: bool(ds.boldText, false), buttonSize: oneOf(ds.buttonSize, ['small', 'medium', 'large'] as const, 'medium'),
      iconSize: oneOf(ds.iconSize, ['small', 'medium', 'large'] as const, 'medium'), cardStyle: oneOf(ds.cardStyle, ['elevated', 'flat', 'outlined', 'glass'] as const, 'elevated'), corners: oneOf(ds.corners, ['sharp', 'soft', 'round'] as const, 'soft'),
      density: oneOf(ds.density, ['compact', 'comfortable', 'spacious'] as const, 'comfortable'), motion: oneOf(ds.motion, ['off', 'subtle', 'normal', 'lively'] as const, 'normal') },
    a11y: { highContrast: bool(ac.highContrast, false), reduceMotion: bool(ac.reduceMotion, false), largeTargets: bool(ac.largeTargets, false), screenReader: bool(ac.screenReader, false) },
    home: { widgets: sanitizeWidgets(r.home?.widgets ?? d.home.widgets) },
    nav: { style: oneOf(nv.style, ['floating', 'bottom', 'compact', 'expanded'] as const, 'floating'), iconStyle: oneOf(nv.iconStyle, ['auto', 'outline', 'filled'] as const, 'auto'), labels: oneOf(nv.labels, ['auto', 'always', 'never'] as const, 'auto'), items: navItems },
    mapPresetId: str(r.mapPresetId, d.mapPresetId, 40),
    detail: { layout: oneOf(dt.layout, ['compact', 'standard', 'detailed'] as const, 'standard'), sections: orderedList(dt.sections, DETAIL_IDS, d.detail.sections) },
    saved: { sort: oneOf(sv.sort, ['date', 'distance', 'name', 'rating', 'elevation'] as const, 'date'), dir: oneOf(sv.dir, ['asc', 'desc'] as const, 'desc'), view: oneOf(sv.view, ['cards', 'compact'] as const, 'cards'), showFavoritesFirst: bool(sv.showFavoritesFirst, false) },
    tracking: { layout: oneOf(tr.layout, ['classic', 'dashboard', 'mapfocus', 'minimal'] as const, 'classic'), stats: orderedList(tr.stats, TRACK_IDS, d.tracking.stats), keepAwake: bool(tr.keepAwake, true) },
    notifications: {
      enabled, deliver: oneOf(nt.deliver, ['inbox', 'system'] as const, 'system'),
      quiet: { enabled: bool(q.enabled, false), from: time(q.from, '22:00'), to: time(q.to, '07:00'), days: Array.isArray(q.days) && q.days.length === 7 ? q.days.map((x: unknown) => x !== false) : [true, true, true, true, true, true, true], allowFloodDuringQuiet: bool(q.allowFloodDuringQuiet, true) },
      sounds: { safety: oneOf(nt.sounds?.safety, ['default', 'chime', 'siren', 'silent'] as const, 'siren'), social: oneOf(nt.sounds?.social, ['default', 'chime', 'siren', 'silent'] as const, 'default') }, tripLeadHours: clamp(nt.tripLeadHours, 1, 168, 24),
    },
    privacy: { defaultVisibility: oneOf(pv.defaultVisibility, ['private', 'public'] as const, 'private'), confirmShare: bool(pv.confirmShare, true), autoCheckIn: bool(pv.autoCheckIn, false) },
  };
}

// ------------------------------------------------------------------ profiles
export interface AppProfile { id: string; name: string; icon: string; settings: Settings; official?: boolean }
export const PROFILE_ICONS = ['compass', 'fish', 'walk', 'leaf', 'water', 'map', 'camera', 'bonfire', 'bicycle', 'boat', 'telescope', 'star', 'heart', 'flash', 'moon', 'sunny'];

function withWidgets(order: { t: WidgetType; size?: WidgetSize; visible?: boolean }[], extra: Partial<Record<WidgetType, Partial<WidgetInstance>>> = {}): WidgetInstance[] {
  const all = DEFAULT_WIDGETS().map((x) => ({ ...x, visible: false }));
  const out: WidgetInstance[] = [];
  for (const o of order) { const base = all.find((a) => a.type === o.t)!; out.push({ ...base, size: o.size ?? base.size, visible: o.visible ?? true, ...(extra[o.t] ?? {}) }); }
  for (const a of all) if (!out.some((x) => x.type === a.type)) out.push(a);
  return out;
}
const sec = (visibleFirst: DetailSectionId[]) => { const rest = DETAIL_IDS.filter((i) => !visibleFirst.includes(i)); return [...visibleFirst.map((id) => ({ id, visible: true })), ...rest.map((id) => ({ id, visible: false }))]; };

export function officialProfiles(): AppProfile[] {
  const base = DEFAULTS();
  const explorer: Settings = { ...base, mapPresetId: 'map-satellite', detail: { layout: 'detailed', sections: DETAIL_IDS.map((id) => ({ id, visible: true })) },
    home: { widgets: withWidgets([{ t: 'explore_map', size: 'large' }, { t: 'shortcuts', extra: undefined } as any, { t: 'nearby' }, { t: 'new_discoveries' }, { t: 'tracking' }, { t: 'popular_waterfalls' }], { shortcuts: { shortcuts: ['track', 'offline', 'safety', 'history'] } }) },
    tracking: { layout: 'dashboard', keepAwake: true, stats: TRACK_IDS.map((id) => ({ id, visible: ['distance', 'time', 'speed', 'elevation', 'gain', 'coordinates'].includes(id) })) } };
  const fishing: Settings = { ...base, theme: { presetId: 'river', mode: 'system', overrides: {} }, mapPresetId: 'map-fishing', detail: { layout: 'standard', sections: sec(['gallery', 'flow', 'temperature', 'clarity', 'depth', 'width', 'access', 'parking', 'weather', 'reports', 'coordinates']) },
    home: { widgets: withWidgets([{ t: 'conditions', size: 'large' }, { t: 'weather' }, { t: 'quick_save' }, { t: 'favorites' }, { t: 'nearby' }, { t: 'trip_planner' }]) } };
  const hiking: Settings = { ...base, theme: { presetId: 'earth', mode: 'system', overrides: {} }, mapPresetId: 'map-hiking', detail: { layout: 'standard', sections: sec(['gallery', 'elevation', 'trails', 'parking', 'terrain', 'waterfalls', 'coordinates', 'weather', 'nearby', 'access']) },
    home: { widgets: withWidgets([{ t: 'explore_map', size: 'large' }, { t: 'tracking', size: 'large' }, { t: 'weather' }, { t: 'gps_coords' }, { t: 'trip_planner' }, { t: 'recent_visited' }]) },
    tracking: { layout: 'dashboard', keepAwake: true, stats: TRACK_IDS.map((id) => ({ id, visible: ['distance', 'time', 'avgSpeed', 'elevation', 'gain', 'coordinates'].includes(id) })) } };
  const minimal: Settings = { ...base, theme: { presetId: 'midnight', mode: 'dark', overrides: {} }, mapPresetId: 'map-default', display: { ...base.display, cardStyle: 'flat', corners: 'soft', density: 'compact', motion: 'subtle' },
    detail: { layout: 'compact', sections: sec(['gallery', 'coordinates', 'weather']) }, home: { widgets: withWidgets([{ t: 'explore_map', size: 'medium' }, { t: 'favorites' }, { t: 'quick_save' }]) },
    nav: { ...base.nav, style: 'compact', items: base.nav.items.map((i) => ({ ...i, visible: ['home', 'map', 'places', 'profile'].includes(i.id) })) },
    tracking: { layout: 'minimal', keepAwake: true, stats: TRACK_IDS.map((id) => ({ id, visible: ['distance', 'time'].includes(id) })) } };
  return [
    { id: 'profile-explorer', name: 'Explorer', icon: 'compass', settings: sanitize(explorer), official: true }, { id: 'profile-fishing', name: 'Fishing', icon: 'fish', settings: sanitize(fishing), official: true },
    { id: 'profile-hiking', name: 'Hiking', icon: 'walk', settings: sanitize(hiking), official: true }, { id: 'profile-minimal', name: 'Minimal', icon: 'leaf', settings: sanitize(minimal), official: true },
  ];
}

/** Everything that is stored/synced/exported. */
export interface Library { version: number; profiles: AppProfile[]; activeProfileId: string; themes: SavedTheme[]; mapPresets: MapPreset[]; updatedAt: number }
export function defaultLibrary(): Library {
  const std: AppProfile = { id: 'profile-default', name: 'My CreekFinder', icon: 'leaf', settings: DEFAULTS() };
  return { version: SCHEMA_VERSION, profiles: [std, ...officialProfiles()], activeProfileId: std.id, themes: [], mapPresets: [], updatedAt: 0 };
}
export function sanitizeLibrary(raw: any): Library {
  const d = defaultLibrary();
  const profiles: AppProfile[] = []; const ids = new Set<string>();
  if (Array.isArray(raw?.profiles)) for (const p of raw.profiles.slice(0, 30)) {
    let id = str(p?.id, '', 40); if (!id || ids.has(id)) id = `profile-${Math.random().toString(36).slice(2, 9)}`; ids.add(id);
    profiles.push({ id, name: str(p?.name, 'Profile', 30) || 'Profile', icon: str(p?.icon, 'leaf', 30), settings: sanitize(p?.settings), official: p?.official === true ? true : undefined });
  }
  if (!profiles.length) profiles.push(...d.profiles);
  const themes: SavedTheme[] = Array.isArray(raw?.themes) ? raw.themes.slice(0, 60).map((t: any, i: number) => ({ id: str(t?.id, `theme-${i}`, 40), name: str(t?.name, 'Theme', 40), spec: sanitizeTheme(t?.spec) })) : [];
  const mapPresets: MapPreset[] = Array.isArray(raw?.mapPresets) ? raw.mapPresets.slice(0, 60).map((m: any, i: number) => sanitizeMapPreset({ ...m, official: false }, `map-user-${i}`)) : [];
  const active = profiles.some((p) => p.id === raw?.activeProfileId) ? raw.activeProfileId : profiles[0].id;
  return { version: SCHEMA_VERSION, profiles, activeProfileId: active, themes, mapPresets, updatedAt: typeof raw?.updatedAt === 'number' ? raw.updatedAt : 0 };
}

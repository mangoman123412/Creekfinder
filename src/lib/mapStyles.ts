import { config, hasMapTiler } from '../config';
import type { MapStyleKey } from '../types';
import type { MapStyleId } from '../custom/schema';

/**
 * Map style URLs.
 *  - With a MapTiler key: streets / satellite / hybrid / outdoor (terrain) / topo / dark / light.
 *  - Without a key: OpenFreeMap (free, keyless) for standard / dark / light; satellite, hybrid, terrain and topo fall back to its standard style.
 */
export function styleUrlFor(id: MapStyleId, appDark = false): { url: string; fellBack: boolean } {
  if (hasMapTiler) {
    const k = config.maptilerKey; const m = (n: string) => `https://api.maptiler.com/maps/${n}/style.json?key=${k}`;
    switch (id) {
      case 'satellite': return { url: m('satellite'), fellBack: false };
      case 'hybrid': return { url: m('hybrid'), fellBack: false };
      case 'terrain': return { url: m(appDark ? 'outdoor-v2-dark' : 'outdoor-v2'), fellBack: false };
      case 'topo': return { url: m(appDark ? 'topo-v2-dark' : 'topo-v2'), fellBack: false };
      case 'dark': return { url: m('streets-v2-dark'), fellBack: false };
      case 'light': return { url: m('streets-v2-light'), fellBack: false };
      default: return { url: m(appDark ? 'streets-v2-dark' : 'streets-v2'), fellBack: false };
    }
  }
  const o = (n: string) => `https://tiles.openfreemap.org/styles/${n}`;
  if (id === 'dark') return { url: o('dark'), fellBack: false };
  if (id === 'light') return { url: o('bright'), fellBack: false };
  if (id === 'standard') return { url: o(appDark ? 'dark' : 'liberty'), fellBack: false };
  return { url: o(appDark ? 'dark' : 'liberty'), fellBack: true };
}

// legacy API used by older screens
export function styleUrl(key: MapStyleKey, dark = false): string { return styleUrlFor(key === 'terrain' ? 'terrain' : key === 'satellite' ? 'satellite' : 'standard', dark).url; }
export const STYLE_OPTIONS: { key: MapStyleKey; label: string; icon: string; premium: boolean }[] = [
  { key: 'standard', label: 'Standard', icon: 'map', premium: false }, { key: 'satellite', label: 'Satellite', icon: 'earth', premium: true }, { key: 'terrain', label: 'Terrain & trails', icon: 'trail-sign', premium: true },
];
export const styleAvailable = (key: MapStyleKey | MapStyleId) => key === 'standard' || key === 'dark' || key === 'light' || hasMapTiler;

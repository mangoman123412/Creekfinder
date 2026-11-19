import { config, hasMapTiler } from '../config';
import type { MapStyleKey } from '../types';

/**
 * Map styles.
 *  - With a MapTiler key:  Standard = streets, Satellite = hybrid imagery + labels, Terrain = outdoor (topo contours, trails, hillshade).
 *  - Without a key: Standard falls back to OpenFreeMap (free, keyless, OpenStreetMap data); satellite/terrain are unavailable.
 */
export function styleUrl(key: MapStyleKey, dark = false): string {
  if (hasMapTiler) {
    const k = config.maptilerKey;
    switch (key) {
      case 'satellite': return `https://api.maptiler.com/maps/hybrid/style.json?key=${k}`;
      case 'terrain': return `https://api.maptiler.com/maps/outdoor-v2/style.json?key=${k}`;
      default: return `https://api.maptiler.com/maps/${dark ? 'streets-v2-dark' : 'streets-v2'}/style.json?key=${k}`;
    }
  }
  return dark ? 'https://tiles.openfreemap.org/styles/dark' : 'https://tiles.openfreemap.org/styles/liberty';
}

export const STYLE_OPTIONS: { key: MapStyleKey; label: string; icon: string; premium: boolean }[] = [
  { key: 'standard', label: 'Standard', icon: 'map', premium: false },
  { key: 'satellite', label: 'Satellite', icon: 'earth', premium: true },
  { key: 'terrain', label: 'Terrain & trails', icon: 'trail-sign', premium: true },
];

export const styleAvailable = (key: MapStyleKey) => key === 'standard' || hasMapTiler;

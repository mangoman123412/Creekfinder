import type { ExploreItem } from '../types';

/** One place to build the route to the Destination Guide for ANY creek (saved, community or OpenStreetMap). */
export function guideHref(i: { source: 'saved' | 'community' | 'verified' | 'osm'; id?: string; name?: string; kind?: string; lat?: number; lng?: number; osmId?: string; desc?: string | null }) {
  if (i.source === 'saved') return { pathname: '/creek' as const, params: { source: 'saved', id: i.id! } };
  if (i.source === 'community' || i.source === 'verified') return { pathname: '/creek' as const, params: { source: 'community', id: i.id! } };
  return { pathname: '/creek' as const, params: { source: 'osm', name: i.name ?? 'Water', kind: i.kind ?? 'creek', lat: String(i.lat), lng: String(i.lng), osm: i.osmId ?? '', desc: i.desc ?? '' } };
}
export const itemHref = (i: ExploreItem) => guideHref({ source: i.source, id: i.placeId, name: i.name, kind: i.kind, lat: i.lat, lng: i.lng, osmId: i.osmId, desc: i.description });

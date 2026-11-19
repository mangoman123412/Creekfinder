export type PlaceKind = 'creek' | 'river' | 'stream' | 'waterfall' | 'swimming_hole' | 'pond_lake' | 'spring' | 'other';

export const PLACE_KINDS: { key: PlaceKind; label: string; icon: string }[] = [
  { key: 'creek', label: 'Creek', icon: 'water' },
  { key: 'river', label: 'River', icon: 'git-merge' },
  { key: 'stream', label: 'Stream', icon: 'water-outline' },
  { key: 'waterfall', label: 'Waterfall', icon: 'arrow-down-circle' },
  { key: 'swimming_hole', label: 'Swimming hole', icon: 'body' },
  { key: 'pond_lake', label: 'Pond / lake', icon: 'ellipse' },
  { key: 'spring', label: 'Spring', icon: 'sparkles' },
  { key: 'other', label: 'Other', icon: 'location' },
];
export const kindLabel = (k: string) => PLACE_KINDS.find((x) => x.key === k)?.label ?? 'Water';
export const kindIcon = (k: string) => PLACE_KINDS.find((x) => x.key === k)?.icon ?? 'water';

export type Visibility = 'private' | 'public';

export interface Place {
  id: string;
  user_id: string | null;
  name: string;
  kind: PlaceKind;
  lat: number;
  lng: number;
  accuracy_m: number | null;
  altitude_m: number | null;
  description: string | null;
  water_notes: string | null;
  depth_notes: string | null;
  surroundings: string | null;
  notes: string | null;
  folder_id: string | null;
  visibility: Visibility;
  source_place_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Folder {
  id: string;
  user_id: string | null;
  name: string;
  icon: string;
  sort: number;
  system_key: string | null;
}

export interface Photo {
  id: string;
  user_id: string | null;
  place_id: string | null;
  adventure_id: string | null;
  local_uri: string | null;
  storage_path: string | null;
  caption: string | null;
  created_at: string;
}

export interface Adventure {
  id: string;
  user_id: string | null;
  name: string;
  notes: string | null;
  started_at: string;
  ended_at: string | null;
  distance_m: number;
  duration_s: number;
  elevation_gain_m: number;
  status: 'recording' | 'finished';
}

export interface TrackPoint {
  seq: number;
  lat: number;
  lng: number;
  alt: number | null;
  acc: number | null;
  ts: number;
}

/** A water location from any source shown in Explore. */
export interface ExploreItem {
  key: string;
  source: 'osm' | 'community' | 'verified';
  name: string;
  kind: PlaceKind;
  lat: number;
  lng: number;
  description?: string | null;
  distance_m?: number;
  placeId?: string;       // community place id
  osmId?: string;         // e.g. "way/123"
  author?: string | null;
  avg_rating?: number | null;
  rating_count?: number;
  photo?: { url: string; credit: string; pageUrl: string; license: string } | null;
  town?: string | null;
  townDist?: number | null;
  created_at?: string;
  tags?: Record<string, string>;
}

export type MapStyleKey = 'standard' | 'satellite' | 'terrain';

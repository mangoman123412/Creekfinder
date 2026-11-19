import { fetchJson } from './net';
import { cached, geoKey } from './cache';
import { haversine, type LL } from './geo';
import { classify, looksLikeWater as _lw, type Feature, type GuidePhoto, type Surroundings, type Town, type El } from './guidePure';
export * from './guidePure';
const strip = (h?: string) => (h ?? '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
import { config } from '../config';

/**
 * Real-data sources for the Destination Guide. NOTHING is estimated or invented:
 *  - Photos ........ Wikimedia Commons (credited, freely licensed) + photos uploaded by explorers
 *  - Place names ... OpenStreetMap Nominatim reverse geocoding
 *  - Elevation ..... Open-Meteo elevation (Copernicus DEM)
 *  - Surroundings .. OpenStreetMap (Overpass)
 *  - Wildlife/plants iNaturalist research-grade observations
 *  - Nearby reading Wikipedia
 * Anything a source doesn't have is returned as null/empty and shown as "Unknown".
 */

// ------------------------------------------------------------------ photos (Wikimedia Commons)
export async function commonsPhotos(lat: number, lng: number, radiusM = 3000, limit = 40): Promise<GuidePhoto[]> {
  const r = Math.min(10000, Math.max(10, Math.round(radiusM)));
  const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=geosearch&ggscoord=${lat}%7C${lng}&ggsradius=${r}&ggslimit=${limit}&ggsnamespace=6` +
    `&prop=imageinfo%7Ccoordinates&iiprop=url%7Cmime%7Cextmetadata&iiurlwidth=900&iiextmetadatafilter=Artist%7CLicenseShortName&colimit=${limit}`;
  const { data } = await cached(`commons:${geoKey(lat, lng, 2)}:${r}`, 7 * 86400e3, async () => {
    const d = await fetchJson<any>(url, { timeoutMs: 20000 });
    const pages: any[] = Object.values(d?.query?.pages ?? {});
    const out: GuidePhoto[] = [];
    for (const p of pages) {
      const ii = p.imageinfo?.[0];
      if (!ii || ii.mime !== 'image/jpeg') continue;
      const title = String(p.title ?? '').replace(/^File:/, '').replace(/\.jpe?g$/i, '').replace(/_/g, ' ');
      out.push({
        id: `commons-${p.pageid}`, url: ii.thumburl ?? ii.url, full: ii.url, title,
        credit: strip(ii.extmetadata?.Artist?.value) || 'Wikimedia Commons contributor', license: strip(ii.extmetadata?.LicenseShortName?.value) || 'Open license',
        pageUrl: ii.descriptionshorturl ?? `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title)}`,
        lat: p.coordinates?.[0]?.lat, lng: p.coordinates?.[0]?.lon,
      });
    }
    return out;
  });
  return data;
}

// ------------------------------------------------------------------ place names, elevation
export interface Region { town: string | null; county: string | null; state: string | null; country: string | null; label: string }

export async function reverseGeocode(lat: number, lng: number): Promise<Region> {
  const { data } = await cached(`rev:${geoKey(lat, lng, 3)}`, 30 * 86400e3, async () => {
    const d = await fetchJson<any>(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=14&addressdetails=1&lat=${lat}&lon=${lng}`, { timeoutMs: 15000 });
    const a = d?.address ?? {};
    const town = a.city ?? a.town ?? a.village ?? a.hamlet ?? a.suburb ?? null;
    const state = a.state ?? a.region ?? null;
    const r: Region = { town, county: a.county ?? null, state, country: a.country ?? null, label: [town ?? a.county, state].filter(Boolean).join(', ') };
    return r;
  });
  return data;
}

export async function elevationM(lat: number, lng: number): Promise<number | null> {
  const { data } = await cached(`elev:${geoKey(lat, lng, 3)}`, 365 * 86400e3, async () => {
    const d = await fetchJson<{ elevation?: number[] }>(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`, { timeoutMs: 12000 });
    return d.elevation?.[0] ?? null;
  });
  return data;
}

// ------------------------------------------------------------------ surroundings (OpenStreetMap)
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
async function overpass(q: string): Promise<El[]> {
  let err: unknown;
  for (const base of OVERPASS) {
    try { return (await fetchJson<{ elements: El[] }>(`${base}?data=${encodeURIComponent(q)}`, { timeoutMs: 30000 })).elements; } catch (e) { err = e; }
  }
  throw err instanceof Error ? err : new Error('OpenStreetMap data unavailable');
}

export async function surroundings(lat: number, lng: number, radiusM = 4000): Promise<Surroundings> {
  const a = `(around:${radiusM},${lat},${lng})`;
  const b = `(around:1500,${lat},${lng})`;
  const q = `[out:json][timeout:25];(
    nwr${a}["waterway"="waterfall"];
    nwr${a}["leisure"~"^(swimming_area|bathing_place)$"];
    nwr${a}["tourism"~"^(camp_site|caravan_site)$"];
    nwr${a}["amenity"="parking"];
    nwr${a}["man_made"="bridge"];
    way${a}["bridge"]["bridge"!="no"]["highway"];
    way${a}["highway"~"^(path|footway|bridleway|steps)$"]["name"];
    rel${a}["route"~"^(hiking|foot)$"];
    nwr${a}["natural"~"^(rock|stone|cliff|bare_rock|cave_entrance|peak|rock_formation)$"];
    way${b}["highway"~"^(primary|secondary|tertiary|unclassified|residential|service|track|living_street)$"]["name"];
  );out center tags 400;`;
  const { data } = await cached(`surr:${geoKey(lat, lng, 3)}`, 14 * 86400e3, async () => classify(await overpass(q), { lat, lng }));
  return data;
}

/** Tags of one OSM element (width, depth, fishing, swimming, access…). */
export async function osmTags(osmId: string): Promise<Record<string, string>> {
  const [type, id] = osmId.split('/');
  const t = type === 'relation' ? 'relation' : type;
  const { data } = await cached(`tags:${osmId}`, 30 * 86400e3, async () => {
    const els = await overpass(`[out:json][timeout:20];${t}(${id});out tags;`);
    return els[0]?.tags ?? {};
  });
  return data;
}

// ------------------------------------------------------------------ wildlife & plants (iNaturalist)
export interface Species { id: number; name: string; sci: string; count: number; photo: string | null; group: string }
async function species(lat: number, lng: number, taxa: string, per: number): Promise<Species[]> {
  const u = `https://api.inaturalist.org/v1/observations/species_counts?lat=${lat}&lng=${lng}&radius=3&quality_grade=research&per_page=${per}&iconic_taxa=${taxa}&locale=en`;
  const { data } = await cached(`inat:${geoKey(lat, lng, 2)}:${taxa}`, 14 * 86400e3, async () => {
    const d = await fetchJson<any>(u, { timeoutMs: 20000 });
    return (d.results ?? []).map((r: any): Species => ({
      id: r.taxon.id, name: r.taxon.preferred_common_name ?? r.taxon.name, sci: r.taxon.name, count: r.count,
      photo: r.taxon.default_photo?.medium_url ?? r.taxon.default_photo?.square_url ?? null, group: r.taxon.iconic_taxon_name ?? '',
    }));
  });
  return data;
}
export const plantsNear = (lat: number, lng: number) => species(lat, lng, 'Plantae', 40);
export const wildlifeNear = (lat: number, lng: number) => species(lat, lng, 'Aves,Mammalia,Reptilia,Amphibia,Actinopterygii,Insecta,Arachnida', 16);

// ------------------------------------------------------------------ Wikipedia nearby
export interface Article { title: string; extract: string; thumb: string | null; url: string; distance_m: number }
export async function wikipediaNear(lat: number, lng: number): Promise<Article[]> {
  const u = `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=geosearch&ggscoord=${lat}%7C${lng}&ggsradius=10000&ggslimit=6&prop=extracts%7Cpageimages%7Ccoordinates&exintro=1&explaintext=1&exsentences=2&exlimit=6&piprop=thumbnail&pithumbsize=300&colimit=6`;
  const { data } = await cached(`wiki:${geoKey(lat, lng, 2)}`, 30 * 86400e3, async () => {
    const d = await fetchJson<any>(u, { timeoutMs: 15000 });
    return (Object.values(d?.query?.pages ?? {}) as any[]).map((p): Article => ({
      title: p.title, extract: (p.extract ?? '').trim(), thumb: p.thumbnail?.source ?? null,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(String(p.title).replace(/ /g, '_'))}`,
      distance_m: p.coordinates?.[0] ? haversine({ lat, lng }, { lat: p.coordinates[0].lat, lng: p.coordinates[0].lon }) : 0,
    })).filter((a) => a.extract).sort((a, b) => a.distance_m - b.distance_m);
  });
  return data;
}

// ------------------------------------------------------------------ cards: towns + photos for lists
export async function townsNear(lat: number, lng: number, radiusM: number): Promise<Town[]> {
  const q = `[out:json][timeout:20];node(around:${Math.min(radiusM, 40000)},${lat},${lng})["place"~"^(city|town|village|hamlet)$"]["name"];out 150;`;
  const { data } = await cached(`towns:${geoKey(lat, lng, 1)}:${radiusM}`, 30 * 86400e3, async () => (await overpass(q)).map((e) => ({ name: e.tags!.name, lat: e.lat!, lng: e.lon! })));
  return data;
}
export const attributionNote = 'Photos: Wikimedia Commons contributors (open licenses). Place data © OpenStreetMap contributors. Wildlife & plants: iNaturalist community.';
void config;

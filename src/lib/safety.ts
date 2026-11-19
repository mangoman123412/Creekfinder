import { config } from '../config';
import { fetchJson } from './net';
import { haversine } from './geo';

/**
 * Real safety data, no guessing:
 *  - Weather + alerts: US National Weather Service (api.weather.gov) – US locations only, free.
 *  - Water level / discharge: USGS NWIS instantaneous values – US gauges only, free.
 * Outside the US these sections say "not available here" rather than showing made-up numbers.
 */

const NWS = { 'User-Agent': config.userAgent, Accept: 'application/geo+json' };

export interface Alert { id: string; event: string; severity: string; headline: string; description: string; ends: string | null; isFlood: boolean }
export interface Weather {
  forecast: { name: string; temp: number; unit: string; short: string; wind: string; precipChance: number | null }[];
  alerts: Alert[];
  supported: boolean;
}

export async function getWeather(lat: number, lng: number): Promise<Weather> {
  const h = { headers: NWS, timeoutMs: 15000 };
  let alerts: Alert[] = [];
  try {
    const a = await fetchJson<{ features: { id: string; properties: any }[] }>(`https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lng.toFixed(4)}`, h);
    alerts = a.features.map((f) => ({
      id: f.id, event: f.properties.event, severity: f.properties.severity, headline: f.properties.headline ?? f.properties.event,
      description: f.properties.description ?? '', ends: f.properties.ends ?? f.properties.expires ?? null,
      isFlood: /flood|flash|dam break/i.test(f.properties.event ?? ''),
    }));
  } catch { /* non-US / outage */ }
  try {
    const pt = await fetchJson<{ properties: { forecast: string } }>(`https://api.weather.gov/points/${lat.toFixed(4)},${lng.toFixed(4)}`, h);
    const fc = await fetchJson<{ properties: { periods: any[] } }>(pt.properties.forecast, h);
    return {
      supported: true, alerts,
      forecast: fc.properties.periods.slice(0, 6).map((p) => ({
        name: p.name, temp: p.temperature, unit: p.temperatureUnit, short: p.shortForecast, wind: `${p.windSpeed} ${p.windDirection}`,
        precipChance: p.probabilityOfPrecipitation?.value ?? null,
      })),
    };
  } catch {
    return { supported: false, alerts, forecast: [] };
  }
}

export interface Gauge { siteCode: string; name: string; lat: number; lng: number; distance_m: number; stageFt: number | null; dischargeCfs: number | null; time: string | null }

export async function getNearbyGauges(lat: number, lng: number, maxResults = 4): Promise<Gauge[]> {
  const d = 0.25; // ~25km box
  const bbox = [(lng - d).toFixed(4), (lat - d).toFixed(4), (lng + d).toFixed(4), (lat + d).toFixed(4)].join(',');
  const data = await fetchJson<{ value: { timeSeries: any[] } }>(
    `https://waterservices.usgs.gov/nwis/iv/?format=json&bBox=${bbox}&parameterCd=00060,00065&siteType=ST&siteStatus=active`, { timeoutMs: 20000 });
  const bySite = new Map<string, Gauge>();
  for (const ts of data.value.timeSeries) {
    const src = ts.sourceInfo;
    const code = src.siteCode[0].value as string;
    const g = bySite.get(code) ?? {
      siteCode: code, name: src.siteName as string, lat: src.geoLocation.geogLocation.latitude, lng: src.geoLocation.geogLocation.longitude,
      distance_m: 0, stageFt: null, dischargeCfs: null, time: null,
    };
    g.distance_m = haversine({ lat, lng }, { lat: g.lat, lng: g.lng });
    const v = ts.values?.[0]?.value?.slice(-1)[0];
    const num = v ? parseFloat(v.value) : NaN;
    if (!isNaN(num) && num > -999) {
      const pc = ts.variable.variableCode[0].value;
      if (pc === '00065') g.stageFt = num;
      if (pc === '00060') g.dischargeCfs = num;
      g.time = v.dateTime;
    }
    bySite.set(code, g);
  }
  return [...bySite.values()].sort((a, b) => a.distance_m - b.distance_m).slice(0, maxResults);
}

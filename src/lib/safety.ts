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

export interface Gauge { siteCode: string; name: string; lat: number; lng: number; distance_m: number; stageFt: number | null; dischargeCfs: number | null; tempC: number | null; turbidity: number | null; time: string | null }

export async function getNearbyGauges(lat: number, lng: number, maxResults = 4): Promise<Gauge[]> {
  const d = 0.25; // ~25km box
  const bbox = [(lng - d).toFixed(4), (lat - d).toFixed(4), (lng + d).toFixed(4), (lat + d).toFixed(4)].join(',');
  const data = await fetchJson<{ value: { timeSeries: any[] } }>(
    `https://waterservices.usgs.gov/nwis/iv/?format=json&bBox=${bbox}&parameterCd=00060,00065,00010,63680,00076&siteType=ST&siteStatus=active`, { timeoutMs: 20000 });
  const bySite = new Map<string, Gauge>();
  for (const ts of data.value.timeSeries) {
    const src = ts.sourceInfo;
    const code = src.siteCode[0].value as string;
    const g = bySite.get(code) ?? {
      siteCode: code, name: src.siteName as string, lat: src.geoLocation.geogLocation.latitude, lng: src.geoLocation.geogLocation.longitude,
      distance_m: 0, stageFt: null, dischargeCfs: null, tempC: null, turbidity: null, time: null,
    };
    g.distance_m = haversine({ lat, lng }, { lat: g.lat, lng: g.lng });
    const v = ts.values?.[0]?.value?.slice(-1)[0];
    const num = v ? parseFloat(v.value) : NaN;
    if (!isNaN(num) && num > -999) {
      const pc = ts.variable.variableCode[0].value;
      if (pc === '00065') g.stageFt = num;
      if (pc === '00060') g.dischargeCfs = num;
      if (pc === '00010') g.tempC = num;
      if (pc === '63680' || pc === '00076') g.turbidity = num;
      g.time = v.dateTime;
    }
    bySite.set(code, g);
  }
  return [...bySite.values()].sort((a, b) => a.distance_m - b.distance_m).slice(0, maxResults);
}

import { describeWeather } from './weatherPure';
export { describeWeather } from './weatherPure';
export interface DayForecast { date: string; code: number; maxC: number; minC: number; label: string; icon: string }
export async function getDailyForecast(lat: number, lng: number): Promise<DayForecast[]> {
  const d = await fetchJson<any>(`https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lng.toFixed(3)}&daily=weather_code,temperature_2m_max,temperature_2m_min&forecast_days=4&timezone=auto`, { timeoutMs: 12000 });
  return (d.daily?.time ?? []).map((t: string, i: number) => ({ date: t, code: d.daily.weather_code[i], maxC: d.daily.temperature_2m_max[i], minC: d.daily.temperature_2m_min[i], ...describeWeather(d.daily.weather_code[i], true) }));
}
export interface CurrentWeather { tempF: number; tempC: number; code: number; isDay: boolean; label: string; icon: string }
/** Global current conditions (Open-Meteo, no key). */
export async function getCurrentWeather(lat: number, lng: number): Promise<CurrentWeather> {
  const d = await fetchJson<any>(`https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lng.toFixed(3)}&current=temperature_2m,weather_code,is_day&temperature_unit=celsius`, { timeoutMs: 12000 });
  const c = d.current; const w = describeWeather(c.weather_code, !!c.is_day);
  return { tempC: c.temperature_2m, tempF: c.temperature_2m * 9 / 5 + 32, code: c.weather_code, isDay: !!c.is_day, ...w };
}

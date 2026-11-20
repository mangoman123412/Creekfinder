import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useApp } from '../state/app';
import { useDbQuery, usePhotoUris } from '../state/hooks';
import { firstPhotos, getActiveAdventureId, getAdventure, kvGet, listAdventures, listPlaces, listTrips, listVisits, unreadCount, type Trip, type Visit } from '../db/local';
import { ensureForegroundPermission, lastKnown } from '../lib/location';
import { enrichItems, searchCommunity, searchOsmWater } from '../lib/explore';
import { reverseGeocode } from '../lib/guide';
import { getCurrentWeather, getDailyForecast, getNearbyGauges, getWeather, type CurrentWeather, type DayForecast, type Gauge } from '../lib/safety';
import type { Adventure, ExploreItem, Photo, Place } from '../types';

export interface HomeData {
  me: { lat: number; lng: number } | null; place: string | null; wx: CurrentWeather | null; forecast: DayForecast[]; alerts: number; floodAlert: boolean;
  osm: ExploreItem[] | null; comm: ExploreItem[]; msg: string | null; places: Place[]; photos: Record<string, Photo>; uris: Record<string, string>;
  visits: Visit[]; trips: Trip[]; adventures: Adventure[]; activeAdventure: Adventure | null; avatar: string | null; unread: number; gauges: Gauge[] | null; reload: () => Promise<void>;
}
const Ctx = createContext<HomeData>(null as unknown as HomeData);
export const useHome = () => useContext(Ctx);

/** Loads everything the Home widgets can show, once, and shares it (so adding 5 widgets doesn't cause 5x the requests). */
export function HomeDataProvider({ children, need }: { children: React.ReactNode; need: { geo: boolean; items: boolean; weather: boolean; gauges: boolean } }) {
  const { online } = useApp();
  const [me, setMe] = useState<HomeData['me']>(null);
  const [place, setPlace] = useState<string | null>(null);
  const [wx, setWx] = useState<CurrentWeather | null>(null);
  const [forecast, setForecast] = useState<DayForecast[]>([]);
  const [alerts, setAlerts] = useState(0); const [floodAlert, setFlood] = useState(false);
  const [osm, setOsm] = useState<ExploreItem[] | null>(null); const [comm, setComm] = useState<ExploreItem[]>([]);
  const [gauges, setGauges] = useState<Gauge[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const places = useDbQuery(() => listPlaces(), [], [] as Place[]);
  const photos = useDbQuery(firstPhotos, [], {});
  const uris = usePhotoUris(Object.values(photos.data));
  const visits = useDbQuery(() => listVisits(12), [], [] as Visit[]);
  const trips = useDbQuery(listTrips, [], [] as Trip[]);
  const advs = useDbQuery(listAdventures, [], [] as Adventure[]);
  const activeId = useDbQuery(getActiveAdventureId, [], null as string | null);
  const active = useDbQuery(() => (activeId.data ? getAdventure(activeId.data) : Promise.resolve(null)), [activeId.data], null as Adventure | null);
  const avatar = useDbQuery(() => kvGet('avatar'), [], null as string | null);
  const unread = useDbQuery(unreadCount, [], 0);

  const load = useCallback(async () => {
    setMsg(null);
    if (!need.geo) return;
    if (!(await ensureForegroundPermission())) { setMsg('Allow location to see water near you.'); setOsm([]); return; }
    const l = await lastKnown();
    if (!l) { setMsg('Waiting for a GPS fix…'); setOsm([]); return; }
    setMe(l);
    if (!online) { setMsg("You're offline — your saved places are below."); setOsm([]); return; }
    void reverseGeocode(l.lat, l.lng).then((r) => setPlace(r.label || null)).catch(() => {});
    if (need.weather) {
      void getCurrentWeather(l.lat, l.lng).then(setWx).catch(() => {});
      void getDailyForecast(l.lat, l.lng).then(setForecast).catch(() => {});
      void getWeather(l.lat, l.lng).then((w) => { setAlerts(w.alerts.length); setFlood(w.alerts.some((a) => a.isFlood)); }).catch(() => {});
    }
    if (need.gauges) void getNearbyGauges(l.lat, l.lng, 4).then(setGauges).catch(() => setGauges([]));
    if (need.items) {
      searchCommunity(l, 120000).then(setComm).catch(() => {});
      try {
        const items = await searchOsmWater(l, 30000); setOsm(items.slice(0, 60));
        const enriched = await enrichItems(items.slice(0, 40), l, 30000); setOsm([...enriched, ...items.slice(40, 60)]);
      } catch { setOsm([]); setMsg('Could not load nearby water right now.'); }
    } else setOsm([]);
  }, [online, need.geo, need.items, need.weather, need.gauges]);
  useEffect(() => { void load(); }, [load]);

  const value = useMemo<HomeData>(() => ({
    me, place, wx, forecast, alerts, floodAlert, osm, comm, msg, places: places.data, photos: photos.data, uris, visits: visits.data, trips: trips.data, adventures: advs.data,
    activeAdventure: active.data, avatar: avatar.data, unread: unread.data, gauges, reload: load,
  }), [me, place, wx, forecast, alerts, floodAlert, osm, comm, msg, places.data, photos.data, uris, visits.data, trips.data, advs.data, active.data, avatar.data, unread.data, gauges, load]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Platform, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CameraRef } from '@maplibre/maplibre-react-native';
import { Banner, Button, IconButton, Pressy, SectionTitle, Text, SAFETY_NOTICE } from '../../src/components/ui';
import { CardSkeletonRow, DestinationCard, type CardData } from '../../src/components/Bits';
import { CreekMap, type MapPin } from '../../src/components/CreekMap';
import { useApp } from '../../src/state/app';
import { useDbQuery, usePhotoUris } from '../../src/state/hooks';
import { firstPhotos, kvGet, listPlaces } from '../../src/db/local';
import { canSaveMore } from '../../src/lib/actions';
import { ensureForegroundPermission, lastKnown } from '../../src/lib/location';
import { haversine } from '../../src/lib/geo';
import { enrichItems, searchCommunity, searchOsmWater } from '../../src/lib/explore';
import { reverseGeocode } from '../../src/lib/guide';
import { getCurrentWeather, getWeather, type CurrentWeather } from '../../src/lib/safety';
import { guideHref, itemHref } from '../../src/lib/nav';
import { hasBackend, hasMapTiler } from '../../src/config';
import { colors, font, radius, shadow, space } from '../../src/theme';
import type { ExploreItem, Place } from '../../src/types';

const HERO_H = Math.min(470, Math.max(380, Dimensions.get('window').height * 0.5));

const greeting = () => { const h = new Date().getHours(); return h < 5 ? 'Late night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };
const toCard = (i: ExploreItem, saved = false): CardData => ({
  key: i.key, name: i.name, kind: i.kind, photoUrl: i.photo?.url, credit: i.photo?.credit, location: i.town ? `Near ${i.town}` : null, distance_m: i.distance_m,
  rating: i.avg_rating, ratingCount: i.rating_count, desc: i.description, source: i.source, saved,
});
const isNotable = (i: ExploreItem) => !!(i.tags?.wikipedia || i.tags?.wikidata);

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { premium, imperial, online, user, displayName, pending } = useApp();
  const cam = useRef<CameraRef>(null);
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  const [place, setPlace] = useState<string | null>(null);
  const [wx, setWx] = useState<CurrentWeather | null>(null);
  const [alerts, setAlerts] = useState(0);
  const [osm, setOsm] = useState<ExploreItem[] | null>(null);
  const [comm, setComm] = useState<ExploreItem[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const places = useDbQuery(() => listPlaces(), [], [] as Place[]);
  const photos = useDbQuery(firstPhotos, [], {});
  const uris = usePhotoUris(Object.values(photos.data));
  const avatar = useDbQuery(() => kvGet('avatar'), [], null as string | null);

  const load = useCallback(async () => {
    setMsg(null);
    if (!(await ensureForegroundPermission())) { setMsg('Allow location to see water near you.'); setOsm([]); return; }
    const l = await lastKnown();
    if (!l) { setMsg('Waiting for a GPS fix…'); setOsm([]); return; }
    setMe(l);
    cam.current?.jumpTo({ center: [l.lng, l.lat], zoom: 11.5 });
    if (!online) { setMsg("You're offline — your saved places are below."); setOsm([]); return; }
    void reverseGeocode(l.lat, l.lng).then((r) => setPlace(r.label || null)).catch(() => {});
    void getCurrentWeather(l.lat, l.lng).then(setWx).catch(() => {});
    void getWeather(l.lat, l.lng).then((w) => setAlerts(w.alerts.length)).catch(() => {});
    searchCommunity(l, 120000).then(setComm).catch(() => {});
    try {
      const items = await searchOsmWater(l, 30000);
      setOsm(items.slice(0, 60));
      const slice = items.slice(0, 40);
      const enriched = await enrichItems(slice, l, 30000);
      setOsm([...enriched, ...items.slice(40, 60)]);
    } catch { setOsm([]); setMsg('Could not load nearby water right now.'); }
  }, [online]);
  useEffect(() => { void load(); }, [load]);

  const savedCards = useMemo<CardData[]>(() => places.data.slice(0, 12).map((p) => ({
    key: p.id, name: p.name, kind: p.kind, photoUrl: photos.data[p.id] ? uris[photos.data[p.id].id] : null, distance_m: me ? haversine(me, p) : null,
    location: p.visibility === 'public' ? 'Shared' : 'Private', desc: p.description, source: 'saved' as const, saved: true,
  })), [places.data, photos.data, uris, me]);

  const savedIds = useMemo(() => new Set(places.data.map((p) => p.source_place_id).filter(Boolean) as string[]), [places.data]);
  const osmList = osm ?? [];
  const gems = osmList.filter((i) => !isNotable(i) && ['waterfall', 'swimming_hole', 'spring', 'creek', 'stream'].includes(i.kind) && i.name !== 'Water').slice(0, 10);
  const popular = [...comm.filter((c) => (c.rating_count ?? 0) > 0).sort((a, b) => (b.avg_rating ?? 0) * Math.log2(2 + (b.rating_count ?? 0)) - (a.avg_rating ?? 0) * Math.log2(2 + (a.rating_count ?? 0))), ...osmList.filter(isNotable)].slice(0, 10);
  const recent = [...comm].filter((c) => !savedIds.has(c.placeId ?? '')).sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? '')).slice(0, 10);
  const trending = comm.filter((c) => (c.rating_count ?? 0) >= 2).sort((a, b) => (b.rating_count ?? 0) - (a.rating_count ?? 0)).slice(0, 8);
  const suggested = osmList.filter((i) => ['waterfall', 'swimming_hole', 'spring', 'river'].includes(i.kind) && i.name !== 'Water' && !gems.includes(i)).slice(0, 10);

  const pins: MapPin[] = useMemo(() => [
    ...osmList.slice(0, 80).map((i) => ({ id: `o:${i.key}`, lat: i.lat, lng: i.lng, name: i.name, group: 'osm' as const, kind: i.kind })),
    ...comm.map((i) => ({ id: `c:${i.placeId}`, lat: i.lat, lng: i.lng, name: i.name, group: 'community' as const, kind: i.kind })),
    ...places.data.map((p) => ({ id: `s:${p.id}`, lat: p.lat, lng: p.lng, name: p.name, group: 'saved' as const, kind: p.kind })),
  ], [osmList, comm, places.data]);

  const onPin = (p: MapPin) => {
    const [t, id] = [p.id.slice(0, 1), p.id.slice(2)];
    if (t === 's') router.push(guideHref({ source: 'saved', id }));
    else if (t === 'c') router.push(guideHref({ source: 'community', id }));
    else { const it = osmList.find((x) => x.key === id); if (it) router.push(itemHref(it)); }
  };
  const save = async () => { if (await canSaveMore(premium, router.push)) router.push('/save'); };
  const name = user ? displayName.split(/[ ._]/)[0] : 'Explorer';
  const temp = wx ? (imperial ? `${Math.round(wx.tempF)}°F` : `${Math.round(wx.tempC)}°C`) : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 130 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
        {/* ---------- immersive map hero ---------- */}
        <View style={{ height: HERO_H, backgroundColor: colors.primaryDeep }}>
          <CreekMap styleKey={hasMapTiler ? 'satellite' : 'standard'} cameraRef={cam} pins={pins} onPressPin={onPin} attributionBottom={96}
            initial={me ? { center: [me.lng, me.lat], zoom: 11.5 } : undefined} />
          <LinearGradient pointerEvents="none" colors={['rgba(5,14,10,0.72)', 'rgba(5,14,10,0)']} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 170 }} />
          <View style={{ position: 'absolute', top: insets.top + 10, left: 18, right: 18, flexDirection: 'row', alignItems: 'center' }} pointerEvents="box-none">
            <Animated.View entering={FadeInDown.duration(500)} style={{ flex: 1 }} pointerEvents="none">
              <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '600' }}>{greeting()},</Text>
              <Text style={{ color: '#fff', fontSize: 27, fontWeight: '800', letterSpacing: -0.5 }}>{name} 👋</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
                <Ionicons name="location-sharp" size={14} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 13.5, fontWeight: '600', flexShrink: 1 }} numberOfLines={1}>{place ?? (me ? 'Your location' : 'Locating…')}</Text>
              </View>
              {wx && temp ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.22)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 14, alignSelf: 'flex-start', marginTop: 6 }}>
                  <Ionicons name={wx.icon as any} size={15} color="#fff" /><Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{temp} · {wx.label}</Text>
                </View>
              ) : null}
            </Animated.View>
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <IconButton icon="notifications-outline" label="Alerts" badge={alerts > 0} onPress={() => router.push('/alerts')} />
              <Pressy onPress={() => router.push('/(tabs)/profile')} accessibilityLabel="Profile" style={[{ width: 44, height: 44, borderRadius: 22, overflow: 'hidden', backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' }]}>
                {avatar.data ? <Image source={{ uri: avatar.data }} style={{ width: 44, height: 44 }} /> : <Text style={{ color: '#fff', fontWeight: '800', fontSize: 17 }}>{name.slice(0, 1).toUpperCase()}</Text>}
              </Pressy>
            </View>
          </View>
          <View style={{ position: 'absolute', right: 14, bottom: 84 }}>
            <IconButton icon="expand" label="Open full map" onPress={() => router.push('/(tabs)/map')} />
          </View>
          {/* floating actions */}
          <View style={{ position: 'absolute', left: 16, right: 16, bottom: 22, flexDirection: 'row', gap: 10 }}>
            <Pressy style={{ flex: 1.1 }} onPress={() => router.push({ pathname: '/(tabs)/explore', params: { focus: '1' } })} accessibilityLabel="Find a creek">
              <LinearGradient colors={[colors.water, colors.waterDeep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[{ height: 56, borderRadius: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 }, shadow.float]}>
                <Ionicons name="search" size={20} color="#fff" /><Text numberOfLines={1} style={{ color: '#fff', fontWeight: '800', fontSize: 13.5, letterSpacing: 0.3 }}>FIND A CREEK</Text>
              </LinearGradient>
            </Pressy>
            <Pressy style={{ flex: 1 }} onPress={save} accessibilityLabel="Save a location">
              <View style={[{ height: 56, borderRadius: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.overlay }, shadow.float]}>
                <Ionicons name="location" size={18} color={colors.primary} /><Text numberOfLines={1} style={{ fontWeight: '800', fontSize: 12.5, letterSpacing: 0.2 }}>SAVE A LOCATION</Text>
              </View>
            </Pressy>
          </View>
        </View>

        {/* ---------- content sheet ---------- */}
        <View style={{ marginTop: -22, borderTopLeftRadius: 30, borderTopRightRadius: 30, backgroundColor: colors.bg, paddingTop: 6, paddingHorizontal: 18 }}>
          {!online && <Banner tone="info" icon="cloud-offline">You're offline. Saving, photos, notes and GPS tracking still work and will sync later.</Banner>}
          {online && pending > 0 && user && <Banner tone="info" icon="sync">{pending} change{pending > 1 ? 's' : ''} waiting to sync.</Banner>}
          {msg && <Banner tone="info" icon="information-circle">{msg}</Banner>}

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
            {[['footsteps', 'Track hike', '/track'], ['cloud-download', 'Offline maps', '/offline'], ['shield-checkmark', 'Safety', '/safety'], ['time', 'History', '/adventures']].map(([ic, l, href]) => (
              <Pressy key={l} style={{ flex: 1 }} onPress={() => router.push(href as any)} accessibilityLabel={l}>
                <View style={[{ backgroundColor: colors.surface, borderRadius: radius.md, alignItems: 'center', paddingVertical: 13, gap: 5 }, shadow.soft]}>
                  <Ionicons name={ic as any} size={22} color={colors.primary} /><Text style={{ fontSize: 11.5, fontWeight: '700' }}>{l}</Text>
                </View>
              </Pressy>
            ))}
          </View>

          <Carousel title="Your saved locations" sub={places.data.length ? `${places.data.length} saved${premium ? '' : ' of 25'}` : undefined} right={places.data.length > 3 ? 'See all' : undefined} onRight={() => router.push('/(tabs)/places')}
            data={savedCards} empty={<EmptyCard icon="bookmark-outline" title="Nothing saved yet" body="Found a beautiful creek? Tap SAVE A LOCATION and it's pinned with exact GPS." action="Save a location" onPress={save} />}
            onPress={(c) => router.push(guideHref({ source: 'saved', id: c.key }))} imperial={imperial} />

          <Carousel title="Nearby hidden gems" sub="Lesser-known named water within 30 km" loading={osm == null} data={gems.map((i) => toCard(i))}
            onPress={(_, n) => router.push(itemHref(gems[n]))} imperial={imperial} hideIfEmpty />
          <Carousel title="Popular creeks" sub="Top-rated by explorers & notable on Wikipedia" data={popular.map((i) => toCard(i))} onPress={(_, n) => router.push(itemHref(popular[n]))} imperial={imperial} hideIfEmpty />
          <Carousel title="Recently discovered" sub="Newly shared by the community" data={recent.map((i) => toCard(i))} onPress={(_, n) => router.push(itemHref(recent[n]))} imperial={imperial} hideIfEmpty />
          <Carousel title="Trending outdoor destinations" sub="Most-rated by the community" data={trending.map((i) => toCard(i))} onPress={(_, n) => router.push(itemHref(trending[n]))} imperial={imperial} hideIfEmpty />
          <Carousel title="Suggested places to explore" sub="Waterfalls, swimming spots & springs" data={suggested.map((i) => toCard(i))} onPress={(_, n) => router.push(itemHref(suggested[n]))} imperial={imperial} hideIfEmpty />

          {hasBackend && comm.length === 0 && osm != null && (
            <Animated.View entering={FadeIn.delay(300)}><EmptyCard icon="people-outline" title="The community map is just getting started" body="Share a creek you love and help other explorers find it." action="Save & share a creek" onPress={save} /></Animated.View>
          )}
          <Text style={[font.small, { marginTop: 18 }]}>Photos from Wikimedia Commons & explorers. Place data © OpenStreetMap contributors. Cards without a photo don't have one yet — add yours!</Text>
          <Banner icon="warning">{SAFETY_NOTICE}</Banner>
        </View>
      </ScrollView>
    </View>
  );
}

function Carousel({ title, sub, right, onRight, data, onPress, imperial, loading, empty, hideIfEmpty }: {
  title: string; sub?: string; right?: string; onRight?: () => void; data: CardData[]; onPress: (c: CardData, i: number) => void; imperial: boolean; loading?: boolean; empty?: React.ReactNode; hideIfEmpty?: boolean;
}) {
  if (!loading && data.length === 0 && hideIfEmpty) return null;
  return (
    <View>
      <SectionTitle sub={sub} right={right} onRight={onRight}>{title}</SectionTitle>
      {loading ? <CardSkeletonRow /> : data.length === 0 ? empty : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -18 }} contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 14 }}>
          {data.map((c, i) => <DestinationCard key={c.key} d={c} index={i} imperial={imperial} onPress={() => onPress(c, i)} />)}
        </ScrollView>
      )}
    </View>
  );
}

function EmptyCard({ icon, title, body, action, onPress }: { icon: any; title: string; body: string; action: string; onPress: () => void }) {
  return (
    <View style={[{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: 22, alignItems: 'center' }, shadow.soft]}>
      <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: colors.waterTint, alignItems: 'center', justifyContent: 'center' }}><Ionicons name={icon} size={28} color={colors.water} /></View>
      <Text style={[font.h3, { marginTop: 10, textAlign: 'center' }]}>{title}</Text>
      <Text style={[font.small, { textAlign: 'center', marginVertical: 6, marginBottom: 14 }]}>{body}</Text>
      <Button small title={action} onPress={onPress} />
    </View>
  );
}
void Platform; void StyleSheet;

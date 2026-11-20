import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CameraRef } from '@maplibre/maplibre-react-native';
import { Ionicons } from './Icon';
import { Alert } from '../lib/alert';
import { Button, IconButton, Pressy, Text } from '../components/ui';
import { DestinationCard, type CardData, CardSkeletonRow } from '../components/Bits';
import { CreekMap, type MapPin } from '../components/CreekMap';
import { useApp } from '../state/app';
import { useHome } from './homeData';
import { SHORTCUT_OPTIONS, WIDGET_META, type WidgetInstance } from './schema';
import { colors, font, radius, runtime, shadow } from '../theme';
import { onColor } from './colorUtils';
import { guideHref, itemHref } from '../lib/nav';
import { canSaveMore, copyCoords } from '../lib/actions';
import { formatCoords, formatDistance, formatDuration, haversine } from '../lib/geo';
import { watchFixes, type Fix } from '../lib/location';
import { fx } from './motion';
import { FadeInDown } from 'react-native-reanimated';
import Animated from 'react-native-reanimated';
import type { ExploreItem } from '../types';

// ------------------------------------------------------------------ frame + tone
export interface Tone { bg: string; fg: string; muted: string; card: boolean }
export function toneFor(w: WidgetInstance): Tone {
  switch (w.bg) {
    case 'tint': return { bg: colors.waterTint, fg: colors.ink, muted: colors.muted, card: true };
    case 'primary': return { bg: colors.primary, fg: colors.onPrimary, muted: colors.onPrimary, card: true };
    case 'dark': return { bg: '#0F1A15', fg: '#FFFFFF', muted: 'rgba(255,255,255,0.7)', card: true };
    case 'glass': return { bg: colors.overlay, fg: colors.ink, muted: colors.muted, card: true };
    case 'custom': { const bg = w.customBg ?? '#FFFFFF'; const fg = onColor(bg); return { bg, fg, muted: fg, card: true }; }
    case 'none': return { bg: 'transparent', fg: colors.ink, muted: colors.muted, card: false };
    default: return { bg: colors.surface, fg: colors.ink, muted: colors.muted, card: true };
  }
}
const isCardless = (w: WidgetInstance) => w.bg === 'none';

export function WidgetFrame({ w, title, icon, right, children, plain }: { w: WidgetInstance; title?: string; icon?: string; right?: React.ReactNode; children: React.ReactNode; plain?: boolean }) {
  const t = toneFor(w);
  const meta = WIDGET_META[w.type];
  return (
    <Animated.View entering={fx(FadeInDown, 420)} style={{ marginTop: 14 * runtime.density }}>
      <View style={t.card ? [{ backgroundColor: t.bg, borderRadius: radius.lg, padding: 16 * runtime.density, overflow: 'hidden', borderWidth: w.bg === 'glass' ? 1 : 0, borderColor: colors.line }, w.bg === 'glass' ? {} : shadow.soft] : undefined}>
        {title !== '' && !plain && (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 * runtime.density, gap: 8 }}>
            <Ionicons name={(icon ?? meta.icon) as any} size={18} color={t.card && w.bg !== 'default' && w.bg !== 'tint' && w.bg !== 'glass' ? t.fg : colors.primary} />
            <Text style={[font.h2, { flex: 1, color: t.fg, fontSize: 18 }]}>{title ?? meta.title}</Text>
            {right}
          </View>
        )}
        {children}
      </View>
    </Animated.View>
  );
}

// ------------------------------------------------------------------ helpers
const toCard = (i: ExploreItem, saved = false): CardData => ({ key: i.key, name: i.name, kind: i.kind, photoUrl: i.photo?.url, credit: i.photo?.credit, location: i.town ? `Near ${i.town}` : null, distance_m: i.distance_m, rating: i.avg_rating, ratingCount: i.rating_count, desc: i.description, source: i.source, saved });

function Cards({ w, cards, onPress, loading, empty }: { w: WidgetInstance; cards: CardData[]; onPress: (c: CardData, i: number) => void; loading?: boolean; empty?: string }) {
  const { imperial } = useApp(); const t = toneFor(w);
  if (loading) return <CardSkeletonRow />;
  if (!cards.length) return <Text style={{ color: t.muted, fontSize: 13.5 }}>{empty ?? 'Nothing to show yet.'}</Text>;
  if (w.size === 'large') return <View>{cards.slice(0, 3).map((c, i) => <DestinationCard key={c.key} d={c} index={i} variant="full" imperial={imperial} onPress={() => onPress(c, i)} />)}</View>;
  const v = w.size === 'small' ? 'mini' : 'wide';
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 * runtime.density }} contentContainerStyle={{ paddingHorizontal: 16 * runtime.density, paddingBottom: 6 }}>
      {cards.map((c, i) => <DestinationCard key={c.key} d={c} index={i} variant={v} imperial={imperial} onPress={() => onPress(c, i)} />)}
    </ScrollView>
  );
}
const Stat = ({ label, value, fg, muted }: { label: string; value: string; fg: string; muted: string }) => (
  <View style={{ flex: 1 }}><Text style={{ color: muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.6 }}>{label.toUpperCase()}</Text><Text style={{ color: fg, fontSize: 19, fontWeight: '800' }} numberOfLines={1}>{value}</Text></View>
);

// ------------------------------------------------------------------ header (greeting, location, weather, avatar, alerts bell)
export function HeaderContent({ onDark, compact }: { onDark?: boolean; compact?: boolean }) {
  const router = useRouter(); const home = useHome(); const { user, displayName, imperial } = useApp();
  const hr = new Date().getHours();
  const greet = hr < 5 ? 'Late night' : hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
  const name = user ? displayName.split(/[ ._]/)[0] : 'Explorer';
  const fg = onDark ? '#fff' : colors.ink, mu = onDark ? 'rgba(255,255,255,0.85)' : colors.muted;
  const temp = home.wx ? (imperial ? `${Math.round(home.wx.tempF)}°F` : `${Math.round(home.wx.tempC)}°C`) : null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View style={{ flex: 1 }} pointerEvents="none">
        <Text style={{ color: mu, fontSize: 14, fontWeight: '600' }}>{greet},</Text>
        <Text style={{ color: fg, fontSize: compact ? 22 : 27, fontWeight: '800', letterSpacing: -0.5 }}>{name} 👋</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 }}><Ionicons name="location-sharp" size={14} color={fg} /><Text style={{ color: fg, fontSize: 13.5, fontWeight: '600', flexShrink: 1 }} numberOfLines={1}>{home.place ?? (home.me ? 'Your location' : 'Locating…')}</Text></View>
        {home.wx && temp ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: onDark ? 'rgba(255,255,255,0.22)' : colors.surface2, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 14, alignSelf: 'flex-start', marginTop: 6 }}>
            <Ionicons name={home.wx.icon as any} size={15} color={fg} /><Text style={{ color: fg, fontSize: 13, fontWeight: '700' }}>{temp} · {home.wx.label}</Text>
          </View>) : null}
      </View>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        <IconButton icon="notifications-outline" label="Alerts" badge={home.unread > 0 || home.alerts > 0} onPress={() => router.push('/alerts')} />
        <Pressy onPress={() => router.push('/(tabs)/profile')} accessibilityLabel="Profile" style={{ width: 44, height: 44, borderRadius: 22, overflow: 'hidden', backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' }}>
          {home.avatar ? <Image source={{ uri: home.avatar }} style={{ width: 44, height: 44 }} /> : <Text style={{ color: colors.onPrimary, fontWeight: '800', fontSize: 17 }}>{name.slice(0, 1).toUpperCase()}</Text>}
        </Pressy>
      </View>
    </View>
  );
}
export function HeaderWidget({ w }: { w: WidgetInstance }) {
  const t = toneFor(w);
  return <WidgetFrame w={w} title="" plain><View style={{ paddingVertical: w.size === 'small' ? 0 : 4 }}><HeaderContent onDark={t.card && ['primary', 'dark'].includes(w.bg)} compact={w.size === 'small'} /></View></WidgetFrame>;
}

// ------------------------------------------------------------------ explore map
const H = Dimensions.get('window').height;
export function ExploreMapWidget({ w, withHeader }: { w: WidgetInstance; withHeader: boolean }) {
  const router = useRouter(); const insets = useSafeAreaInsets(); const home = useHome(); const { premium } = useApp();
  const cam = useRef<CameraRef>(null);
  const height = w.size === 'small' ? 220 : w.size === 'medium' ? 330 : Math.min(470, Math.max(390, H * 0.5)) + (withHeader ? 0 : 0);
  const fullBleed = withHeader && w.size === 'large';
  useEffect(() => { if (home.me) cam.current?.jumpTo({ center: [home.me.lng, home.me.lat], zoom: 11.5 }); }, [home.me]);
  const pins: MapPin[] = useMemo(() => [
    ...(home.osm ?? []).slice(0, 80).map((i) => ({ id: `o:${i.key}`, lat: i.lat, lng: i.lng, name: i.name, group: 'osm' as const, kind: i.kind })),
    ...home.comm.map((i) => ({ id: `c:${i.placeId}`, lat: i.lat, lng: i.lng, name: i.name, group: 'community' as const, kind: i.kind })),
    ...home.places.map((p) => ({ id: `s:${p.id}`, lat: p.lat, lng: p.lng, name: p.name, group: 'saved' as const, kind: p.kind })),
  ], [home.osm, home.comm, home.places]);
  const onPin = (p: MapPin) => { const [t, id] = [p.id.slice(0, 1), p.id.slice(2)]; if (t === 's') router.push(guideHref({ source: 'saved', id })); else if (t === 'c') router.push(guideHref({ source: 'community', id })); else { const it = (home.osm ?? []).find((x) => x.key === id); if (it) router.push(itemHref(it)); } };
  const save = async () => { if (await canSaveMore(premium, router.push)) router.push('/save'); };
  return (
    <View style={fullBleed ? { marginHorizontal: -18 * runtime.density } : { marginTop: 14 * runtime.density }}>
      <View style={[{ height: fullBleed ? height : height, backgroundColor: colors.primaryDeep, overflow: 'hidden' }, fullBleed ? {} : { borderRadius: radius.lg, ...shadow.card }]}>
        <CreekMap pins={pins} cameraRef={cam} onPressPin={onPin} attributionBottom={withHeader ? 96 : 64} initial={home.me ? { center: [home.me.lng, home.me.lat], zoom: 11.5 } : undefined} />
        {withHeader && (<>
          <LinearGradient pointerEvents="none" colors={['rgba(5,14,10,0.72)', 'rgba(5,14,10,0)']} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 170 }} />
          <View style={{ position: 'absolute', top: (fullBleed ? insets.top : 0) + 12, left: 18, right: 18 }} pointerEvents="box-none"><HeaderContent onDark /></View>
        </>)}
        <View style={{ position: 'absolute', right: 12, bottom: w.size === 'small' ? 68 : 84 }}><IconButton size={40} icon="expand" label="Open full map" onPress={() => router.push('/(tabs)/map')} /></View>
        <View style={{ position: 'absolute', left: 14, right: 14, bottom: 16, flexDirection: 'row', gap: 10 }}>
          <Pressy style={{ flex: 1.1 }} onPress={() => router.push({ pathname: '/(tabs)/explore', params: { focus: '1' } })} accessibilityLabel="Find a creek">
            <LinearGradient colors={[colors.water, colors.waterDeep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[{ height: 52 * runtime.buttonH, borderRadius: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, shadow.float]}>
              <Ionicons name="search" size={19} color="#fff" /><Text numberOfLines={1} style={{ color: '#fff', fontWeight: '800', fontSize: 13.5, letterSpacing: 0.3 }}>FIND A CREEK</Text>
            </LinearGradient>
          </Pressy>
          <Pressy style={{ flex: 1 }} onPress={save} accessibilityLabel="Save a location">
            <View style={[{ height: 52 * runtime.buttonH, borderRadius: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: colors.overlay }, shadow.float]}>
              <Ionicons name="location" size={18} color={colors.primary} /><Text numberOfLines={1} style={{ fontWeight: '800', fontSize: 12.5, letterSpacing: 0.2 }}>SAVE A LOCATION</Text>
            </View>
          </Pressy>
        </View>
      </View>
    </View>
  );
}

// ------------------------------------------------------------------ quick save
export function QuickSaveWidget({ w }: { w: WidgetInstance }) {
  const router = useRouter(); const { premium } = useApp();
  const t = toneFor(w); const big = w.size === 'large';
  return (
    <WidgetFrame w={w} title="" plain>
      <Pressy accessibilityLabel="Save this creek" onPress={async () => { if (await canSaveMore(premium, router.push)) router.push('/save'); }}>
        <LinearGradient colors={[colors.water, colors.waterDeep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, borderRadius: radius.pill, paddingVertical: (w.size === 'small' ? 13 : big ? 28 : 19) * runtime.buttonH }, shadow.float]}>
          <Ionicons name="location" size={big ? 32 : 24} color="#fff" /><Text style={{ color: '#fff', fontSize: big ? 22 : 17.5, fontWeight: '800', letterSpacing: 0.6 }}>SAVE THIS CREEK</Text>
        </LinearGradient>
      </Pressy>
      {w.size !== 'small' && <Text style={{ color: t.muted, fontSize: 12.5, textAlign: 'center', marginTop: 8 }}>Captures your exact GPS position — works without signal.</Text>}
    </WidgetFrame>
  );
}

// ------------------------------------------------------------------ item carousels
export function NearbyWidget({ w }: { w: WidgetInstance }) {
  const router = useRouter(); const h = useHome();
  const items = useMemo(() => [...(h.osm ?? []), ...h.comm].filter((i) => i.name !== 'Water').sort((a, b) => (a.distance_m ?? 0) - (b.distance_m ?? 0)).slice(0, 12), [h.osm, h.comm]);
  return <WidgetFrame w={w}><Cards w={w} loading={h.osm == null} cards={items.map((i) => toCard(i))} onPress={(_, n) => router.push(itemHref(items[n]))} empty={h.msg ?? 'No named water found nearby.'} /></WidgetFrame>;
}
export function PopularWaterfallsWidget({ w }: { w: WidgetInstance }) {
  const router = useRouter(); const h = useHome();
  const items = useMemo(() => [...(h.osm ?? []), ...h.comm].filter((i) => i.kind === 'waterfall' && i.name !== 'Waterfall (unnamed)').sort((a, b) => Number(!!(b.tags?.wikipedia || b.tags?.wikidata)) - Number(!!(a.tags?.wikipedia || a.tags?.wikidata)) || (b.avg_rating ?? 0) - (a.avg_rating ?? 0) || (a.distance_m ?? 0) - (b.distance_m ?? 0)).slice(0, 10), [h.osm, h.comm]);
  return <WidgetFrame w={w}><Cards w={w} loading={h.osm == null} cards={items.map((i) => toCard(i))} onPress={(_, n) => router.push(itemHref(items[n]))} empty="No named waterfalls found near you." /></WidgetFrame>;
}
export function NewDiscoveriesWidget({ w }: { w: WidgetInstance }) {
  const router = useRouter(); const h = useHome();
  const items = useMemo(() => [...h.comm].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? '')).slice(0, 10), [h.comm]);
  return <WidgetFrame w={w}><Cards w={w} cards={items.map((i) => toCard(i))} onPress={(_, n) => router.push(itemHref(items[n]))} empty="No community discoveries near you yet — be the first to share one." /></WidgetFrame>;
}
const savedCards = (h: ReturnType<typeof useHome>, list: typeof h.places): CardData[] => list.map((p) => ({ key: p.id, name: p.name, kind: p.kind, photoUrl: h.photos[p.id] ? h.uris[h.photos[p.id].id] : null, distance_m: h.me ? haversine(h.me, p) : null, location: p.visibility === 'public' ? 'Shared' : 'Private', desc: p.description, source: 'saved' as const, saved: true }));
export function RecentSavedWidget({ w }: { w: WidgetInstance }) {
  const router = useRouter(); const h = useHome(); const list = h.places.slice(0, 10);
  return <WidgetFrame w={w}><Cards w={w} cards={savedCards(h, list)} onPress={(c) => router.push(guideHref({ source: 'saved', id: c.key }))} empty="Nothing saved yet. Tap SAVE A LOCATION to pin your first creek." /></WidgetFrame>;
}
export function FavoritesWidget({ w }: { w: WidgetInstance }) {
  const router = useRouter(); const h = useHome(); const list = h.places.filter((p) => p.favorite).slice(0, 10);
  return <WidgetFrame w={w}><Cards w={w} cards={savedCards(h, list)} onPress={(c) => router.push(guideHref({ source: 'saved', id: c.key }))} empty="No favorites yet — tap the heart on any saved place." /></WidgetFrame>;
}
export function RecentVisitedWidget({ w }: { w: WidgetInstance }) {
  const router = useRouter(); const h = useHome(); const t = toneFor(w);
  return (
    <WidgetFrame w={w}>
      {h.visits.length === 0 ? <Text style={{ color: t.muted, fontSize: 13.5 }}>No visits yet. Use “Check in here” on a creek page when you arrive.</Text> : h.visits.slice(0, w.size === 'small' ? 2 : w.size === 'medium' ? 4 : 8).map((v) => (
        <Pressy key={v.id} onPress={() => (v.place_id ? router.push(guideHref({ source: 'saved', id: v.place_id })) : router.push(guideHref({ source: 'osm', name: v.name, kind: v.kind ?? 'creek', lat: v.lat, lng: v.lng })))} scale={0.98} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 }}>
          <Ionicons name="walk" size={18} color={colors.primary} /><View style={{ flex: 1 }}><Text style={{ color: t.fg, fontWeight: '700' }} numberOfLines={1}>{v.name}</Text><Text style={{ color: t.muted, fontSize: 12.5 }}>{new Date(v.ts).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</Text></View>
        </Pressy>))}
    </WidgetFrame>
  );
}

// ------------------------------------------------------------------ weather / conditions
export function WeatherWidget({ w }: { w: WidgetInstance }) {
  const h = useHome(); const { imperial } = useApp(); const t = toneFor(w); const router = useRouter();
  const deg = (c: number) => (imperial ? `${Math.round(c * 9 / 5 + 32)}°` : `${Math.round(c)}°`);
  if (!h.wx) return <WidgetFrame w={w}><Text style={{ color: t.muted, fontSize: 13.5 }}>{h.me ? 'Loading weather…' : h.msg ?? 'Allow location to see weather.'}</Text></WidgetFrame>;
  return (
    <WidgetFrame w={w} right={h.alerts > 0 ? <Pressy onPress={() => router.push('/alerts')}><View style={{ backgroundColor: colors.dangerTint, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 }}><Text style={{ color: colors.danger, fontWeight: '800', fontSize: 12 }}>{h.alerts} alert{h.alerts > 1 ? 's' : ''}</Text></View></Pressy> : null}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Ionicons name={h.wx.icon as any} size={w.size === 'small' ? 30 : 42} color={t.fg === '#FFFFFF' ? '#fff' : colors.water} />
        <View style={{ flex: 1 }}><Text style={{ color: t.fg, fontSize: w.size === 'small' ? 24 : 34, fontWeight: '800' }}>{deg(h.wx.tempC)}{imperial ? 'F' : 'C'}</Text><Text style={{ color: t.muted }}>{h.wx.label}{h.place ? ` · ${h.place}` : ''}</Text></View>
      </View>
      {w.size !== 'small' && h.forecast.length > 0 && (
        <View style={{ flexDirection: 'row', marginTop: 12, gap: 8 }}>
          {h.forecast.slice(0, w.size === 'large' ? 4 : 3).map((d, i) => (
            <View key={d.date} style={{ flex: 1, alignItems: 'center', backgroundColor: t.card && w.bg === 'default' ? colors.surface2 : 'rgba(127,127,127,0.15)', borderRadius: 14, paddingVertical: 9 }}>
              <Text style={{ color: t.muted, fontSize: 11.5, fontWeight: '700' }}>{i === 0 ? 'Today' : new Date(d.date + 'T12:00').toLocaleDateString([], { weekday: 'short' })}</Text>
              <Ionicons name={d.icon as any} size={20} color={t.fg} /><Text style={{ color: t.fg, fontWeight: '800', fontSize: 13 }}>{deg(d.maxC)} <Text style={{ color: t.muted, fontWeight: '600' }}>{deg(d.minC)}</Text></Text>
            </View>))}
        </View>)}
    </WidgetFrame>
  );
}
export function ConditionsWidget({ w }: { w: WidgetInstance }) {
  const h = useHome(); const { imperial } = useApp(); const t = toneFor(w); const router = useRouter();
  const gs = (h.gauges ?? []).filter((g) => g.distance_m < 40000).slice(0, w.size === 'small' ? 1 : w.size === 'medium' ? 2 : 4);
  return (
    <WidgetFrame w={w} right={h.floodAlert ? <View style={{ backgroundColor: colors.dangerTint, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 }}><Text style={{ color: colors.danger, fontWeight: '800', fontSize: 12 }}>FLOOD ALERT</Text></View> : null}>
      {h.gauges == null ? <Text style={{ color: t.muted }}>{h.me ? 'Loading gauges…' : h.msg ?? 'Allow location to see conditions.'}</Text> : gs.length === 0 ? <Text style={{ color: t.muted, fontSize: 13.5 }}>No active USGS stream gauges within 40 km (gauges exist only in the US). Water level unknown here.</Text> : gs.map((g) => (
        <View key={g.siteCode} style={{ paddingVertical: 6 }}>
          <Text style={{ color: t.fg, fontWeight: '700' }} numberOfLines={1}>{g.name}</Text>
          <View style={{ flexDirection: 'row', marginTop: 4 }}>
            <Stat label="Flow" value={g.dischargeCfs != null ? `${Math.round(g.dischargeCfs)} ft³/s` : '—'} fg={t.fg} muted={t.muted} />
            <Stat label="Level" value={g.stageFt != null ? `${g.stageFt.toFixed(2)} ft` : '—'} fg={t.fg} muted={t.muted} />
            <Stat label="Temp" value={g.tempC != null ? (imperial ? `${(g.tempC * 9 / 5 + 32).toFixed(0)}°F` : `${g.tempC.toFixed(0)}°C`) : '—'} fg={t.fg} muted={t.muted} />
          </View>
          <Text style={{ color: t.muted, fontSize: 11.5 }}>{formatDistance(g.distance_m, imperial)} away{g.time ? ` · ${new Date(g.time).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : ''}</Text>
        </View>))}
      <Pressy onPress={() => router.push('/safety')} style={{ marginTop: 6 }}><Text style={{ color: t.card && ['primary', 'dark', 'custom'].includes(w.bg) ? t.fg : colors.primary, fontWeight: '700', fontSize: 13 }}>Safety & emergency sharing →</Text></Pressy>
    </WidgetFrame>
  );
}

// ------------------------------------------------------------------ tracking, GPS, trips, shortcuts
export function TrackingWidget({ w }: { w: WidgetInstance }) {
  const router = useRouter(); const h = useHome(); const { imperial } = useApp(); const t = toneFor(w); const last = h.adventures.find((a) => a.status === 'finished');
  const [now, setNow] = useState(Date.now()); useEffect(() => { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, []);
  const a = h.activeAdventure;
  return (
    <WidgetFrame w={w}>
      {a ? (<View style={{ flexDirection: 'row' }}><Stat label="Recording" value={formatDuration(Math.max(0, Math.round((now - new Date(a.started_at).getTime()) / 1000)))} fg={t.fg} muted={t.muted} /><Stat label="Distance" value={formatDistance(a.distance_m, imperial)} fg={t.fg} muted={t.muted} /></View>)
        : last && w.size !== 'small' ? (<View><Text style={{ color: t.muted, fontSize: 12 }}>LAST ADVENTURE</Text><Text style={{ color: t.fg, fontWeight: '800', fontSize: 16 }}>{last.name}</Text><Text style={{ color: t.muted }}>{formatDistance(last.distance_m, imperial)} · {formatDuration(last.duration_s)}</Text></View>) : <Text style={{ color: t.muted, fontSize: 13.5 }}>Record your GPS trail — works without signal.</Text>}
      <View style={{ marginTop: 10 }}><Button small icon={a ? 'radio-button-on' : 'play-circle'} title={a ? 'Open tracker' : 'Start tracking'} variant={a ? 'danger' : 'primary'} onPress={() => router.push('/track')} /></View>
    </WidgetFrame>
  );
}
export function GpsCoordsWidget({ w }: { w: WidgetInstance }) {
  const t = toneFor(w); const { imperial } = useApp(); const [fix, setFix] = useState<Fix | null>(null);
  useEffect(() => { let off: (() => void) | undefined; void watchFixes(setFix, 3).then((o) => { off = o; }).catch(() => {}); return () => off?.(); }, []);
  return (
    <WidgetFrame w={w}>
      {!fix ? <Text style={{ color: t.muted }}>Waiting for GPS… allow location access.</Text> : (<>
        <Text selectable style={{ color: t.fg, fontSize: w.size === 'small' ? 17 : 22, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{formatCoords(fix.lat, fix.lng, 5)}</Text>
        <View style={{ flexDirection: 'row', marginTop: 8 }}>
          <Stat label="Accuracy" value={fix.accuracy != null ? `±${Math.round(imperial ? fix.accuracy * 3.28 : fix.accuracy)} ${imperial ? 'ft' : 'm'}` : '—'} fg={t.fg} muted={t.muted} />
          {w.size !== 'small' && <Stat label="Elevation" value={fix.altitude != null ? `${Math.round(imperial ? fix.altitude * 3.28084 : fix.altitude)} ${imperial ? 'ft' : 'm'}` : '—'} fg={t.fg} muted={t.muted} />}
        </View>
        {w.size !== 'small' && <View style={{ marginTop: 10 }}><Button small variant="secondary" icon="copy" title="Copy coordinates" onPress={async () => { await copyCoords(fix.lat, fix.lng); Alert.alert('Copied', 'Coordinates copied.'); }} /></View>}
      </>)}
    </WidgetFrame>
  );
}
export function TripPlannerWidget({ w }: { w: WidgetInstance }) {
  const router = useRouter(); const h = useHome(); const t = toneFor(w);
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = h.trips.filter((x) => x.date >= today);
  const next = upcoming[0];
  return (
    <WidgetFrame w={w} right={<Text onPress={() => router.push('/trips')} style={{ color: t.fg, fontWeight: '700', fontSize: 13 }}>All trips</Text>}>
      {next ? (<>
        <Text style={{ color: t.fg, fontWeight: '800', fontSize: 18 }}>{next.name}</Text>
        <Text style={{ color: t.muted }}>{new Date(next.date + 'T12:00').toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })} · {next.stops.length} stop{next.stops.length === 1 ? '' : 's'}</Text>
        {w.size !== 'small' && next.stops.slice(0, w.size === 'large' ? 5 : 2).map((s, i) => <Text key={i} style={{ color: t.fg, marginTop: 4 }}>{i + 1}. {s.name}</Text>)}
      </>) : <Text style={{ color: t.muted, fontSize: 13.5 }}>No upcoming trips. Plan one with stops from your saved places.</Text>}
      <View style={{ marginTop: 10 }}><Button small icon="calendar" title={next ? 'Open planner' : 'Plan a trip'} onPress={() => router.push('/trips')} /></View>
    </WidgetFrame>
  );
}
export function ShortcutsWidget({ w }: { w: WidgetInstance }) {
  const router = useRouter(); const h = useHome(); const t = toneFor(w);
  const items = (w.shortcuts ?? []).map((id) => {
    if (id.startsWith('place:')) { const p = h.places.find((x) => x.id === id.slice(6)); return p ? { id, label: p.name, icon: 'water', go: () => router.push(guideHref({ source: 'saved', id: p.id })) } : null; }
    const o = SHORTCUT_OPTIONS.find((x) => x.id === id); return o ? { id, label: o.label, icon: o.icon, go: () => router.push(o.href as any) } : null;
  }).filter(Boolean) as { id: string; label: string; icon: string; go: () => void }[];
  if (!items.length) return <WidgetFrame w={w} title="Shortcuts"><Text style={{ color: t.muted }}>No shortcuts yet — add some in the Home editor.</Text></WidgetFrame>;
  const big = w.size !== 'small';
  return (
    <WidgetFrame w={w} title={isCardless(w) ? '' : undefined} plain={isCardless(w)}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {items.map((s) => (
          <Pressy key={s.id} accessibilityLabel={s.label} onPress={s.go} style={{ width: w.size === 'large' ? '48%' : undefined, flexGrow: w.size === 'large' ? 0 : 1, flexBasis: w.size === 'large' ? undefined : (big ? '22%' : '18%') }}>
            <View style={[{ backgroundColor: isCardless(w) ? colors.surface : 'rgba(127,127,127,0.14)', borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingVertical: big ? 13 : 9, paddingHorizontal: 6, gap: 5, flexDirection: w.size === 'large' ? 'row' : 'column' }, isCardless(w) ? shadow.soft : {}]}>
              <Ionicons name={s.icon as any} size={big ? 24 : 21} color={isCardless(w) ? colors.primary : t.fg} /><Text numberOfLines={1} style={{ fontSize: 11.5, fontWeight: '700', color: isCardless(w) ? colors.ink : t.fg }}>{s.label}</Text>
            </View>
          </Pressy>))}
      </View>
    </WidgetFrame>
  );
}

export function renderWidget(w: WidgetInstance, hasHeaderWidget: boolean): React.ReactNode {
  switch (w.type) {
    case 'header': return <HeaderWidget key={w.id} w={w} />;
    case 'explore_map': return <ExploreMapWidget key={w.id} w={w} withHeader={!hasHeaderWidget} />;
    case 'quick_save': return <QuickSaveWidget key={w.id} w={w} />;
    case 'nearby': return <NearbyWidget key={w.id} w={w} />;
    case 'recent_saved': return <RecentSavedWidget key={w.id} w={w} />;
    case 'favorites': return <FavoritesWidget key={w.id} w={w} />;
    case 'weather': return <WeatherWidget key={w.id} w={w} />;
    case 'tracking': return <TrackingWidget key={w.id} w={w} />;
    case 'popular_waterfalls': return <PopularWaterfallsWidget key={w.id} w={w} />;
    case 'new_discoveries': return <NewDiscoveriesWidget key={w.id} w={w} />;
    case 'recent_visited': return <RecentVisitedWidget key={w.id} w={w} />;
    case 'gps_coords': return <GpsCoordsWidget key={w.id} w={w} />;
    case 'trip_planner': return <TripPlannerWidget key={w.id} w={w} />;
    case 'conditions': return <ConditionsWidget key={w.id} w={w} />;
    case 'shortcuts': return <ShortcutsWidget key={w.id} w={w} />;
  }
}
void Dimensions;

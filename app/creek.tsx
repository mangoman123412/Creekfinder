import React, { useEffect, useMemo, useRef, useState } from 'react';
import { themed } from '../src/custom/themed';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Switch, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '../src/custom/Icon';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CameraRef } from '@maplibre/maplibre-react-native';
import { Alert } from '../src/lib/alert';
import { Banner, Button, Card, Group, IconButton, Pill, Pressy, Row, Stars, Text } from '../src/components/ui';
import { Fact, FactCard, FactGrid, FeatureList, Gallery, GuideSection, SpeciesRow, type FactItem, type GalleryPhoto } from '../src/components/GuideBits';
import { SourceBadge, openUrl } from '../src/components/Bits';
import { CreekMap } from '../src/components/CreekMap';
import { SafetyPanel } from '../src/components/SafetyPanel';
import { addPhoto, addVisit, deletePlace, getPlace, listFolders, listPhotos, listPlaces, movePlaceToFolder, setFavorite, setVisibility, visitsNear, isInPrivateCollection } from '../src/db/local';
import { useSettings } from '../src/custom/store';
import { DETAIL_META, type DetailSectionId } from '../src/custom/schema';
import { useDbQuery, useLoad, usePhotoUris } from '../src/state/hooks';
import { useApp } from '../src/state/app';
import { watchFixes } from '../src/lib/location';
import { canSaveMore, copyCoords, openDirections, shareLocation } from '../src/lib/actions';
import { pickPhotos, takePhoto } from '../src/lib/photos';
import { formatCoords, formatDMS, formatDistance, haversine } from '../src/lib/geo';
import {
  addComment, blockUser, deleteComment, getComments, getPlacePhotos, getPublicPlace, rate, report, uploadCommunityPhoto,
  type Comment, type PublicPhoto, type PublicPlace, type ReportReason,
} from '../src/lib/community';
import { attributionNote, commonsPhotos, elevationM, osmTags, plantsNear, reverseGeocode, surroundings, waterPhotosNear, wikipediaNear, wildlifeNear, isTree, type Surroundings } from '../src/lib/guide';
import { getNearbyGauges, type Gauge } from '../src/lib/safety';
import { guideHref } from '../src/lib/nav';
import { kindIcon, kindLabel, type Place, type PlaceKind } from '../src/types';
import { colors, font, radius, shadow, space } from '../src/theme';

const HERO = 390;
type Src = 'saved' | 'community' | 'osm';

const GRAD: Record<string, [string, string]> = {
  waterfall: ['#1B6E8F', '#0B2F3F'], swimming_hole: ['#1B8FD0', '#0E3F66'], river: ['#2A6F6A', '#10312F'], stream: ['#3E7D5B', '#12301F'],
  creek: ['#2F7D5B', '#0F3324'], pond_lake: ['#2C6E9B', '#102C45'], spring: ['#4B8F86', '#142F2B'], other: ['#4A6B5A', '#17261F'],
};

const waterwayLabel = (t: Record<string, string> | null, kind: string) => {
  if (t?.waterway) return ({ river: 'River', stream: 'Stream', brook: 'Brook', canal: 'Canal', drain: 'Drain', ditch: 'Ditch', waterfall: 'Waterfall' } as Record<string, string>)[t.waterway] ?? t.waterway;
  if (t?.water) return ({ lake: 'Lake', pond: 'Pond', reservoir: 'Reservoir', river: 'River' } as Record<string, string>)[t.water] ?? t.water;
  if (t?.natural === 'spring') return 'Spring';
  return kindLabel(kind);
};
const numTag = (v?: string): number | null => { if (!v) return null; const n = parseFloat(v.replace(',', '.')); return isFinite(n) ? n : null; };
const turbidityLabel = (n: number) => (n < 5 ? 'Clear' : n < 25 ? 'Slightly cloudy' : n < 100 ? 'Cloudy' : 'Very turbid');

function CreekGuide() {
  const q = useLocalSearchParams<{ source: Src; id?: string; name?: string; kind?: string; lat?: string; lng?: string; osm?: string; desc?: string }>();
  const source = (q.source ?? 'osm') as Src;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, premium, imperial, online } = useApp();
  const cam = useRef<CameraRef>(null);

  // ------------------------------------------------------------ the creek itself
  const saved = useDbQuery(() => (source === 'saved' ? getPlace(q.id!) : Promise.resolve(null)), [q.id, source], null as Place | null);
  const pub = useLoad(() => (source === 'community' ? getPublicPlace(q.id!, user?.id ?? null) : Promise.resolve(null as PublicPlace | null)), [q.id, source, user?.id]);
  const [pubOverride, setPubOverride] = useState<PublicPlace | null>(null);
  const [photoBump, setPhotoBump] = useState(0);
  const pubPlace = pubOverride ?? pub.data;

  const ent = useMemo(() => {
    if (source === 'saved' && saved.data) { const p = saved.data; return { name: p.name, kind: p.kind as string, lat: p.lat, lng: p.lng, desc: p.description }; }
    if (source === 'community' && pubPlace) return { name: pubPlace.name, kind: pubPlace.kind, lat: pubPlace.lat, lng: pubPlace.lng, desc: pubPlace.description };
    if (source === 'osm' && q.lat) return { name: q.name ?? 'Water', kind: q.kind ?? 'creek', lat: Number(q.lat), lng: Number(q.lng), desc: q.desc || null };
    return null;
  }, [source, saved.data, pubPlace, q.lat, q.lng, q.name, q.kind, q.desc]);

  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  useEffect(() => { let off: (() => void) | undefined; void watchFixes((f) => setMe(f), 15).then((o) => { off = o; }).catch(() => {}); return () => off?.(); }, []);

  const lat = ent?.lat ?? 0, lng = ent?.lng ?? 0, ready = !!ent;
  const dist = me && ready ? haversine(me, { lat, lng }) : null;
  const tagsKey = source === 'osm' ? q.osm : '';

  // ------------------------------------------------------------ real-data loaders (each independent)
  const region = useLoad(() => (ready && online ? reverseGeocode(lat, lng) : Promise.resolve(null)), [ready, lat, lng, online]);
  const elev = useLoad(() => (ready && online ? elevationM(lat, lng) : Promise.resolve(null)), [ready, lat, lng, online]);
  const surr = useLoad(() => (ready && online ? surroundings(lat, lng) : Promise.resolve(null as Surroundings | null)), [ready, lat, lng, online]);
  const tags = useLoad(() => (tagsKey && online ? osmTags(tagsKey) : Promise.resolve(null as Record<string, string> | null)), [tagsKey, online]);
  const gauges = useLoad(() => (ready && online ? getNearbyGauges(lat, lng, 6) : Promise.resolve([] as Gauge[])), [ready, lat, lng, online]);
  const plants = useLoad(() => (ready && online ? plantsNear(lat, lng) : Promise.resolve(null)), [ready, lat, lng, online]);
  const wild = useLoad(() => (ready && online ? wildlifeNear(lat, lng) : Promise.resolve(null)), [ready, lat, lng, online]);
  const wiki = useLoad(() => (ready && online ? wikipediaNear(lat, lng) : Promise.resolve(null)), [ready, lat, lng, online]);
  const commons = useLoad(() => (ready && online ? commonsPhotos(lat, lng, 3000, 40) : Promise.resolve(null)), [ready, lat, lng, online]);
  const commPhotos = useLoad(() => (source === 'community' || (source === 'saved' && saved.data?.visibility === 'public') ? getPlacePhotos(source === 'saved' ? q.id! : q.id!) : Promise.resolve([] as PublicPhoto[])), [q.id, source, saved.data?.visibility, photoBump]);
  const ownPhotos = useDbQuery(() => (source === 'saved' ? listPhotos(q.id!) : Promise.resolve([])), [q.id, source], []);
  const ownUris = usePhotoUris(ownPhotos.data);
  const folders = useDbQuery(listFolders, [], []);
  const settings = useSettings();
  const [layoutOv, setLayoutOv] = useState<'compact' | 'standard' | 'detailed' | null>(null);
  const layout = layoutOv ?? settings.detail.layout;
  const visitsHere = useDbQuery(() => (ready ? visitsNear(lat, lng, 150) : Promise.resolve([])), [ready, lat, lng], []);
  const allPlaces = useDbQuery(() => listPlaces(), [], []);
  // optional auto check-in when you are standing at the spot (Settings -> Privacy)
  useEffect(() => {
    if (!settings.privacy.autoCheckIn || !ready || dist == null || dist > 120) return;
    const today = new Date().toDateString();
    if (visitsHere.data.some((v) => new Date(v.ts).toDateString() === today)) return;
    void addVisit({ place_id: source === 'saved' ? q.id! : null, name: ent!.name, kind: ent!.kind, lat, lng, note: 'Auto check-in' });
  }, [dist, ready, settings.privacy.autoCheckIn]); // eslint-disable-line react-hooks/exhaustive-deps

  // ------------------------------------------------------------ photos
  const photos: GalleryPhoto[] = useMemo(() => {
    const out: GalleryPhoto[] = [];
    for (const p of ownPhotos.data) if (ownUris[p.id]) out.push({ id: p.id, uri: ownUris[p.id], by: 'you' });
    const mine = new Set(ownPhotos.data.map((p) => p.id));
    for (const p of commPhotos.data ?? []) if (!mine.has(p.id)) out.push({ id: p.id, uri: p.url, by: 'explorer' });
    if (ent && commons.data) for (const p of waterPhotosNear(commons.data, ent, ent.name, 3).slice(0, 10)) out.push({ id: p.id, uri: p.url, by: 'commons', credit: p.credit, license: p.license, pageUrl: p.pageUrl });
    return out;
  }, [ownPhotos.data, ownUris, commPhotos.data, commons.data, ent]);

  // ------------------------------------------------------------ comments / rating (community)
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState('');
  const commentable = source === 'community' || (source === 'saved' && saved.data?.visibility === 'public');
  const cid = q.id!;
  useEffect(() => { if (commentable && user && online) void getComments(cid).then(setComments).catch(() => {}); }, [commentable, cid, user, online]);

  if (!ent) {
    return <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>{pub.error ? <Text style={font.h3}>This place is no longer available.</Text> : <ActivityIndicator color={colors.primary} />}</View>;
  }

  // ------------------------------------------------------------ derived facts
  const t = tags.data;
  const pickG = (f: (g: Gauge) => number | null) => { const g = (gauges.data ?? []).find((x) => f(x) != null && x.distance_m < 30000); return g ? { v: f(g)!, g } : null; };
  const gFlow = pickG((g) => g.dischargeCfs), gTemp = pickG((g) => g.tempC), gLevel = pickG((g) => g.stageFt), gTurb = pickG((g) => g.turbidity);
  const gSrc = (x: { g: Gauge } | null) => (x ? `USGS gauge ${formatDistance(x.g.distance_m, imperial)} away${x.g.time ? `, ${new Date(x.g.time).toLocaleDateString([], { month: 'short', day: 'numeric' })}` : ''}` : undefined);
  const width = numTag(t?.width) ?? numTag(t?.est_width);
  const depthTag = numTag(t?.depth);
  const p = saved.data, pp = pubPlace;
  const depthNote = p?.depth_notes ?? pp?.depth_notes ?? null;
  const waterNote = p?.water_notes ?? pp?.water_notes ?? null;
  const mentionsSwim = /\bswim|swimming|jump(ing)?\b|wade|wading/i.test([ent.desc, waterNote, depthNote].filter(Boolean).join(' '));
  const swimNearby = surr.data?.swimming.find((s) => s.distance_m < 600);
  const swimming = ent.kind === 'swimming_hole' ? 'Reported as a swimming hole' : mentionsSwim ? 'Mentioned in explorer notes' : swimNearby ? `Swimming area mapped ${formatDistance(swimNearby.distance_m, imperial)} away` : t?.swimming === 'yes' ? 'Mapped as swimmable (OpenStreetMap)' : null;
  const fishing = t?.fishing ? ({ yes: 'Allowed (per OpenStreetMap)', no: 'Not allowed (per OpenStreetMap)', permit: 'Permit required (per OpenStreetMap)', permissive: 'Allowed (per OpenStreetMap)' } as Record<string, string>)[t.fishing] ?? t.fishing : null;
  const r = region.data;
  const elevText = elev.data != null ? (imperial ? `${Math.round(elev.data * 3.28084).toLocaleString()} ft` : `${Math.round(elev.data)} m`) : null;
  const road = surr.data?.roads[0], park = surr.data?.parking[0];
  const locLabel = r?.label || (dist != null ? '' : '');

  const author = pubPlace?.author;
  const rating = pubPlace?.avg_rating ?? null;
  const g = GRAD[ent.kind] ?? GRAD.other;
  const isSaved = source === 'saved';
  const needAuth = (fn: () => void) => (user ? fn() : Alert.alert('Sign in', 'Create a free account to rate, comment, upload photos and save places.', [{ text: 'Not now', style: 'cancel' }, { text: 'Sign in', onPress: () => router.push('/auth') }]));

  // ------------------------------------------------------------ actions
  const saveToMine = async () => {
    if (isSaved) return;
    if (!(await canSaveMore(premium, router.push))) return;
    router.push({ pathname: '/save', params: { lat: String(lat), lng: String(lng), name: ent.name === 'Water' ? '' : ent.name, kind: ent.kind, desc: ent.desc ?? '', ...(source === 'community' ? { source: 'community', from: q.id } : {}) } });
  };
  const addPhotoFlow = () => {
    const run = async (getUris: () => Promise<string[]>) => {
      try {
        const uris = await getUris(); if (!uris.length) return;
        if (isSaved) { for (const u of uris) await addPhoto({ place_id: q.id!, local_uri: u }); return; }
        if (source === 'community') {
          needAuth(async () => {
            try { for (const u of uris) await uploadCommunityPhoto(q.id!, user!.id, u); Alert.alert('Thanks!', 'Your photo was added for other explorers.'); setPhotoBump((n) => n + 1); }
            catch (e: any) { Alert.alert('Could not upload', e.message ?? 'Please try again online.'); }
          });
          return;
        }
        Alert.alert('Save it first', 'Save this spot to My Places to add your own photos to it.', [{ text: 'Not now', style: 'cancel' }, { text: 'Save & add photos', onPress: saveToMine }]);
      } catch (e: any) { Alert.alert('Photos', e.message ?? 'Could not add photo'); }
    };
    Alert.alert('Add photos', undefined, [
      { text: 'Take photo', onPress: () => run(async () => { const u = await takePhoto(); return u ? [u] : []; }) },
      { text: 'Choose from library', onPress: () => run(pickPhotos) },
      { text: 'Cancel', style: 'cancel' }]);
  };

  const toggleShare = (v: boolean) => {
    if (!isSaved || !p) return;
    if (v && !user) { Alert.alert('Sign in to share', 'Sharing publicly needs a free account.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign in', onPress: () => router.push('/auth') }]); return; }
    if (v) Alert.alert('Make this place public?', 'Its exact location, photos, name and description will be visible to all CreekFinder users. Only share places where public access is allowed and safe.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Make public', onPress: () => setVisibility(p.id, 'public') }]);
    else void setVisibility(p.id, 'private');
  };
  const folder = folders.data.find((f) => f.id === p?.folder_id);
  const privateColl = !!folder && (folder.private === 1 || folders.data.some((f) => f.private === 1 && f.id === folder.parent_id));
  const doReport = () => needAuth(() => {
    const reasons: [string, ReportReason][] = [['Incorrect information', 'incorrect'], ['Dangerous conditions', 'dangerous'], ['Private property / no access', 'private_property'], ['Inappropriate content', 'inappropriate'], ['Spam', 'spam']];
    Alert.alert('Report this place', 'What is wrong?', [...reasons.map(([tt, rr]) => ({ text: tt, onPress: async () => { try { await report(user!.id, { placeId: q.id!, reason: rr }); Alert.alert('Thank you', 'We will review this report.'); } catch (e: any) { Alert.alert('Could not report', e.message); } } })), { text: 'Cancel', style: 'cancel' as const }]);
  });

  const topBtn = { position: 'absolute' as const, top: insets.top + 8 };
  const trees = (plants.data ?? []).filter((s) => isTree(s.name));
  const otherPlants = (plants.data ?? []).filter((s) => !isTree(s.name));
  const mapPins = [{ id: 'here', lat, lng, name: ent.name, group: 'target' as const }];

  // ---------------------------------------------------------------- customizable sections
  const order = settings.detail.sections.filter((s) => s.visible).map((s) => s.id);
  const cap = layout === 'compact' ? 2 : layout === 'standard' ? 4 : 8;
  const showSrc = layout !== 'compact';
  const galleryVisible = order.includes('gallery'); const galleryFirst = order[0] === 'gallery';
  const heroPhotos = galleryVisible && galleryFirst ? photos : [];
  const loadingSurr = surr.loading && online;
  const feat = (list: any[] | undefined) => (surr.data ? list ?? [] : loadingSurr ? null : []);
  const nearSaved = allPlaces.data.filter((x) => !(isSaved && x.id === q.id) && haversine({ lat, lng }, x) < 15000).sort((a, b) => haversine({ lat, lng }, a) - haversine({ lat, lng }, b)).slice(0, cap);

  const factOf = (id: DetailSectionId): FactItem | null => {
    switch (id) {
      case 'elevation': return { icon: 'trending-up', label: 'Elevation above sea level', value: elevText, source: 'Terrain data (Open-Meteo)', loading: elev.loading && online };
      case 'depth': return { icon: 'arrow-down', label: 'Depth', value: depthTag != null ? (imperial ? `${Math.round(depthTag * 3.28)} ft` : `${depthTag} m`) : depthNote ? `“${depthNote}”` : null, source: depthTag != null ? 'OpenStreetMap tag' : 'Explorer report' };
      case 'clarity': return { icon: 'eye', label: 'Water clarity', value: gTurb ? `${turbidityLabel(gTurb.v)} (${gTurb.v} FNU)` : waterNote ? `“${waterNote}”` : null, source: gTurb ? gSrc(gTurb) : 'Explorer report', loading: gauges.loading && online };
      case 'temperature': return { icon: 'thermometer', label: 'Water temperature', value: gTemp ? (imperial ? `${(gTemp.v * 9 / 5 + 32).toFixed(1)}°F` : `${gTemp.v.toFixed(1)}°C`) : null, source: gSrc(gTemp), loading: gauges.loading && online };
      case 'flow': return { icon: 'speedometer', label: 'Flow conditions', value: gFlow ? `${Math.round(gFlow.v).toLocaleString()} ft³/s` : null, source: gSrc(gFlow), note: gLevel ? `Gauge height ${gLevel.v.toFixed(2)} ft` : undefined, loading: gauges.loading && online };
      case 'width': return { icon: 'resize', label: 'Creek width', value: width != null ? (imperial ? `${Math.round(width * 3.28)} ft` : `${width} m`) : null, source: 'OpenStreetMap tag' };
      default: return null;
    }
  };
  const isWater = (id: DetailSectionId) => ['depth', 'clarity', 'temperature', 'flow', 'width'].includes(id);
  const Facts = ({ items }: { items: FactItem[] }) => (layout === 'compact' ? <FactGrid items={items} /> : <FactCard>{items.map((f) => <Fact key={f.label} {...f} source={showSrc ? f.source : undefined} />)}</FactCard>);

  const section = (id: DetailSectionId): React.ReactNode => {
    switch (id) {
      case 'gallery':
        return galleryFirst ? null : (
          <GuideSection key={id} icon="images" title="Photos">
            {photos.length === 0 ? <Text style={[font.small, { fontStyle: 'italic', color: colors.faint }]}>No photos yet — be the first to add one.</Text> : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -18 }} contentContainerStyle={{ paddingHorizontal: 18, gap: 10 }}>
                {photos.map((ph) => <Animated.Image key={ph.id} source={{ uri: ph.uri }} style={{ width: 200, height: 140, borderRadius: radius.md }} />)}
              </ScrollView>)}
          </GuideSection>);
      case 'coordinates':
        return (
          <GuideSection key={id} icon="location" title="Location & GPS">
            <Facts items={[
              { icon: 'pin', label: 'GPS coordinates', value: formatCoords(lat, lng, 6), note: formatDMS(lat, lng) },
              ...(layout !== 'compact' ? [{ icon: 'compass', label: 'Latitude · Longitude', value: `${Math.abs(lat).toFixed(6)}° ${lat >= 0 ? 'N' : 'S'}  ·  ${Math.abs(lng).toFixed(6)}° ${lng >= 0 ? 'E' : 'W'}` } as FactItem] : []),
              { icon: 'map', label: 'County', value: r?.county, source: 'OpenStreetMap', loading: region.loading && online },
              { icon: 'flag', label: 'State / region', value: r?.state, source: 'OpenStreetMap', loading: region.loading && online },
              { icon: 'business', label: 'Nearest town', value: r?.town, loading: region.loading && online },
              ...(layout !== 'compact' ? [{ icon: 'navigate', label: 'Distance from you', value: dist != null ? formatDistance(dist, imperial) : null, note: 'Straight-line' } as FactItem] : []),
            ]} />
            <View style={{ height: layout === 'compact' ? 150 : 230, borderRadius: radius.md, overflow: 'hidden', marginTop: space.md, backgroundColor: colors.surface2 }}>
              <CreekMap styleKey="satellite" cameraRef={cam} pins={mapPins} showUser={false} attributionBottom={4} initial={{ center: [lng, lat], zoom: 15 }} />
              <View style={{ position: 'absolute', right: 10, bottom: 26 }}><IconButton size={40} icon="expand" label="Open on full map" onPress={() => router.push({ pathname: '/(tabs)/map', params: { lat: String(lat), lng: String(lng), zoom: '16' } })} /></View>
            </View>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <Button small variant="secondary" icon="copy" title="Copy" style={{ flex: 1 }} onPress={async () => { await copyCoords(lat, lng); Alert.alert('Copied', 'Coordinates copied.'); }} />
              <Button small variant="secondary" icon="share" title="Share location" style={{ flex: 1 }} onPress={() => shareLocation(ent.name, lat, lng)} />
            </View>
          </GuideSection>);
      case 'elevation': { const f = factOf('elevation')!; return <GuideSection key={id} icon="trending-up" title="Elevation"><Facts items={[f]} /></GuideSection>; }
      case 'depth': case 'clarity': case 'temperature': case 'flow': case 'width': return null; // rendered as one grouped "Water" block below
      case 'waterfalls': return <GuideSection key={id} icon="arrow-down-circle" title="Nearby waterfalls"><FeatureList icon="arrow-down-circle" max={cap} items={feat(surr.data?.waterfalls.filter((f) => f.distance_m > 25))} empty="No mapped waterfalls nearby" imperial={imperial} /></GuideSection>;
      case 'trails': return <GuideSection key={id} icon="walk" title="Hiking trails"><FeatureList icon="walk" max={cap} items={feat(surr.data?.trails)} empty="No named trails mapped nearby" imperial={imperial} /></GuideSection>;
      case 'terrain':
        return (
          <GuideSection key={id} icon="leaf" title="Surrounding terrain" sub="Rocks (OpenStreetMap) · plants & wildlife (iNaturalist, ≤3 km)">
            <Sub title="Rock formations & cliffs"><FeatureList icon="triangle" max={cap} items={feat(surr.data?.rocks)} empty="No mapped rock formations nearby" imperial={imperial} /></Sub>
            {layout !== 'compact' && <Sub title="Trees"><SpeciesRow items={plants.data ? trees.slice(0, layout === 'detailed' ? 12 : 8) : plants.loading && online ? null : []} empty="No tree observations recorded nearby" /></Sub>}
            {layout === 'detailed' && <Sub title="Other plants"><SpeciesRow items={plants.data ? otherPlants.slice(0, 10) : plants.loading && online ? null : []} empty="No plant observations recorded nearby" /></Sub>}
            {layout !== 'compact' && <Sub title="Wildlife observations"><SpeciesRow items={wild.data ? wild.data : wild.loading && online ? null : []} empty="No wildlife observations recorded nearby" /></Sub>}
          </GuideSection>);
      case 'parking':
        return (
          <GuideSection key={id} icon="car" title="Parking & roads">
            <Facts items={[
              { icon: 'car', label: 'Nearest parking area', value: park ? `${park.name} · ${formatDistance(park.distance_m, imperial)} away` : null, source: 'OpenStreetMap (public lots only)', note: park ? 'Straight-line distance' : 'No mapped public parking within 4 km', loading: loadingSurr },
              { icon: 'trail-sign', label: 'Nearest road', value: road ? `${road.name} · ${formatDistance(road.distance_m, imperial)}` : null, source: 'OpenStreetMap', loading: loadingSurr },
            ]} />
          </GuideSection>);
      case 'access':
        return (
          <GuideSection key={id} icon="key" title="Access information">
            <Facts items={[
              { icon: 'body', label: 'Swimming reported', value: swimming, source: 'Explorers / OpenStreetMap', loading: loadingSurr && !swimming },
              { icon: 'fish', label: 'Fishing permitted', value: fishing, note: 'Always check local regulations and licenses' },
              { icon: 'lock-closed', label: 'Land access', value: t?.access ? ({ yes: 'Open to the public', permissive: 'Permitted (revocable)', private: 'Private — do not enter', no: 'No access', permit: 'Permit required', customers: 'Customers only' } as Record<string, string>)[t.access] ?? t.access : null, source: 'OpenStreetMap tag' },
              { icon: 'cash', label: 'Fee', value: t?.fee ? (t.fee === 'yes' ? 'Fee required' : t.fee === 'no' ? 'Free' : t.fee) : null, source: 'OpenStreetMap tag' },
            ]} />
            <Text style={[font.small, { marginTop: 8 }]}>CreekFinder does not show property boundaries. If you can't confirm public access, don't go. Respect signs and fences.</Text>
          </GuideSection>);
      case 'reviews':
        return (
          <GuideSection key={id} icon="star" title="Reviews">
            {source === 'community' && pubPlace ? (
              <Card>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Stars value={rating ?? 0} size={22} /><Text style={font.small}>{rating ? `${rating.toFixed(1)} · ${pubPlace.rating_count} rating${pubPlace.rating_count === 1 ? '' : 's'}` : 'No ratings yet'}</Text></View>
                {user?.id !== pubPlace.user_id && (<View style={{ marginTop: 12 }}><Text style={font.label}>Your rating</Text>
                  <Stars value={pubPlace.my_rating ?? 0} size={32} onChange={(n) => needAuth(async () => { try { await rate(pubPlace.id, user!.id, n); setPubOverride(await getPublicPlace(pubPlace.id, user!.id)); } catch (e: any) { Alert.alert('Error', e.message); } })} /></View>)}
              </Card>
            ) : <Text style={[font.small, { fontStyle: 'italic', color: colors.faint }]}>{isSaved ? 'Share this place publicly to collect community ratings.' : 'No community reviews yet — save and share this spot to start them.'}</Text>}
            {commentable && (<>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                <TextInput value={text} onChangeText={setText} placeholder="Add a comment (be kind & accurate)" placeholderTextColor={colors.faint} maxLength={1000} multiline style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: 12, minHeight: 46, color: colors.ink }} />
                <Button small title="Post" disabled={!text.trim()} onPress={() => needAuth(async () => { try { await addComment(cid, user!.id, text); setText(''); setComments(await getComments(cid)); } catch (e: any) { Alert.alert('Could not post', e.message); } })} />
              </View>
              {comments.slice(0, layout === 'compact' ? 2 : 50).map((c) => (
                <Card key={c.id} style={{ marginTop: 8, padding: 12 }}>
                  <Text style={{ fontWeight: '700' }}>{c.author} <Text style={font.small}>· {new Date(c.created_at).toLocaleDateString()}</Text></Text><Text style={font.body}>{c.body}</Text>
                  {c.user_id === user?.id
                    ? <Text style={{ color: colors.danger, fontWeight: '700', marginTop: 6 }} onPress={async () => { await deleteComment(c.id); setComments(await getComments(cid)); }}>Delete</Text>
                    : <Text style={{ color: colors.muted, fontWeight: '700', marginTop: 6 }} onPress={() => needAuth(async () => { try { await report(user!.id, { commentId: c.id, reason: 'inappropriate' }); Alert.alert('Reported', 'Thanks — we will review this comment.'); } catch (e: any) { Alert.alert('Error', e.message); } })}>Report</Text>}
                </Card>))}
            </>)}
          </GuideSection>);
      case 'reports': {
        const notes = [['What makes it special', ent.desc], ['Water', waterNote], ['Depth', depthNote], ['Surroundings', p?.surroundings ?? pp?.surroundings], ['Private notes', p?.notes]].filter(([, v]) => v);
        return (
          <GuideSection key={id} icon="chatbubbles" title="Community reports" sub={isSaved ? 'Your notes' : author ? `Shared by ${author}` : undefined}>
            {notes.length ? <Card>{notes.map(([l, v], n) => <View key={l as string} style={{ marginTop: n ? 10 : 0 }}><Text style={font.label}>{l}</Text><Text style={font.body}>{v}</Text></View>)}</Card> : <Text style={[font.small, { fontStyle: 'italic', color: colors.faint }]}>No reports or notes for this place yet.</Text>}
            {source === 'community' && pubPlace && user?.id !== pubPlace.user_id && <View style={{ marginTop: 10 }}><Button small variant="secondary" icon="flag" title="Report incorrect or dangerous info" onPress={doReport} /></View>}
          </GuideSection>);
      }
      case 'weather': return <GuideSection key={id} icon="shield-checkmark" title="Weather & safety"><SafetyPanel lat={lat} lng={lng} /></GuideSection>;
      case 'nearby':
        return (
          <GuideSection key={id} icon="navigate-circle" title="Nearby locations">
            {nearSaved.length > 0 && <Sub title="Your saved places nearby">{nearSaved.map((x) => (
              <Pressy key={x.id} scale={0.98} onPress={() => router.push(guideHref({ source: 'saved', id: x.id }))} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: radius.sm + 2, padding: 12, marginBottom: 8 }}>
                <Ionicons name="bookmark" size={18} color={colors.primary} /><Text style={{ flex: 1, fontWeight: '600' }} numberOfLines={1}>{x.name}</Text><Text style={font.small}>{formatDistance(haversine({ lat, lng }, x), imperial)}</Text></Pressy>))}</Sub>}
            <Sub title="Swimming areas"><FeatureList icon="body" max={cap} items={feat(surr.data?.swimming)} empty="No mapped swimming areas nearby" imperial={imperial} /></Sub>
            <Sub title="Bridges"><FeatureList icon="git-compare" max={cap} items={feat(surr.data?.bridges)} empty="No mapped bridges nearby" imperial={imperial} /></Sub>
            <Sub title="Camping (publicly accessible)"><FeatureList icon="bonfire" max={cap} items={feat(surr.data?.camping)} empty="No public campgrounds mapped nearby" imperial={imperial} /></Sub>
            {layout !== 'compact' && wiki.data && wiki.data.slice(0, layout === 'detailed' ? 5 : 3).map((a) => (
              <Card key={a.title} style={{ marginBottom: 10, padding: 12 }}><Text style={font.h3}>{a.title}</Text><Text style={[font.small, { marginTop: 2 }]} numberOfLines={3}>{a.extract}</Text>
                <Text onPress={() => openUrl(a.url)} style={{ color: colors.water, fontWeight: '700', fontSize: 13, marginTop: 6 }}>Wikipedia · {formatDistance(a.distance_m, imperial)} away</Text></Card>))}
          </GuideSection>);
      case 'history':
        return (
          <GuideSection key={id} icon="time" title="Historical visits" sub="Check-ins at this spot (stored on this device)">
            {visitsHere.data.length === 0 ? <Text style={[font.small, { fontStyle: 'italic', color: colors.faint }]}>No visits recorded yet.</Text> : visitsHere.data.slice(0, cap).map((v) => (
              <View key={v.id} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.sm + 2, padding: 12, marginBottom: 8 }}>
                <Ionicons name="walk" size={18} color={colors.primary} /><View style={{ flex: 1 }}><Text style={{ fontWeight: '700' }}>{new Date(v.ts).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</Text>{v.note ? <Text style={font.small}>{v.note}</Text> : null}</View></View>))}
            <Button small icon="checkmark-circle" title="Check in here" onPress={checkIn} style={{ marginTop: 6 }} />
          </GuideSection>);
    }
  };

  const checkIn = async () => {
    if (dist == null || dist > 500) { Alert.alert('Too far to check in', 'You can check in when you are within 500 m (about 1,600 ft) of this spot.'); return; }
    await addVisit({ place_id: isSaved ? q.id! : null, name: ent.name, kind: ent.kind, lat, lng }); Alert.alert('Checked in', `Visit to ${ent.name} recorded.`);
  };


  // consecutive water-fact sections become ONE "Water information" block, in the user's order
  const blocks: React.ReactNode[] = [];
  let water: DetailSectionId[] = [];
  const flush = () => { if (!water.length) return; const items = water.map((id) => factOf(id)!).filter(Boolean); blocks.push(
    <GuideSection key={`water-${water.join('-')}`} icon="water" title="Water information" sub="Real measurements only — unknown stays unknown"><Facts items={items} />
      {layout !== 'compact' && <Text style={[font.small, { marginTop: 8 }]}>Gauge readings come from the nearest USGS station and may be on a different stream. Gauges exist only in the US and many creeks have none.</Text>}</GuideSection>); water = []; };
  for (const id of order) { if (isWater(id)) water.push(id); else { flush(); const node = section(id); if (node) blocks.push(node); } }
  flush();

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <Gallery photos={heroPhotos} height={layout === 'compact' ? 300 : HERO} gradient={g} kindIcon={kindIcon(ent.kind) as any}>
          <View style={[topBtn, { left: 16 }]}><IconButton icon="chevron-back" label="Back" onPress={() => router.back()} /></View>
          <View style={[topBtn, { right: 16, flexDirection: 'row', gap: 10 }]}>
            {isSaved && p && <IconButton icon={p.favorite ? 'heart' : 'heart-outline'} label={p.favorite ? 'Remove from favorites' : 'Add to favorites'} active={!!p.favorite} onPress={() => setFavorite(p.id, !p.favorite)} />}
            <IconButton icon="share-outline" label="Share" onPress={() => shareLocation(ent.name, lat, lng)} />
            <IconButton icon={isSaved ? 'bookmark' : 'bookmark-outline'} label={isSaved ? 'Saved' : 'Save to My Places'} active={isSaved} onPress={saveToMine} />
          </View>
          <View pointerEvents="none" style={{ position: 'absolute', left: 18, right: 18, bottom: 18 }}>
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
              <Pill tone="dark" icon={kindIcon(ent.kind) as any} label={waterwayLabel(t, ent.kind)} />
              {source === 'community' ? <Pill tone={pubPlace?.verified ? 'ok' : 'amber'} icon={pubPlace?.verified ? 'shield-checkmark' : 'people'} label={pubPlace?.verified ? 'Verified' : 'Community · unverified'} /> : source === 'osm' ? <Pill tone="dark" icon="map" label="OpenStreetMap" /> : null}
            </View>
            <Animated.Text numberOfLines={2} style={{ color: '#fff', fontSize: 31 * (layout === 'compact' ? 0.85 : 1), lineHeight: 35, fontFamily: 'Inter_800ExtraBold', letterSpacing: -0.7 }}>{ent.name}</Animated.Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 }}>
              <Ionicons name="location-sharp" size={15} color="rgba(255,255,255,0.9)" />
              <Text style={{ color: 'rgba(255,255,255,0.95)', fontSize: 14.5, flexShrink: 1 }} numberOfLines={1}>{locLabel || (region.loading && online ? 'Finding location…' : formatCoords(lat, lng, 4))}</Text>
            </View>
          </View>
        </Gallery>

        <View style={{ marginTop: -18, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: colors.bg, paddingHorizontal: 18, paddingTop: 18 }}>
          <View style={[{ flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.md, paddingVertical: 14 }, shadow.soft]}>
            <Stat icon="navigate" label="From you" value={dist != null ? formatDistance(dist, imperial) : '—'} /><Div />
            <Stat icon="star" label="Community" value={rating ? rating.toFixed(1) : 'No ratings'} sub={rating ? `${pubPlace?.rating_count} rating${pubPlace?.rating_count === 1 ? '' : 's'}` : undefined} /><Div />
            <Stat icon="trending-up" label="Elevation" value={elevText ?? (elev.loading && online ? '…' : 'Unknown')} />
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: space.md }}>
            <Button style={{ flex: 1 }} small icon="navigate" title="Find it" onPress={() => router.push({ pathname: '/navigate', params: isSaved ? { id: q.id } : { lat: String(lat), lng: String(lng), name: ent.name } })} />
            <Button style={{ flex: 1 }} small variant="secondary" icon="car" title="Directions" onPress={() => openDirections(ent.name, lat, lng)} />
            <Button style={{ flex: 1 }} small variant="secondary" icon="camera" title="Photo" onPress={addPhotoFlow} />
          </View>
          {!isSaved && <View style={{ marginTop: 10 }}><Button icon="bookmark" title="Save to My Places" onPress={saveToMine} /></View>}
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 12, alignItems: 'center' }}>
            <Text style={[font.label, { marginRight: 4 }]}>View</Text>
            {(['compact', 'standard', 'detailed'] as const).map((l) => (
              <Pressy key={l} onPress={() => setLayoutOv(l)} accessibilityLabel={`${l} layout`} style={{ paddingHorizontal: 12, height: 30, borderRadius: 15, justifyContent: 'center', backgroundColor: layout === l ? colors.primary : colors.surface2 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: layout === l ? colors.onPrimary : colors.muted }}>{l[0].toUpperCase() + l.slice(1)}</Text></Pressy>))}
            <View style={{ flex: 1 }} /><Pressy onPress={() => router.push('/settings/details')} accessibilityLabel="Customize creek page"><Ionicons name="options" size={20} color={colors.muted} /></Pressy>
          </View>
          {photos.length === 0 && !commons.loading && galleryVisible && <Text style={[font.small, { marginTop: 10, textAlign: 'center' }]}>No photos yet for this spot — be the first to add one.</Text>}

          {blocks}
          {source === 'osm' && order.includes('reviews') && <Banner tone="info" icon="information-circle">This spot comes from OpenStreetMap and hasn't been shared by a CreekFinder explorer yet. Save it, add photos and notes, and share it to help others.</Banner>}

          {isSaved && p && (
            <GuideSection icon="settings" title="Manage this place">
              <Group>
                <Row icon="create" title="Edit details" onPress={() => router.push({ pathname: '/save', params: { id: p.id } })} />
                <Row icon="folder" title="Folder" subtitle={folder?.name ?? 'None'} onPress={() => Alert.alert('Move to folder', undefined, [{ text: 'No folder', onPress: () => movePlaceToFolder(p.id, null) }, ...folders.data.map((f) => ({ text: f.name, onPress: () => movePlaceToFolder(p.id, f.id) })), { text: 'Cancel', style: 'cancel' as const }])} />
                <Row icon="globe" title="Share on community map" subtitle={privateColl ? 'In a private collection — can\'t be shared' : p.visibility === 'public' ? 'Public — visible to everyone' : 'Private — only you can see this'} right={<Switch disabled={privateColl} value={p.visibility === 'public'} onValueChange={toggleShare} trackColor={{ true: colors.water }} />} />
                <Row icon="trash" danger title="Delete place" onPress={() => Alert.alert('Delete this place?', `"${p.name}" and its photos will be removed from all your devices.`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { await deletePlace(p.id); router.back(); } }])} />
              </Group>
            </GuideSection>
          )}
          {source === 'community' && pubPlace && user?.id !== pubPlace.user_id && (
            <View style={{ marginTop: space.xl }}><Group>
              <Row icon="ban" danger title={`Block ${pubPlace.author}`} onPress={() => needAuth(() => Alert.alert(`Block ${pubPlace.author}?`, "You won't see their places or comments anymore.", [{ text: 'Cancel', style: 'cancel' }, { text: 'Block', style: 'destructive', onPress: async () => { try { await blockUser(user!.id, pubPlace.user_id); router.back(); } catch (e: any) { Alert.alert('Error', e.message); } } }]))} />
            </Group></View>
          )}
          <Text style={[font.small, { marginTop: space.xl, lineHeight: 17 }]}>{attributionNote} Everything here can be incomplete or out of date. Verify access and conditions yourself, respect private property, and never enter fast or rising water.</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const Stat = ({ icon, label, value, sub }: { icon: any; label: string; value: string; sub?: string }) => (
  <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: 4 }}>
    <Ionicons name={icon} size={18} color={colors.water} />
    <Text style={{ fontSize: 16, fontWeight: '800', marginTop: 3 }} numberOfLines={1}>{value}</Text>
    <Text style={{ fontSize: 11, color: colors.muted }}>{sub ?? label}</Text>
  </View>
);
const Div = () => <View style={{ width: 1, backgroundColor: colors.line, marginVertical: 4 }} />;
const Sub = ({ title, children }: { title: string; children: React.ReactNode }) => (<View style={{ marginBottom: space.md }}><Text style={[font.label, { marginBottom: 8 }]}>{title}</Text>{children}</View>);
void guideHref; void SourceBadge; void DETAIL_META; void ({} as PlaceKind);
export default themed(CreekGuide);

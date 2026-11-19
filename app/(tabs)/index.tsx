import React, { useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Banner, Button, Card, SectionTitle, Empty, SAFETY_NOTICE } from '../../src/components/ui';
import { PlaceRow, SaveCreekButton } from '../../src/components/Bits';
import { useApp } from '../../src/state/app';
import { useDbQuery } from '../../src/state/hooks';
import { firstPhotos, listAdventures, listPlaces, getActiveAdventureId } from '../../src/db/local';
import { canSaveMore } from '../../src/lib/actions';
import { lastKnown, ensureForegroundPermission } from '../../src/lib/location';
import { haversine, formatDistance, formatDuration } from '../../src/lib/geo';
import { searchOsmWater } from '../../src/lib/explore';
import { colors, font, radius, space } from '../../src/theme';
import { hasMapTiler, hasBackend } from '../../src/config';

export default function Home() {
  const router = useRouter();
  const { premium, imperial, online, pending, user } = useApp();
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  const [nearby, setNearby] = useState<{ name: string; kind: string; lat: number; lng: number; distance_m?: number }[] | null>(null);
  const [nearbyErr, setNearbyErr] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const places = useDbQuery(() => listPlaces(), [], []);
  const photos = useDbQuery(firstPhotos, [], {});
  const advs = useDbQuery(listAdventures, [], []);
  const active = useDbQuery(getActiveAdventureId, [], null as string | null);

  const load = async () => {
    setNearbyErr(null);
    if (!(await ensureForegroundPermission())) { setNearbyErr('Allow location to see water near you.'); return; }
    const l = (await lastKnown()) ?? null;
    if (!l) { setNearbyErr('Waiting for a GPS fix…'); return; }
    setMe(l);
    if (!online) { setNearbyErr('You are offline — nearby discovery needs a connection.'); return; }
    try { setNearby((await searchOsmWater(l, 20000)).slice(0, 5)); } catch { setNearbyErr('Could not load nearby water right now.'); }
  };
  useEffect(() => { void load(); }, [online]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => { if (await canSaveMore(premium, router.push)) router.push('/save'); };
  const recent = places.data.slice(0, 4);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.sand }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
        <LinearGradient colors={[colors.forestDark, colors.forest, '#2E6B52']} style={s.hero}>
          <Text style={s.brand}>CreekFinder</Text>
          <Text style={s.tag}>Find it. Save it. Come back to it.</Text>
          <View style={{ marginTop: space.lg }}><SaveCreekButton onPress={save} /></View>
          {!premium && <Text style={s.limit}>{places.data.length} of 25 free places used</Text>}
        </LinearGradient>

        <View style={{ paddingHorizontal: space.lg }}>
          {!online && <Banner tone="info" icon="cloud-offline">You're offline. Saving places, photos, notes and GPS tracking all still work, and will sync when you're back online.</Banner>}
          {online && pending > 0 && user && <Banner tone="info" icon="sync">{pending} change{pending > 1 ? 's' : ''} waiting to sync.</Banner>}
          {!hasBackend && <Banner tone="info" icon="information-circle">Running in local-only mode: your places are stored on this phone. Connect a backend (see docs/SETUP.md) to enable accounts, backup and community.</Banner>}
          {!hasMapTiler && <Banner tone="info" icon="map">Satellite and topo maps need a MapTiler key (see docs/SETUP.md). The standard map works without one.</Banner>}

          <View style={{ flexDirection: 'row', gap: 12, marginTop: space.md }}>
            <Quick icon="map" label="Open map" onPress={() => router.push('/(tabs)/map')} />
            <Quick icon={active.data ? 'radio-button-on' : 'footsteps'} label={active.data ? 'Recording…' : 'Track hike'} onPress={() => router.push('/track')} accent={!!active.data} />
            <Quick icon="cloud-download" label="Offline maps" onPress={() => router.push('/offline')} />
            <Quick icon="shield-checkmark" label="Safety" onPress={() => router.push('/safety')} />
          </View>

          <SectionTitle right={places.data.length > 4 ? <Text onPress={() => router.push('/(tabs)/places')} style={{ color: colors.water, fontWeight: '700' }}>See all</Text> : undefined}>Recently saved</SectionTitle>
          {recent.length === 0 ? (
            <Card><Empty icon="water" title="No saved creeks yet" body="When you find a beautiful creek, tap SAVE THIS CREEK and it's pinned with exact GPS coordinates." /></Card>
          ) : recent.map((p) => (
            <PlaceRow key={p.id} place={p} photo={photos.data[p.id]} imperial={imperial} onPress={() => router.push({ pathname: '/place/[id]', params: { id: p.id } })}
              distance={me ? haversine(me, p) : null} />
          ))}

          <SectionTitle right={<Text onPress={() => router.push('/(tabs)/explore')} style={{ color: colors.water, fontWeight: '700' }}>Explore</Text>}>Water near you</SectionTitle>
          {nearby == null ? <Text style={font.small}>{nearbyErr ?? 'Looking for nearby water…'}</Text> : nearby.length === 0 ? (
            <Text style={font.small}>No named water features found within 20 km in OpenStreetMap. Try Explore to search elsewhere.</Text>
          ) : nearby.map((n, i) => (
            <Card key={i} style={{ marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Ionicons name="water" size={22} color={colors.water} />
              <View style={{ flex: 1 }}>
                <Text style={font.h3} numberOfLines={1}>{n.name}</Text>
                <Text style={font.small}>OpenStreetMap · {formatDistance(n.distance_m ?? 0, imperial)} away</Text>
              </View>
            </Card>
          ))}
          {nearby && <Text style={[font.small, { marginTop: 2 }]}>Source: OpenStreetMap contributors. Not verified for access or safety.</Text>}

          {advs.data.length > 0 && (
            <>
              <SectionTitle right={<Text onPress={() => router.push('/adventures')} style={{ color: colors.water, fontWeight: '700' }}>History</Text>}>Last adventure</SectionTitle>
              <Card>
                <Text style={font.h3}>{advs.data[0].name}</Text>
                <Text style={font.small}>{formatDistance(advs.data[0].distance_m, imperial)} · {formatDuration(advs.data[0].duration_s)}</Text>
              </Card>
            </>
          )}
          <Banner icon="warning">{SAFETY_NOTICE}</Banner>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Quick({ icon, label, onPress, accent }: { icon: any; label: string; onPress: () => void; accent?: boolean }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Pressable style={[s.quick, accent && { backgroundColor: colors.dangerBg }]} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
        <Ionicons name={icon} size={24} color={accent ? colors.danger : colors.forest} />
      </Pressable>
      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.ink, marginTop: 6, textAlign: 'center' }}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  hero: { padding: space.xl, paddingTop: space.lg, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  brand: { color: '#fff', fontSize: 30, fontWeight: '900', letterSpacing: -0.5 },
  tag: { color: '#BFE0CF', fontSize: 15, marginTop: 2 },
  limit: { color: '#BFE0CF', textAlign: 'center', marginTop: 10, fontSize: 12.5 },
  quick: { width: 58, height: 58, borderRadius: radius.md, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
});

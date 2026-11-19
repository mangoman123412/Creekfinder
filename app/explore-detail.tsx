import React, { useEffect, useState } from 'react';
import { Alert, Linking, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { Banner, Button, Card, SectionTitle } from '../src/components/ui';
import { SourceBadge } from '../src/components/Bits';
import { SafetyPanel } from '../src/components/SafetyPanel';
import { useApp } from '../src/state/app';
import { canSaveMore, openDirections, shareLocation } from '../src/lib/actions';
import { lastKnown } from '../src/lib/location';
import { formatCoords, formatDistance, haversine } from '../src/lib/geo';
import { kindLabel, type PlaceKind } from '../src/types';
import { colors, font, space } from '../src/theme';

/** Detail for an OpenStreetMap water feature (not user-verified). Can be saved into My Places or navigated to. */
export default function ExploreDetail() {
  const q = useLocalSearchParams<{ name: string; kind: string; lat: string; lng: string; osm: string; desc: string }>();
  const router = useRouter();
  const nav = useNavigation();
  const { premium, imperial } = useApp();
  const lat = Number(q.lat), lng = Number(q.lng);
  const [dist, setDist] = useState<number | null>(null);
  useEffect(() => { nav.setOptions({ title: q.name }); void lastKnown().then((l) => l && setDist(haversine(l, { lat, lng }))); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ScrollView style={{ backgroundColor: colors.sand }} contentContainerStyle={{ padding: space.lg, paddingBottom: 60 }}>
      <Text style={font.h1}>{q.name}</Text>
      <Text style={font.small}>{kindLabel(q.kind)}{dist != null ? `  ·  ${formatDistance(dist, imperial)} from you` : ''}</Text>
      <SourceBadge source="osm" />
      <Card style={{ marginTop: space.md }}>
        <Text style={font.h3}>Location</Text>
        <Text selectable style={font.body}>{formatCoords(lat, lng, 5)}</Text>
        {q.desc ? <Text style={[font.body, { marginTop: 8 }]}>{q.desc}</Text> : null}
        <Text style={[font.small, { marginTop: 8 }]}>This feature comes from OpenStreetMap volunteers. It has not been verified by CreekFinder for public access, water quality or safety. It may be on private land.</Text>
        {q.osm ? <Text onPress={() => Linking.openURL(`https://www.openstreetmap.org/${q.osm}`)} style={{ color: colors.water, fontWeight: '700', marginTop: 8 }}>View on OpenStreetMap</Text> : null}
      </Card>
      <View style={{ gap: 10, marginTop: space.lg }}>
        <Button icon="location" title="Save to My Places" onPress={async () => {
          if (await canSaveMore(premium, router.push)) router.push({ pathname: '/save', params: { lat: q.lat, lng: q.lng, name: q.name === 'Water' ? '' : q.name, kind: q.kind, desc: q.desc } });
        }} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button variant="secondary" icon="navigate" title="Find it" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/navigate', params: { lat: q.lat, lng: q.lng, name: q.name } })} />
          <Button variant="secondary" icon="car" title="Directions" style={{ flex: 1 }} onPress={() => openDirections(q.name, lat, lng)} />
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button variant="secondary" icon="map" title="View on map" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/(tabs)/map', params: { lat: q.lat, lng: q.lng, zoom: '14' } })} />
          <Button variant="secondary" icon="share" title="Share" style={{ flex: 1 }} onPress={() => shareLocation(q.name, lat, lng)} />
        </View>
      </View>
      <SectionTitle>Conditions & safety</SectionTitle>
      <SafetyPanel lat={lat} lng={lng} />
    </ScrollView>
  );
}

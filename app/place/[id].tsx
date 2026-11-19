import React, { useEffect, useState } from 'react';
import { Alert, Dimensions, FlatList, ScrollView, Switch, Text, View } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Banner, Button, Card, Chip, Row, SectionTitle } from '../../src/components/ui';
import { SafetyPanel } from '../../src/components/SafetyPanel';
import { deletePlace, getPlace, listFolders, listPhotos, movePlaceToFolder, setVisibility, addPhoto } from '../../src/db/local';
import { useDbQuery, usePhotoUris } from '../../src/state/hooks';
import { useApp } from '../../src/state/app';
import { watchFixes } from '../../src/lib/location';
import { copyCoords, openDirections, shareLocation } from '../../src/lib/actions';
import { formatCoords, formatDistance, formatDMS, haversine } from '../../src/lib/geo';
import { kindLabel, type Place } from '../../src/types';
import { pickPhotos, takePhoto } from '../../src/lib/photos';
import { colors, font, space } from '../../src/theme';

const W = Dimensions.get('window').width;

export default function PlaceDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const nav = useNavigation();
  const { user, imperial } = useApp();
  const place = useDbQuery(() => getPlace(id), [id], null as Place | null);
  const photos = useDbQuery(() => listPhotos(id), [id], []);
  const folders = useDbQuery(listFolders, [], []);
  const uris = usePhotoUris(photos.data);
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  const p = place.data;

  useEffect(() => { if (p) nav.setOptions({ title: p.name }); }, [p, nav]);
  useEffect(() => {
    let off: (() => void) | undefined;
    void watchFixes((f) => setMe(f), 10).then((o) => { off = o; }).catch(() => {});
    return () => off?.();
  }, []);

  if (!p) return <View style={{ flex: 1, backgroundColor: colors.sand }} />;
  const folder = folders.data.find((f) => f.id === p.folder_id);
  const dist = me ? haversine(me, p) : null;

  const toggleShare = async (v: boolean) => {
    if (v && !user) { Alert.alert('Sign in to share', 'Sharing publicly needs a free account.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign in', onPress: () => router.push('/auth') }]); return; }
    if (v) {
      Alert.alert('Make this place public?', 'Its exact location, photos, name and description will be visible to all CreekFinder users on the community map. Only share places where public access is allowed and safe.', [
        { text: 'Cancel', style: 'cancel' }, { text: 'Make public', onPress: () => setVisibility(p.id, 'public') }]);
    } else await setVisibility(p.id, 'private');
  };
  const remove = () => Alert.alert('Delete this place?', `"${p.name}" and its photos will be removed from all your devices.`, [
    { text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { await deletePlace(p.id); router.back(); } }]);
  const pickFolder = () => Alert.alert('Move to folder', undefined, [
    { text: 'No folder', onPress: () => movePlaceToFolder(p.id, null) },
    ...folders.data.map((f) => ({ text: f.name, onPress: () => movePlaceToFolder(p.id, f.id) })),
    { text: 'Cancel', style: 'cancel' as const }]);

  return (
    <ScrollView style={{ backgroundColor: colors.sand }} contentContainerStyle={{ paddingBottom: 60 }}>
      {photos.data.length > 0 ? (
        <FlatList horizontal pagingEnabled showsHorizontalScrollIndicator={false} data={photos.data} keyExtractor={(x) => x.id}
          renderItem={({ item }) => <Image source={{ uri: uris[item.id] }} style={{ width: W, height: 260, backgroundColor: colors.waterLight }} contentFit="cover" transition={200} />} />
      ) : (
        <View style={{ height: 120, backgroundColor: colors.waterLight, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="image-outline" size={36} color={colors.water} /></View>
      )}
      <View style={{ padding: space.lg }}>
        <Text style={font.h1}>{p.name}</Text>
        <Text style={font.small}>{kindLabel(p.kind)}{folder ? `  ·  ${folder.name}` : ''}{p.visibility === 'public' ? '  ·  Shared publicly' : '  ·  Private'}</Text>

        <Card style={{ marginTop: space.md }}>
          <Text style={font.h3}>Exact location</Text>
          <Text selectable style={[font.body, { fontVariant: ['tabular-nums'], marginTop: 4 }]}>{formatCoords(p.lat, p.lng, 6)}</Text>
          <Text selectable style={font.small}>{formatDMS(p.lat, p.lng)}{p.accuracy_m ? `  ·  ±${Math.round(p.accuracy_m)} m when saved` : ''}{p.altitude_m != null ? `  ·  ${Math.round(p.altitude_m * 3.28084)} ft elev.` : ''}</Text>
          <Text style={[font.h2, { color: colors.water, marginTop: 8 }]}>{dist != null ? `${formatDistance(dist, imperial)} from you` : 'Locating you…'}</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <Button small icon="navigate" title="Find it" onPress={() => router.push({ pathname: '/navigate', params: { id: p.id } })} style={{ flex: 1 }} />
            <Button small variant="secondary" icon="car" title="Directions" onPress={() => openDirections(p.name, p.lat, p.lng)} style={{ flex: 1 }} />
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <Button small variant="secondary" icon="copy" title="Copy" onPress={async () => { await copyCoords(p.lat, p.lng); Alert.alert('Copied', 'Coordinates copied to the clipboard.'); }} style={{ flex: 1 }} />
            <Button small variant="secondary" icon="share" title="Share location" onPress={() => shareLocation(p.name, p.lat, p.lng)} style={{ flex: 1 }} />
          </View>
        </Card>

        {[['What makes it special', p.description], ['Water', p.water_notes], ['Depth', p.depth_notes], ['Scenery & surroundings', p.surroundings], ['My notes', p.notes]].map(([t, v]) => v ? (
          <View key={t as string}><SectionTitle>{t}</SectionTitle><Text style={font.body}>{v}</Text></View>
        ) : null)}

        <SectionTitle>Manage</SectionTitle>
        <View style={{ borderRadius: 14, overflow: 'hidden' }}>
          <Row icon="create" title="Edit details" onPress={() => router.push({ pathname: '/save', params: { id: p.id } })} />
          <Row icon="images" title="Add photos" subtitle="Camera or library" onPress={async () => {
            Alert.alert('Add photos', undefined, [
              { text: 'Take photo', onPress: async () => { try { const u = await takePhoto(); if (u) await addPhoto({ place_id: p.id, local_uri: u }); } catch (e: any) { Alert.alert('Camera', e.message); } } },
              { text: 'From library', onPress: async () => { for (const u of await pickPhotos()) await addPhoto({ place_id: p.id, local_uri: u }); } },
              { text: 'Cancel', style: 'cancel' }]);
          }} />
          <Row icon="folder" title="Folder" subtitle={folder?.name ?? 'None'} onPress={pickFolder} />
          <Row icon="globe" title="Share on community map" subtitle={p.visibility === 'public' ? 'Public — visible to everyone' : 'Private — only you can see this'}
            right={<Switch value={p.visibility === 'public'} onValueChange={toggleShare} trackColor={{ true: colors.water }} />} />
          <Row icon="trash" danger title="Delete place" onPress={remove} />
        </View>

        <SectionTitle>Conditions & safety</SectionTitle>
        <SafetyPanel lat={p.lat} lng={p.lng} />
      </View>
    </ScrollView>
  );
}

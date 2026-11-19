import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, FlatList, Platform, ScrollView, View } from 'react-native';
import { Text } from '../../src/components/ui';
import { Alert } from '../../src/lib/alert';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { CameraRef } from '@maplibre/maplibre-react-native';
import { CreekMap } from '../../src/components/CreekMap';
import { Button, Card, Field, SectionTitle } from '../../src/components/ui';
import { addPhoto, deleteAdventure, getAdventure, getTrackPoints, listPhotos, updateAdventure } from '../../src/db/local';
import { useDbQuery, usePhotoUris } from '../../src/state/hooks';
import { useApp } from '../../src/state/app';
import { boundsOfPoints, formatDistance, formatDuration, toGPX } from '../../src/lib/geo';
import { pickPhotos, takePhoto } from '../../src/lib/photos';
import { colors, font, space } from '../../src/theme';

const W = Dimensions.get('window').width;

export default function AdventureDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const nav = useNavigation();
  const { imperial } = useApp();
  const cam = useRef<CameraRef>(null);
  const adv = useDbQuery(() => getAdventure(id), [id], null);
  const pts = useDbQuery(() => getTrackPoints(id), [id], []);
  const photos = useDbQuery(() => listPhotos(null, id), [id], []);
  const uris = usePhotoUris(photos.data);
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => { if (adv.data && !loaded) { setName(adv.data.name); setNotes(adv.data.notes ?? ''); setLoaded(true); nav.setOptions({ title: adv.data.name }); } }, [adv.data, loaded, nav]);
  const track = useMemo(() => pts.data.map((p) => ({ lat: p.lat, lng: p.lng })), [pts.data]);
  const bounds = useMemo(() => boundsOfPoints(track), [track]);
  useEffect(() => { if (bounds) setTimeout(() => cam.current?.fitBounds(bounds, { padding: { top: 40, bottom: 40, left: 40, right: 40 }, duration: 0 }), 500); }, [bounds]);

  if (!adv.data) return null;
  const a = adv.data;

  const exportGpx = async () => {
    try {
      const gpx = toGPX(a.name, pts.data);
      if (Platform.OS === 'web') {
        const url = URL.createObjectURL(new Blob([gpx], { type: 'application/gpx+xml' }));
        const el = document.createElement('a'); el.href = url; el.download = `${a.name.replace(/[^\w\- ]+/g, '').trim() || 'adventure'}.gpx`; el.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        return;
      }
      const dir = new Directory(Paths.cache, 'exports'); if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
      const f = new File(dir, `${a.name.replace(/[^\w\- ]+/g, '').trim() || 'adventure'}.gpx`);
      f.write(gpx);
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(f.uri, { mimeType: 'application/gpx+xml', dialogTitle: 'Export GPX' });
      else Alert.alert('Sharing unavailable', 'This device cannot share files.');
    } catch (e: any) { Alert.alert('Export failed', e.message); }
  };

  return (
    <ScrollView style={{ backgroundColor: colors.sand }} contentContainerStyle={{ paddingBottom: 60 }}>
      <View style={{ height: 280 }}>
        <CreekMap styleKey="standard" cameraRef={cam} track={track} showUser={false} attributionBottom={4}
          pins={track.length ? [{ id: 's', lat: track[0].lat, lng: track[0].lng, name: 'Start', group: 'saved' }, { id: 'e', lat: track[track.length - 1].lat, lng: track[track.length - 1].lng, name: 'End', group: 'target' }] : []}
          initial={track[0] ? { center: [track[0].lng, track[0].lat], zoom: 14 } : undefined} />
      </View>
      <View style={{ padding: space.lg }}>
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
            <Stat label="Distance" value={formatDistance(a.distance_m, imperial)} />
            <Stat label="Time" value={formatDuration(a.duration_s)} />
            <Stat label="Climb" value={imperial ? `${Math.round(a.elevation_gain_m * 3.28084)} ft` : `${Math.round(a.elevation_gain_m)} m`} />
          </View>
          <Text style={[font.small, { textAlign: 'center', marginTop: 8 }]}>{new Date(a.started_at).toLocaleString()}</Text>
        </Card>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: space.md }}>
          <Button small icon="home" title="Retrace to start" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/navigate', params: { adventure: a.id } })} />
          <Button small variant="secondary" icon="share" title="Export GPX" style={{ flex: 1 }} onPress={exportGpx} />
        </View>

        <SectionTitle>Photos</SectionTitle>
        {photos.data.length > 0 && <FlatList horizontal data={photos.data} keyExtractor={(p) => p.id} showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => <Image source={{ uri: uris[item.id] }} style={{ width: 120, height: 120, borderRadius: 12, marginRight: 8 }} />} />}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          <Button small variant="secondary" icon="camera" title="Take photo" style={{ flex: 1 }} onPress={async () => { try { const u = await takePhoto(); if (u) await addPhoto({ adventure_id: a.id, local_uri: u }); } catch (e: any) { Alert.alert('Camera', e.message); } }} />
          <Button small variant="secondary" icon="images" title="Library" style={{ flex: 1 }} onPress={async () => { for (const u of await pickPhotos()) await addPhoto({ adventure_id: a.id, local_uri: u }); }} />
        </View>

        <SectionTitle>Name & notes</SectionTitle>
        <Field label="Name" value={name} onChangeText={setName} />
        <Field label="Notes" value={notes} onChangeText={setNotes} multiline placeholder="What did you find? How was the trail?" />
        <Button title="Save changes" icon="checkmark" onPress={async () => { await updateAdventure(a.id, { name, notes: notes.trim() || null }); Alert.alert('Saved'); }} />
        <View style={{ height: 10 }} />
        <Button variant="danger" icon="trash" title="Delete adventure" onPress={() => Alert.alert('Delete adventure?', 'The recorded trail and notes will be removed.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { await deleteAdventure(a.id); router.back(); } }])} />
      </View>
    </ScrollView>
  );
}
const Stat = ({ label, value }: { label: string; value: string }) => (
  <View style={{ alignItems: 'center' }}><Text style={{ fontSize: 22, fontWeight: '900', color: colors.ink }}>{value}</Text><Text style={{ fontSize: 11.5, color: colors.muted, fontWeight: '700' }}>{label.toUpperCase()}</Text></View>
);

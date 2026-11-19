import React, { useCallback, useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Banner, Button, Card, Chip, Field, SectionTitle } from '../src/components/ui';
import { addPhoto, deletePhoto, getPlace, listFolders, listPhotos, savePlace, countPlaces } from '../src/db/local';
import { getPreciseFix, ensureForegroundPermission, openSettings } from '../src/lib/location';
import { pickPhotos, takePhoto } from '../src/lib/photos';
import { PLACE_KINDS, type Folder, type Photo, type PlaceKind, type Visibility } from '../src/types';
import { useApp } from '../src/state/app';
import { usePhotoUris } from '../src/state/hooks';
import { colors, font, space } from '../src/theme';
import { formatCoords } from '../src/lib/geo';
import { FREE_PLACE_LIMIT } from '../src/config';
import { hasBackend, FREE_PHOTOS_PER_PLACE, PREMIUM_PHOTOS_PER_PLACE } from '../src/config';

export default function SaveScreen() {
  const router = useRouter();
  const { user, premium } = useApp();
  const q = useLocalSearchParams<{ id?: string; lat?: string; lng?: string; name?: string; kind?: string; source?: string; desc?: string; from?: string }>();
  const editing = !!q.id;

  const [name, setName] = useState(q.name ?? '');
  const [kind, setKind] = useState<PlaceKind>((q.kind as PlaceKind) ?? 'creek');
  const [folderId, setFolderId] = useState<string | null>(null);
  const [description, setDescription] = useState(q.desc ?? '');
  const [water, setWater] = useState('');
  const [depth, setDepth] = useState('');
  const [surroundings, setSurroundings] = useState('');
  const [notes, setNotes] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('private');
  const [coord, setCoord] = useState<{ lat: number; lng: number; acc: number | null; alt: number | null } | null>(
    q.lat && q.lng ? { lat: Number(q.lat), lng: Number(q.lng), acc: null, alt: null } : null);
  const [gpsState, setGpsState] = useState<'idle' | 'locking' | 'denied' | 'error'>('idle');
  const [folders, setFolders] = useState<Folder[]>([]);
  const [existing, setExisting] = useState<Photo[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [newPhotos, setNewPhotos] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const lock = useCallback(async () => {
    setGpsState('locking');
    if (!(await ensureForegroundPermission())) { setGpsState('denied'); return; }
    try {
      const f = await getPreciseFix({ targetAccuracyM: 12, timeoutMs: 12000 });
      setCoord({ lat: f.lat, lng: f.lng, acc: f.accuracy, alt: f.altitude });
      setGpsState('idle');
    } catch { setGpsState('error'); }
  }, []);

  useEffect(() => {
    void listFolders().then((f) => { setFolders(f); });
    if (editing) {
      void getPlace(q.id!).then((p) => {
        if (!p) return;
        setName(p.name); setKind(p.kind); setFolderId(p.folder_id); setDescription(p.description ?? ''); setWater(p.water_notes ?? '');
        setDepth(p.depth_notes ?? ''); setSurroundings(p.surroundings ?? ''); setNotes(p.notes ?? ''); setVisibility(p.visibility);
        setCoord({ lat: p.lat, lng: p.lng, acc: p.accuracy_m, alt: p.altitude_m });
      });
      void listPhotos(q.id!).then(setExisting);
    } else if (!coord) void lock();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    if (!coord) { Alert.alert('No location yet', 'Wait for the GPS to lock, or tap "Refresh GPS".'); return; }
    if (!name.trim()) { Alert.alert('Give it a name', 'Add a name so you can find it later, like "Mossy Falls".'); return; }
    if (!editing && !premium && (await countPlaces()) >= FREE_PLACE_LIMIT) { router.replace({ pathname: '/premium', params: { reason: 'limit' } }); return; }
    if (visibility === 'public' && !user) { Alert.alert('Sign in to share', 'Sharing publicly needs a free account.', [{ text: 'Not now', style: 'cancel' }, { text: 'Sign in', onPress: () => router.push('/auth') }]); return; }
    setSaving(true);
    try {
      const id = await savePlace({
        id: q.id, name, kind, lat: coord.lat, lng: coord.lng, accuracy_m: coord.acc, altitude_m: coord.alt, description: description.trim() || null,
        water_notes: water.trim() || null, depth_notes: depth.trim() || null, surroundings: surroundings.trim() || null, notes: notes.trim() || null,
        folder_id: folderId, visibility, source_place_id: q.source === 'community' ? (q.from ?? null) : null,
      });
      for (const r of removed) await deletePhoto(r);
      for (const uri of newPhotos) await addPhoto({ place_id: id, local_uri: uri });
      if (editing) router.back(); else router.replace({ pathname: '/place/[id]', params: { id } });
    } catch (e: any) {
      Alert.alert('Could not save', e?.message ?? 'Please try again.');
    } finally { setSaving(false); }
  };

  const photoCap = premium ? PREMIUM_PHOTOS_PER_PLACE : FREE_PHOTOS_PER_PLACE;
  const room = () => {
    const n = existing.filter((p) => !removed.includes(p.id)).length + newPhotos.length;
    if (n >= photoCap) {
      Alert.alert('Photo limit reached', premium ? `Up to ${photoCap} photos per place.` : `Free places hold ${photoCap} photos. Premium allows ${PREMIUM_PHOTOS_PER_PLACE}.`,
        premium ? [{ text: 'OK' }] : [{ text: 'Not now', style: 'cancel' }, { text: 'See Premium', onPress: () => router.push({ pathname: '/premium', params: { reason: 'photos' } }) }]);
      return false;
    }
    return true;
  };
  const addFromCamera = async () => {
    if (!room()) return; try { const u = await takePhoto(); if (u) setNewPhotos((p) => [...p, u]); } catch (e: any) { Alert.alert('Camera', e.message, [{ text: 'OK' }, { text: 'Settings', onPress: openSettings }]); } };
  const addFromLibrary = async () => {
    if (!room()) return;
    const left = photoCap - (existing.filter((p) => !removed.includes(p.id)).length + newPhotos.length);
    const u = (await pickPhotos()).slice(0, left);
    if (u.length) setNewPhotos((p) => [...p, ...u]);
  };

  const shown = existing.filter((p) => !removed.includes(p.id));
  const uris = usePhotoUris(existing);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.sand }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <Card style={{ backgroundColor: colors.forest }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Ionicons name={coord ? 'locate' : 'locate-outline'} size={28} color="#fff" />
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>
                {gpsState === 'locking' ? 'Locking onto GPS…' : coord ? formatCoords(coord.lat, coord.lng, 6) : gpsState === 'denied' ? 'Location permission needed' : 'No location yet'}
              </Text>
              <Text style={{ color: '#BFE0CF', fontSize: 13 }}>
                {coord ? (coord.acc != null ? `Accurate to about ±${Math.round(coord.acc)} m${coord.acc > 30 ? ' — move to open sky for a better fix' : ''}` : 'Location chosen on the map') : 'Works without cell service'}
              </Text>
            </View>
          </View>
          {!q.lat && (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <Button small variant="secondary" title={editing ? 'Move pin to my location' : 'Refresh GPS'} icon="refresh" onPress={lock} loading={gpsState === 'locking'} />
              {gpsState === 'denied' && <Button small variant="secondary" title="Open Settings" onPress={openSettings} />}
            </View>
          )}
        </Card>

        <View style={{ height: space.lg }} />
        <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Mossy Falls" maxLength={120} autoCapitalize="words" />

        <Text style={labelStyle}>Type</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: space.md }}>
          {PLACE_KINDS.map((k) => <Chip key={k.key} label={k.label} icon={k.icon as any} active={kind === k.key} onPress={() => setKind(k.key)} />)}
        </ScrollView>

        <Text style={labelStyle}>Save to folder</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: space.md }}>
          <Chip label="None" active={folderId == null} onPress={() => setFolderId(null)} />
          {folders.map((f) => <Chip key={f.id} label={f.name} icon={f.icon as any} active={folderId === f.id} onPress={() => setFolderId(f.id)} />)}
        </ScrollView>

        <SectionTitle>Photos</SectionTitle>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {shown.map((p) => (
            <Thumb key={p.id} uri={uris[p.id] ?? null} onRemove={() => setRemoved((r) => [...r, p.id])} />
          ))}
          {newPhotos.map((u) => <Thumb key={u} uri={u} onRemove={() => setNewPhotos((p) => p.filter((x) => x !== u))} />)}
        </ScrollView>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
          <Button small variant="secondary" icon="camera" title="Take photo" onPress={addFromCamera} style={{ flex: 1 }} />
          <Button small variant="secondary" icon="images" title="From library" onPress={addFromLibrary} style={{ flex: 1 }} />
        </View>
        <Text style={[font.small, { marginTop: 6 }]}>Photos are saved on your phone right away and upload automatically when you have signal.</Text>

        <SectionTitle>Details</SectionTitle>
        <Field label="What makes it special?" value={description} onChangeText={setDescription} multiline placeholder="Cold, clear water under a rock ledge…" />
        <Field label="Water (clarity, flow, temperature)" value={water} onChangeText={setWater} multiline placeholder="Clear, slow-moving, shallow riffles…" />
        <Field label="Depth" value={depth} onChangeText={setDepth} placeholder="Ankle deep, waist-deep pool at the bend…" />
        <Field label="Scenery & surroundings" value={surroundings} onChangeText={setSurroundings} multiline placeholder="Hardwood forest, small gravel bar, trailhead 10 min walk…" />
        <Field label="Private notes" value={notes} onChangeText={setNotes} multiline placeholder="Parking, best season, how to get there…" />

        <SectionTitle>Privacy</SectionTitle>
        <Card>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Chip label="Private (only me)" icon="lock-closed" active={visibility === 'private'} onPress={() => setVisibility('private')} />
            <Chip label="Public" icon="globe" active={visibility === 'public'} onPress={() => setVisibility('public')} />
          </View>
          <Text style={[font.small, { marginTop: 10 }]}>
            {visibility === 'private'
              ? 'Private places never appear on the community map and are never shared without you choosing to share them.'
              : 'Public places show on the community map with their exact location, your display name, photos and description. Only share places where public access is allowed and safe. You can switch back to private any time.'}
          </Text>
          {visibility === 'public' && !hasBackend && <Banner tone="info" icon="information-circle">Community sharing needs the backend to be connected.</Banner>}
        </Card>

        <View style={{ height: space.xl }} />
        <Button title={editing ? 'Save changes' : 'Save this creek'} icon="checkmark-circle" onPress={submit} loading={saving} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const labelStyle = { fontSize: 13, fontWeight: '700' as const, color: colors.muted, marginBottom: 8, textTransform: 'uppercase' as const, letterSpacing: 0.4 };

function Thumb({ uri, onRemove }: { uri: string | null; onRemove: () => void }) {
  return (
    <View style={{ marginRight: 10 }}>
      {uri ? <Image source={{ uri }} style={{ width: 96, height: 96, borderRadius: 12 }} /> : <View style={{ width: 96, height: 96, borderRadius: 12, backgroundColor: colors.waterLight }} />}
      <Pressable onPress={onRemove} hitSlop={8} style={{ position: 'absolute', top: -6, right: -6, backgroundColor: colors.danger, borderRadius: 12, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel="Remove photo">
        <Ionicons name="close" size={16} color="#fff" />
      </Pressable>
    </View>
  );
}

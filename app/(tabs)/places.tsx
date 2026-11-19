import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Alert } from '../../src/lib/alert';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Chip, Empty, Button } from '../../src/components/ui';
import { PlaceRow, SaveCreekButton } from '../../src/components/Bits';
import { TextPrompt } from '../../src/components/TextPrompt';
import { useDbQuery, usePhotoUris } from '../../src/state/hooks';
import { createFolder, deleteFolder, firstPhotos, listFolders, listPlaces, renameFolder } from '../../src/db/local';
import { useApp } from '../../src/state/app';
import { canSaveMore } from '../../src/lib/actions';
import { lastKnown } from '../../src/lib/location';
import { haversine } from '../../src/lib/geo';
import { colors, font, radius, space } from '../../src/theme';

export default function MyPlaces() {
  const router = useRouter();
  const { premium, imperial } = useApp();
  const [folder, setFolder] = useState<string | null>(null);   // null = all, 'none' = unfiled
  const [search, setSearch] = useState('');
  const [prompt, setPrompt] = useState<null | { mode: 'new' } | { mode: 'rename'; id: string; name: string }>(null);
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);

  const folders = useDbQuery(listFolders, [], []);
  const places = useDbQuery(() => listPlaces({ folderId: folder, search }), [folder, search], []);
  const photos = useDbQuery(firstPhotos, [], {});
  const uris = usePhotoUris(Object.values(photos.data));
  useEffect(() => { void lastKnown().then(setMe); }, []);

  const data = useMemo(() => {
    const arr = [...places.data];
    if (me) arr.sort((a, b) => haversine(me, a) - haversine(me, b));
    return arr;
  }, [places.data, me]);

  const current = folders.data.find((f) => f.id === folder);
  const manage = () => {
    if (!current) return;
    Alert.alert(current.name, undefined, [
      { text: 'Rename', onPress: () => setPrompt({ mode: 'rename', id: current.id, name: current.name }) },
      { text: 'Delete folder', style: 'destructive', onPress: () => Alert.alert('Delete folder?', 'Places inside are kept and become unfiled.', [
        { text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { await deleteFolder(current.id); setFolder(null); } }]) },
      { text: 'Cancel', style: 'cancel' }]);
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.sand }}>
      <View style={{ paddingHorizontal: space.lg, paddingTop: space.md }}>
        <Text style={font.h1}>My Places</Text>
        <View style={s.search}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput value={search} onChangeText={setSearch} placeholder="Search my creeks and notes" style={{ flex: 1, fontSize: 16 }} returnKeyType="search" clearButtonMode="while-editing" />
        </View>
        <FlatList horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10, flexGrow: 0 }} data={[{ id: '__all' }, ...folders.data, { id: '__none' }, { id: '__new' }] as any[]}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => item.id === '__all' ? <Chip label="All" active={folder == null} onPress={() => setFolder(null)} />
            : item.id === '__none' ? <Chip label="Unfiled" active={folder === 'none'} onPress={() => setFolder('none')} />
            : item.id === '__new' ? <Chip label="New folder" icon="add" onPress={() => setPrompt({ mode: 'new' })} />
            : <Chip label={item.name} icon={item.icon} active={folder === item.id} onPress={() => setFolder(item.id)} />} />
        {current && <Pressable onPress={manage} style={{ alignSelf: 'flex-start', marginTop: 6 }}><Text style={{ color: colors.water, fontWeight: '700' }}>Rename or delete “{current.name}”</Text></Pressable>}
      </View>
      <FlatList
        contentContainerStyle={{ padding: space.lg, paddingBottom: 120, flexGrow: 1 }}
        data={data} keyExtractor={(p) => p.id}
        renderItem={({ item }) => <PlaceRow place={item} photo={photos.data[item.id]} photoUri={photos.data[item.id] ? uris[photos.data[item.id].id] : undefined} imperial={imperial}
          distance={me ? haversine(me, item) : null} onPress={() => router.push({ pathname: '/place/[id]', params: { id: item.id } })} />}
        ListEmptyComponent={<Empty icon="bookmark-outline" title={search ? 'No matches' : 'Nothing here yet'} body={search ? 'Try a different search.' : 'Saved creeks appear here, sorted by what is closest to you.'} />}
      />
      <View style={{ position: 'absolute', left: space.lg, right: space.lg, bottom: space.lg }}>
        <SaveCreekButton compact onPress={async () => { if (await canSaveMore(premium, router.push)) router.push({ pathname: '/save', params: {} }); }} />
      </View>
      <TextPrompt visible={!!prompt} title={prompt?.mode === 'rename' ? 'Rename folder' : 'New folder'} initial={prompt?.mode === 'rename' ? prompt.name : ''} placeholder="e.g. Summer 2026"
        onCancel={() => setPrompt(null)} onSubmit={async (v) => { if (prompt?.mode === 'rename') await renameFolder(prompt.id, v); else await createFolder(v); setPrompt(null); }} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: radius.pill, paddingHorizontal: 14, height: 46, marginTop: space.md, borderWidth: 1, borderColor: colors.line },
});

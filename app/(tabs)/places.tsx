import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Alert } from '../../src/lib/alert';
import { Chip, Empty, Pressy, Text } from '../../src/components/ui';
import { PlaceRow } from '../../src/components/Bits';
import { TextPrompt } from '../../src/components/TextPrompt';
import { useDbQuery, usePhotoUris } from '../../src/state/hooks';
import { createFolder, deleteFolder, firstPhotos, listFolders, listPlaces, renameFolder } from '../../src/db/local';
import { useApp } from '../../src/state/app';
import { canSaveMore } from '../../src/lib/actions';
import { lastKnown } from '../../src/lib/location';
import { haversine } from '../../src/lib/geo';
import { guideHref } from '../../src/lib/nav';
import { colors, font, shadow } from '../../src/theme';

export default function MyPlaces() {
  const router = useRouter();
  const { premium, imperial } = useApp();
  const [folder, setFolder] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [prompt, setPrompt] = useState<null | { mode: 'new' } | { mode: 'rename'; id: string; name: string }>(null);
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);

  const folders = useDbQuery(listFolders, [], []);
  const places = useDbQuery(() => listPlaces({ folderId: folder, search }), [folder, search], []);
  const all = useDbQuery(() => listPlaces(), [], []);
  const photos = useDbQuery(firstPhotos, [], {});
  const uris = usePhotoUris(Object.values(photos.data));
  useEffect(() => { void lastKnown().then(setMe); }, []);

  const data = useMemo(() => { const a = [...places.data]; if (me) a.sort((x, y) => haversine(me, x) - haversine(me, y)); return a; }, [places.data, me]);
  const current = folders.data.find((f) => f.id === folder);
  const manage = () => {
    if (!current) return;
    Alert.alert(current.name, undefined, [
      { text: 'Rename', onPress: () => setPrompt({ mode: 'rename', id: current.id, name: current.name }) },
      { text: 'Delete folder', style: 'destructive', onPress: () => Alert.alert('Delete folder?', 'Places inside are kept and become unfiled.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { await deleteFolder(current.id); setFolder(null); } }]) },
      { text: 'Cancel', style: 'cancel' }]);
  };
  const add = async () => { if (await canSaveMore(premium, router.push)) router.push('/save'); };
  const pubCount = all.data.filter((p) => p.visibility === 'public').length;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingHorizontal: 18, paddingTop: 10 }}>
        <Text style={font.display}>My Places</Text>
        <Text style={[font.small, { marginTop: 2 }]}>{all.data.length} saved{premium ? '' : ' of 25'} · {pubCount} shared · {folders.data.length} folders</Text>
        <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: 26, paddingHorizontal: 16, height: 50, marginTop: 14 }, shadow.soft]}>
          <Ionicons name="search" size={19} color={colors.muted} />
          <TextInput value={search} onChangeText={setSearch} placeholder="Search names and notes" placeholderTextColor={colors.faint} style={{ flex: 1, fontSize: 15.5, color: colors.ink, fontFamily: 'Inter_600SemiBold' }} returnKeyType="search" />
        </View>
        <FlatList horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12, flexGrow: 0 }} data={[{ id: '__all' }, ...folders.data, { id: '__none' }, { id: '__new' }] as any[]} keyExtractor={(i) => i.id}
          renderItem={({ item }) => item.id === '__all' ? <Chip label="All" active={folder == null} onPress={() => setFolder(null)} />
            : item.id === '__none' ? <Chip label="Unfiled" active={folder === 'none'} onPress={() => setFolder('none')} />
            : item.id === '__new' ? <Chip label="New folder" icon="add" onPress={() => setPrompt({ mode: 'new' })} />
            : <Chip label={item.name} icon={item.icon} active={folder === item.id} onPress={() => setFolder(item.id)} />} />
        {current && <Pressy onPress={manage} style={{ alignSelf: 'flex-start', marginTop: 8 }}><Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13.5 }}>Rename or delete “{current.name}”</Text></Pressy>}
      </View>
      <FlatList
        contentContainerStyle={{ padding: 18, paddingBottom: 190, flexGrow: 1 }} showsVerticalScrollIndicator={false}
        data={data} keyExtractor={(p) => p.id}
        renderItem={({ item }) => <PlaceRow place={item} photo={photos.data[item.id]} photoUri={photos.data[item.id] ? uris[photos.data[item.id].id] : undefined} imperial={imperial} distance={me ? haversine(me, item) : null} onPress={() => router.push(guideHref({ source: 'saved', id: item.id }))} />}
        ListEmptyComponent={<Empty icon="bookmark-outline" title={search ? 'No matches' : 'Nothing here yet'} body={search ? 'Try a different search.' : 'Saved creeks appear here with your photos, sorted by what is closest to you.'} />}
      />
      <View style={{ position: 'absolute', right: 18, bottom: 104 }}>
        <Pressy onPress={add} accessibilityLabel="Save a location">
          <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.water, paddingHorizontal: 20, height: 54, borderRadius: 27 }, shadow.float]}>
            <Ionicons name="add" size={22} color="#fff" /><Text style={{ color: '#fff', fontWeight: '800', fontSize: 14.5, letterSpacing: 0.3 }}>SAVE A LOCATION</Text>
          </View>
        </Pressy>
      </View>
      <TextPrompt visible={!!prompt} title={prompt?.mode === 'rename' ? 'Rename folder' : 'New folder'} initial={prompt?.mode === 'rename' ? prompt.name : ''} placeholder="e.g. Summer 2026"
        onCancel={() => setPrompt(null)} onSubmit={async (v) => { if (prompt?.mode === 'rename') await renameFolder(prompt.id, v); else await createFolder(v); setPrompt(null); }} />
    </SafeAreaView>
  );
}

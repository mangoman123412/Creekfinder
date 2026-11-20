import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, ScrollView, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '../../src/custom/Icon';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Alert } from '../../src/lib/alert';
import { Chip, Empty, Pressy, Text } from '../../src/components/ui';
import { PlaceRow } from '../../src/components/Bits';
import { useDbQuery, usePhotoUris } from '../../src/state/hooks';
import { firstPhotos, listFolders, listPlaces, parseTags, setFavorite } from '../../src/db/local';
import { useApp } from '../../src/state/app';
import { canSaveMore } from '../../src/lib/actions';
import { lastKnown } from '../../src/lib/location';
import { formatDistance, haversine } from '../../src/lib/geo';
import { guideHref } from '../../src/lib/nav';
import { colors, font, radius, shadow, gutter } from '../../src/theme';
import { themed } from '../../src/custom/themed';
import { mutate, useSettings } from '../../src/custom/store';
import { descendantIds, filterPlaces, flattenFolders, sortPlaces } from '../../src/custom/organize';
import { PLACE_KINDS, kindLabel } from '../../src/types';

const SORTS = [['date', 'Date', 'calendar'], ['distance', 'Distance', 'navigate'], ['name', 'Name', 'text'], ['rating', 'Rating', 'star'], ['elevation', 'Elevation', 'trending-up']] as const;

function MyPlaces() {
  const router = useRouter();
  const { premium, imperial } = useApp();
  const saved = useSettings().saved;
  const [folder, setFolder] = useState<string | null>(null);          // null = all, 'none' = unfiled
  const [tag, setTag] = useState<string | null>(null);
  const [kind, setKind] = useState<string | null>(null);
  const [favOnly, setFavOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);

  const folders = useDbQuery(listFolders, [], []);
  const all = useDbQuery(() => listPlaces(), [], []);
  const photos = useDbQuery(firstPhotos, [], {});
  const uris = usePhotoUris(Object.values(photos.data));
  useEffect(() => { void lastKnown().then(setMe); }, []);

  const tree = useMemo(() => flattenFolders(folders.data), [folders.data]);
  const allTags = useMemo(() => { const s = new Set<string>(); for (const p of all.data) parseTags(p.tags).forEach((t) => s.add(t)); return [...s].sort(); }, [all.data]);
  const data = useMemo(() => {
    const f = filterPlaces(all.data, { folderIds: folder === 'none' ? 'none' : folder ? descendantIds(folders.data, folder) : null, tag, favoritesOnly: favOnly, kind, search }, (p) => parseTags(p.tags));
    return sortPlaces(f, { sort: saved.sort, dir: saved.dir, me, favoritesFirst: saved.showFavoritesFirst });
  }, [all.data, folders.data, folder, tag, kind, favOnly, search, saved.sort, saved.dir, saved.showFavoritesFirst, me]);
  const pubCount = all.data.filter((p) => p.visibility === 'public').length;
  const add = async () => { if (await canSaveMore(premium, router.push)) router.push('/save'); };
  const activeFilters = Number(!!tag) + Number(!!kind) + Number(favOnly);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingHorizontal: gutter(), paddingTop: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}><Text style={font.display}>My Places</Text><Text style={[font.small, { marginTop: 2 }]}>{all.data.length} saved{premium ? '' : ' of 25'} · {pubCount} shared · {folders.data.length} folders</Text></View>
          <Pressy onPress={() => router.push('/folders')} accessibilityLabel="Manage folders"><View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', ...shadow.soft }}><Ionicons name="folder-open" size={21} color={colors.primary} /></View></Pressy>
        </View>
        <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: 26, paddingHorizontal: 16, height: 50, marginTop: 14 }, shadow.soft]}>
          <Ionicons name="search" size={19} color={colors.muted} />
          <TextInput value={search} onChangeText={setSearch} placeholder="Search names, notes and tags" placeholderTextColor={colors.faint} style={{ flex: 1, fontSize: 15.5, color: colors.ink }} returnKeyType="search" />
          <Pressy onPress={() => setShowFilters((v) => !v)} accessibilityLabel="Sort and filter"><View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Ionicons name="funnel" size={18} color={showFilters || activeFilters ? colors.primary : colors.muted} />{activeFilters > 0 && <Text style={{ color: colors.primary, fontWeight: '800' }}>{activeFilters}</Text>}</View></Pressy>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12, flexGrow: 0 }}>
          <Chip label="All" active={folder == null} onPress={() => setFolder(null)} />
          {tree.map(({ folder: f, depth }) => <Chip key={f.id} label={`${depth ? '↳ ' : ''}${f.name}${f.private ? ' 🔒' : ''}`} icon={f.icon as any} active={folder === f.id} onPress={() => setFolder(folder === f.id ? null : f.id)} />)}
          <Chip label="Unfiled" active={folder === 'none'} onPress={() => setFolder(folder === 'none' ? null : 'none')} />
        </ScrollView>
        {showFilters && (
          <View style={[{ backgroundColor: colors.surface, borderRadius: radius.md, padding: 14, marginTop: 10, gap: 8 }, shadow.soft]}>
            <Text style={font.label}>Sort by</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {SORTS.map(([id, label, icon]) => <Chip key={id} label={label} icon={icon as any} active={saved.sort === id} onPress={() => { if (id === 'distance' && !me) Alert.alert('Location needed', 'Allow location to sort by distance.'); mutate((s) => { s.saved.sort = id; if (id === 'name') s.saved.dir = 'asc'; if (id === 'distance') s.saved.dir = 'asc'; }); }} />)}
              <Chip label={saved.dir === 'asc' ? 'Ascending ↑' : 'Descending ↓'} icon="swap-vertical" onPress={() => mutate((s) => { s.saved.dir = s.saved.dir === 'asc' ? 'desc' : 'asc'; })} />
            </View>
            <Text style={font.label}>Filter</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              <Chip label="Favorites" icon="heart" active={favOnly} onPress={() => setFavOnly((v) => !v)} />
              {PLACE_KINDS.slice(0, 5).map((k) => <Chip key={k.key} label={k.label} active={kind === k.key} onPress={() => setKind(kind === k.key ? null : k.key)} />)}
            </View>
            {allTags.length > 0 && (<><Text style={font.label}>Tags</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{allTags.map((t) => <Chip key={t} label={`#${t}`} active={tag === t} onPress={() => setTag(tag === t ? null : t)} />)}</View></>)}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              <Chip label="Favorites first" icon="heart" active={saved.showFavoritesFirst} onPress={() => mutate((s) => { s.saved.showFavoritesFirst = !s.saved.showFavoritesFirst; })} />
              <Chip label={saved.view === 'cards' ? 'Card view' : 'Compact view'} icon={saved.view === 'cards' ? 'grid' : 'list'} onPress={() => mutate((s) => { s.saved.view = s.saved.view === 'cards' ? 'compact' : 'cards'; })} />
            </View>
          </View>
        )}
      </View>
      <FlatList
        contentContainerStyle={{ padding: gutter(), paddingBottom: 190, flexGrow: 1 }} showsVerticalScrollIndicator={false} data={data} keyExtractor={(p) => p.id}
        renderItem={({ item }) => saved.view === 'cards'
          ? <PlaceRow place={item} photo={photos.data[item.id]} photoUri={photos.data[item.id] ? uris[photos.data[item.id].id] : undefined} imperial={imperial} distance={me ? haversine(me, item) : null} onPress={() => router.push(guideHref({ source: 'saved', id: item.id }))} />
          : (
            <Pressy onPress={() => router.push(guideHref({ source: 'saved', id: item.id }))} scale={0.98} accessibilityLabel={item.name}>
              <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: radius.md, padding: 12, marginBottom: 8 }, shadow.soft]}>
                <Ionicons name="water" size={20} color={colors.primary} />
                <View style={{ flex: 1 }}><Text style={{ fontWeight: '700' }} numberOfLines={1}>{item.name}</Text><Text style={font.small} numberOfLines={1}>{kindLabel(item.kind)}{me ? ` · ${formatDistance(haversine(me, item), imperial)}` : ''}{parseTags(item.tags).length ? ` · ${parseTags(item.tags).map((t) => '#' + t).join(' ')}` : ''}</Text></View>
                {item.rating ? <Text style={{ color: '#E9A92C', fontWeight: '800' }}>★ {item.rating}</Text> : null}
                <Pressy onPress={() => setFavorite(item.id, !item.favorite)} accessibilityLabel="Toggle favorite" hitSlop={8}><Ionicons name={item.favorite ? 'heart' : 'heart-outline'} size={20} color={item.favorite ? colors.danger : colors.faint} /></Pressy>
              </View>
            </Pressy>)}
        ListEmptyComponent={<Empty icon="bookmark-outline" title={search || activeFilters ? 'No matches' : 'Nothing here yet'} body={search || activeFilters ? 'Try a different search or clear the filters.' : 'Saved creeks appear here with your photos.'} />}
      />
      <View style={{ position: 'absolute', right: 18, bottom: 104 }}>
        <Pressy onPress={add} accessibilityLabel="Save a location">
          <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.water, paddingHorizontal: 20, height: 54, borderRadius: 27 }, shadow.float]}><Ionicons name="add" size={22} color="#fff" /><Text style={{ color: '#fff', fontWeight: '800', fontSize: 14.5, letterSpacing: 0.3 }}>SAVE A LOCATION</Text></View>
        </Pressy>
      </View>
    </SafeAreaView>
  );
}
export default themed(MyPlaces);

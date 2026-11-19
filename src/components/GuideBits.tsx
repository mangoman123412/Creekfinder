import React, { useRef, useState } from 'react';
import { Dimensions, FlatList, Modal, Platform, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, font, radius, shadow, space } from '../theme';
import { IconButton, Pill, Pressy, Skeleton, Text, type IconName } from './ui';
import { openUrl } from './Bits';
import { formatDistance } from '../lib/geo';
import type { Feature, Species } from '../lib/guide';

const W = Dimensions.get('window').width;

/** A titled block of the guide. */
export function GuideSection({ icon, title, sub, children }: { icon: IconName; title: string; sub?: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: space.xl }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: space.md }}>
        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.waterTint, alignItems: 'center', justifyContent: 'center' }}><Ionicons name={icon} size={18} color={colors.water} /></View>
        <View style={{ flex: 1 }}><Text style={font.h2}>{title}</Text>{sub ? <Text style={font.small}>{sub}</Text> : null}</View>
      </View>
      {children}
    </View>
  );
}

export function FactCard({ children }: { children: React.ReactNode }) {
  const kids = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={[{ backgroundColor: colors.surface, borderRadius: radius.md, overflow: 'hidden' }, shadow.soft]}>
      {kids.map((k, i) => (<View key={i}>{i > 0 && <View style={{ height: 1, backgroundColor: colors.line, marginHorizontal: 16 }} />}{k}</View>))}
    </View>
  );
}

/** One fact. A missing value is ALWAYS shown as "Unknown" — never guessed. */
export function Fact({ icon, label, value, source, note, loading }: { icon: IconName; label: string; value?: string | null; source?: string; note?: string; loading?: boolean }) {
  const known = value != null && value !== '';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 13, paddingHorizontal: 16 }}>
      <Ionicons name={icon} size={19} color={known ? colors.primary : colors.faint} style={{ marginTop: 1 }} />
      <View style={{ flex: 1 }}>
        <Text style={font.label}>{label}</Text>
        {loading ? <Skeleton h={16} w={140} r={6} style={{ marginTop: 6 }} /> : (
          <Text selectable style={[font.body, { fontWeight: known ? '600' : '400', marginTop: 2 }, !known && { color: colors.faint, fontStyle: 'italic' }]}>{known ? value : 'Unknown'}</Text>
        )}
        {known && (source || note) ? <Text style={[font.small, { marginTop: 2 }]}>{[note, source].filter(Boolean).join(' · ')}</Text> : null}
      </View>
    </View>
  );
}

export function FeatureList({ items, empty, imperial, icon, max = 4 }: { items: Feature[] | null; empty: string; imperial: boolean; icon: IconName; max?: number }) {
  if (items == null) return <Skeleton h={54} r={14} />;
  if (!items.length) return <Text style={[font.small, { fontStyle: 'italic', color: colors.faint }]}>{empty}</Text>;
  return (
    <View style={{ gap: 8 }}>
      {items.slice(0, max).map((f) => (
        <View key={f.osmId + f.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: radius.sm + 2, padding: 12 }}>
          <Ionicons name={icon} size={18} color={colors.primary} />
          <Text style={{ flex: 1, fontWeight: '600', fontSize: 14.5 }} numberOfLines={1}>{f.name}</Text>
          <Text style={font.small}>{formatDistance(f.distance_m, imperial)}</Text>
        </View>
      ))}
      {items.length > max ? <Text style={font.small}>+ {items.length - max} more nearby on the map</Text> : null}
    </View>
  );
}

export function SpeciesRow({ items, empty }: { items: Species[] | null; empty: string }) {
  if (items == null) return <Skeleton h={120} r={16} />;
  if (!items.length) return <Text style={[font.small, { fontStyle: 'italic', color: colors.faint }]}>{empty}</Text>;
  return (
    <FlatList horizontal data={items} keyExtractor={(s) => String(s.id)} showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -18 }} contentContainerStyle={{ paddingHorizontal: 18 }}
      renderItem={({ item }) => (
        <Pressy onPress={() => openUrl(`https://www.inaturalist.org/taxa/${item.id}`)} style={{ width: 118, marginRight: 10 }} accessibilityLabel={item.name}>
          <View style={[{ backgroundColor: colors.surface, borderRadius: radius.md, overflow: 'hidden' }, shadow.soft]}>
            {item.photo ? <Image source={{ uri: item.photo }} style={{ width: 118, height: 96 }} contentFit="cover" /> : <View style={{ width: 118, height: 96, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="leaf" size={28} color={colors.faint} /></View>}
            <View style={{ padding: 9 }}>
              <Text numberOfLines={1} style={{ fontWeight: '700', fontSize: 13 }}>{item.name}</Text>
              <Text numberOfLines={1} style={{ fontSize: 11, color: colors.muted, fontStyle: 'italic' }}>{item.sci}</Text>
              <Text style={{ fontSize: 11, color: colors.faint, marginTop: 2 }}>{item.count} sightings</Text>
            </View>
          </View>
        </Pressy>
      )} />
  );
}

export interface GalleryPhoto { id: string; uri: string; by: 'you' | 'explorer' | 'commons'; credit?: string; license?: string; pageUrl?: string }
const BY: Record<GalleryPhoto['by'], { label: string; icon: IconName }> = { you: { label: 'Your photo', icon: 'person' }, explorer: { label: 'Explorer photo', icon: 'people' }, commons: { label: 'Wikimedia Commons', icon: 'camera' } };

/** Swipeable hero gallery with tap-to-fullscreen. */
export function Gallery({ photos, height, gradient, kindIcon, onIndex, children }: { photos: GalleryPhoto[]; height: number; gradient: [string, string]; kindIcon: IconName; onIndex?: (i: number) => void; children?: React.ReactNode }) {
  const [i, setI] = useState(0);
  const [full, setFull] = useState<number | null>(null);
  const list = useRef<FlatList>(null);
  return (
    <View style={{ height, backgroundColor: gradient[1] }}>
      {photos.length ? (
        <FlatList ref={list} horizontal pagingEnabled showsHorizontalScrollIndicator={false} data={photos} keyExtractor={(p) => p.id} getItemLayout={(_, n) => ({ length: W, offset: W * n, index: n })}
          onMomentumScrollEnd={(e) => { const n = Math.round(e.nativeEvent.contentOffset.x / W); setI(n); onIndex?.(n); }}
          renderItem={({ item, index }) => (
            <Pressy scale={1} onPress={() => setFull(index)} accessibilityLabel="Open photo full screen" style={{ width: W, height }}>
              <Image source={{ uri: item.uri }} style={{ width: W, height }} contentFit="cover" transition={250} />
            </Pressy>
          )} />
      ) : (
        <LinearGradient colors={gradient} style={StyleSheet.absoluteFill}>
          <Ionicons name={kindIcon} size={190} color="rgba(255,255,255,0.08)" style={{ position: 'absolute', right: -30, top: 40 }} />
        </LinearGradient>
      )}
      <LinearGradient pointerEvents="none" colors={['rgba(0,0,0,0.45)', 'transparent', 'rgba(0,0,0,0.72)']} locations={[0, 0.35, 1]} style={StyleSheet.absoluteFill} />
      {children}
      {photos.length > 1 && (
        <View pointerEvents="none" style={{ position: 'absolute', bottom: 14, right: 16, flexDirection: 'row', gap: 5 }}>
          {photos.slice(0, 12).map((p, n) => <View key={p.id} style={{ width: n === i ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: n === i ? '#fff' : 'rgba(255,255,255,0.5)' }} />)}
        </View>
      )}
      {photos[i] && (
        <View pointerEvents="none" style={{ position: 'absolute', top: 'auto' as any, bottom: 14, right: 16, opacity: 0 }} />
      )}
      <Modal visible={full != null} transparent animationType="fade" onRequestClose={() => setFull(null)}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          {full != null && (
            <FlatList horizontal pagingEnabled data={photos} keyExtractor={(p) => p.id} initialScrollIndex={full} getItemLayout={(_, n) => ({ length: W, offset: W * n, index: n })}
              renderItem={({ item }) => (
                <View style={{ width: W, flex: 1, justifyContent: 'center' }}>
                  <Image source={{ uri: item.uri }} style={{ width: W, height: '78%' }} contentFit="contain" />
                  <View style={{ padding: 18, gap: 6 }}>
                    <Pill tone="dark" icon={BY[item.by].icon} label={BY[item.by].label} />
                    {item.credit ? <Text style={{ color: '#fff', fontSize: 13 }}>© {item.credit}{item.license ? ` · ${item.license}` : ''}</Text> : null}
                    {item.pageUrl ? <Text onPress={() => openUrl(item.pageUrl!)} style={{ color: '#8FD0FF', fontSize: 13, fontWeight: '700' }}>View source & license</Text> : null}
                  </View>
                </View>
              )} />
          )}
          <View style={{ position: 'absolute', top: Platform.OS === 'web' ? 18 : 54, right: 16 }}><IconButton icon="close" label="Close photo" onPress={() => setFull(null)} /></View>
        </View>
      </Modal>
    </View>
  );
}

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { colors, font, radius, shadow, space } from '../theme';
import { kindIcon, kindLabel, type Place, type Photo, type ExploreItem } from '../types';
import { formatDistance } from '../lib/geo';

/** The big, always-obvious primary action. */
export function SaveCreekButton({ onPress, floating, compact }: { onPress: () => void; floating?: boolean; compact?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel="Save this creek"
      onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onPress(); }}
      style={({ pressed }) => [floating && s.floating, { transform: [{ scale: pressed ? 0.97 : 1 }] }]}
    >
      <LinearGradient colors={[colors.water, colors.waterDeep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.save, compact && { paddingVertical: 14 }]}>
        <Ionicons name="location" size={compact ? 24 : 30} color="#fff" />
        <View>
          <Text style={[s.saveTitle, compact && { fontSize: 18 }]}>SAVE THIS CREEK</Text>
          {!compact && <Text style={s.saveSub}>Pin your exact GPS spot</Text>}
        </View>
      </LinearGradient>
    </Pressable>
  );
}

export function PlaceRow({ place, photo, photoUri, distance, imperial, onPress }: { place: Place; photo?: Photo; photoUri?: string; distance?: number | null; imperial: boolean; onPress: () => void }) {
  const uri = photoUri ?? photo?.local_uri ?? null;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.row, pressed && { opacity: 0.85 }]} accessibilityRole="button" accessibilityLabel={place.name}>
      {uri ? <Image source={{ uri }} style={s.thumb} contentFit="cover" /> : (
        <View style={[s.thumb, { backgroundColor: colors.waterLight, alignItems: 'center', justifyContent: 'center' }]}>
          <Ionicons name={kindIcon(place.kind) as any} size={28} color={colors.water} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={font.h3} numberOfLines={1}>{place.name}</Text>
        <Text style={font.small}>{kindLabel(place.kind)}{distance != null ? `  ·  ${formatDistance(distance, imperial)} away` : ''}</Text>
        {place.visibility === 'public' && (
          <View style={s.pill}><Ionicons name="globe-outline" size={12} color={colors.water} /><Text style={{ fontSize: 11, color: colors.waterDeep, fontWeight: '700' }}>Shared</Text></View>
        )}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

export function SourceBadge({ source }: { source: ExploreItem['source'] }) {
  const m = {
    verified: { t: 'Verified', bg: '#DDF3E5', fg: colors.ok, i: 'shield-checkmark' },
    community: { t: 'Community · unverified', bg: colors.waterLight, fg: colors.waterDeep, i: 'people' },
    osm: { t: 'OpenStreetMap', bg: '#ECEFEC', fg: colors.muted, i: 'map' },
  }[source];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: m.bg, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, marginTop: 4 }}>
      <Ionicons name={m.i as any} size={12} color={m.fg} /><Text style={{ fontSize: 11.5, fontWeight: '700', color: m.fg }}>{m.t}</Text>
    </View>
  );
}


const s = StyleSheet.create({
  save: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 22, paddingHorizontal: 26, borderRadius: radius.lg, justifyContent: 'center', ...shadow },
  saveTitle: { color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: 0.8 },
  saveSub: { color: '#D8EEF8', fontSize: 13, marginTop: 1 },
  floating: { position: 'absolute', left: space.lg, right: space.lg, bottom: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.white, padding: 10, borderRadius: radius.md, marginBottom: 10, ...shadow, shadowOpacity: 0.06, elevation: 1 },
  thumb: { width: 64, height: 64, borderRadius: radius.sm + 2 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-start', backgroundColor: colors.waterLight, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10, marginTop: 4 },
});

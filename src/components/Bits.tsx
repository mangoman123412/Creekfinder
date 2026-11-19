import React from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors, font, radius, shadow, space } from '../theme';
import { kindIcon, kindLabel, type ExploreItem, type Place, type Photo } from '../types';
import { formatDistance } from '../lib/geo';
import { Pill, Pressy, Skeleton, Text } from './ui';

/** Big, obvious primary action. */
export function SaveCreekButton({ onPress, compact }: { onPress: () => void; compact?: boolean; floating?: boolean }) {
  return (
    <Pressy onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); onPress(); }} accessibilityLabel="Save this creek">
      <LinearGradient colors={[colors.water, colors.waterDeep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, borderRadius: radius.pill, paddingVertical: compact ? 15 : 20 }, shadow.float]}>
        <Ionicons name="location" size={compact ? 22 : 26} color="#fff" />
        <Text style={{ color: '#fff', fontSize: compact ? 17 : 20, fontWeight: '800', letterSpacing: 0.6 }}>SAVE THIS CREEK</Text>
      </LinearGradient>
    </Pressy>
  );
}

const GRAD: Record<string, [string, string]> = {
  waterfall: ['#1B6E8F', '#0B2F3F'], swimming_hole: ['#1B8FD0', '#0E3F66'], river: ['#2A6F6A', '#10312F'], stream: ['#3E7D5B', '#12301F'],
  creek: ['#2F7D5B', '#0F3324'], pond_lake: ['#2C6E9B', '#102C45'], spring: ['#4B8F86', '#142F2B'], other: ['#4A6B5A', '#17261F'],
};

export interface CardData {
  key: string; name: string; kind: string; photoUrl?: string | null; credit?: string; location?: string | null; distance_m?: number | null;
  rating?: number | null; ratingCount?: number; desc?: string | null; source?: ExploreItem['source'] | 'saved'; saved?: boolean;
}

/** Image-led destination card. Real photo when one exists, otherwise a designed gradient — never a fake photo. */
export function DestinationCard({ d, onPress, imperial, variant = 'wide', index = 0 }: { d: CardData; onPress: () => void; imperial: boolean; variant?: 'wide' | 'tall' | 'full'; index?: number }) {
  const w = variant === 'wide' ? 268 : variant === 'tall' ? 188 : undefined;
  const h = variant === 'wide' ? 188 : variant === 'tall' ? 244 : 214;
  const g = GRAD[d.kind] ?? GRAD.other;
  const entering = variant === 'full' ? FadeInDown.delay(Math.min(index, 8) * 55).duration(380) : FadeInRight.delay(Math.min(index, 6) * 70).duration(380);
  return (
    <Animated.View entering={entering} style={[{ width: w as any, marginRight: variant === 'full' ? 0 : 14, marginBottom: variant === 'full' ? 16 : 0 }]}>
      <Pressy onPress={onPress} accessibilityLabel={d.name} scale={0.97} style={[{ height: h, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: g[1] }, shadow.card]}>
        {d.photoUrl ? <Image source={{ uri: d.photoUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} /> : (
          <LinearGradient colors={g} style={StyleSheet.absoluteFill}>
            <Ionicons name={kindIcon(d.kind) as any} size={110} color="rgba(255,255,255,0.10)" style={{ position: 'absolute', right: -14, top: 8 }} />
          </LinearGradient>
        )}
        <LinearGradient colors={['rgba(0,0,0,0.30)', 'transparent', 'rgba(0,0,0,0.78)']} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFill} />
        <View style={{ position: 'absolute', top: 12, left: 12, right: 12, flexDirection: 'row', justifyContent: 'space-between' }}>
          <Pill tone="dark" icon={kindIcon(d.kind) as any} label={kindLabel(d.kind)} />
          {d.saved ? <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' }}><Ionicons name="bookmark" size={16} color={colors.primary} /></View> : null}
        </View>
        <View style={{ position: 'absolute', left: 14, right: 14, bottom: 12 }}>
          <Text numberOfLines={1} style={{ color: '#fff', fontSize: 19, fontWeight: '800', letterSpacing: -0.3 }}>{d.name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
            <Ionicons name="location-sharp" size={13} color="rgba(255,255,255,0.85)" />
            <Text numberOfLines={1} style={{ color: 'rgba(255,255,255,0.92)', fontSize: 13, flexShrink: 1 }}>
              {[d.location, d.distance_m != null ? `${formatDistance(d.distance_m, imperial)} away` : null].filter(Boolean).join(' · ') || 'Location saved'}
            </Text>
            {d.rating ? (<><Ionicons name="star" size={12} color="#F5B942" /><Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{d.rating.toFixed(1)}</Text></>) : null}
          </View>
          {variant !== 'tall' && d.desc ? <Text numberOfLines={1} style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12.5, marginTop: 4 }}>{d.desc}</Text> : null}
        </View>
        {d.credit && d.photoUrl ? <Text style={{ position: 'absolute', right: 10, top: 48, color: 'rgba(255,255,255,0.55)', fontSize: 9 }} numberOfLines={1}>📷 {d.credit.slice(0, 26)}</Text> : null}
      </Pressy>
    </Animated.View>
  );
}

export function CardSkeletonRow() {
  return <View style={{ flexDirection: 'row' }}>{[0, 1].map((i) => <Skeleton key={i} w={268} h={188} r={26} style={{ marginRight: 14 }} />)}</View>;
}

export function PlaceRow({ place, photo, photoUri, distance, imperial, onPress }: { place: Place; photo?: Photo; photoUri?: string; distance?: number | null; imperial: boolean; onPress: () => void }) {
  const uri = photoUri ?? photo?.local_uri ?? null;
  return (
    <DestinationCard variant="full" imperial={imperial} onPress={onPress}
      d={{ key: place.id, name: place.name, kind: place.kind, photoUrl: uri, distance_m: distance ?? null, desc: place.description, source: 'saved', saved: true, location: place.visibility === 'public' ? 'Shared publicly' : 'Private' }} />
  );
}

export function SourceBadge({ source }: { source: ExploreItem['source'] | 'saved' }) {
  const m = {
    verified: { t: 'Verified', tone: 'ok', i: 'shield-checkmark' }, community: { t: 'Community · unverified', tone: 'water', i: 'people' },
    osm: { t: 'OpenStreetMap', tone: 'neutral', i: 'map' }, saved: { t: 'Saved by you', tone: 'ok', i: 'bookmark' },
  }[source] as { t: string; tone: any; i: any };
  return <Pill tone={m.tone} icon={m.i} label={m.t} />;
}

export const openUrl = (u: string) => { if (Platform.OS === 'web') window.open(u, '_blank', 'noopener'); else void Linking.openURL(u); };
void font; void space;

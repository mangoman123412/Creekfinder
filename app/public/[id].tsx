import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, FlatList, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { Alert } from '../../src/lib/alert';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Banner, Button, Card, SectionTitle, Stars, Row } from '../../src/components/ui';
import { SafetyPanel } from '../../src/components/SafetyPanel';
import { useApp } from '../../src/state/app';
import { addComment, blockUser, deleteComment, getComments, getPlacePhotos, getPublicPlace, rate, report, type Comment, type PublicPhoto, type PublicPlace, type ReportReason } from '../../src/lib/community';
import { canSaveMore, openDirections, shareLocation } from '../../src/lib/actions';
import { formatCoords } from '../../src/lib/geo';
import { kindLabel } from '../../src/types';
import { colors, font, space } from '../../src/theme';

const W = Dimensions.get('window').width;

export default function PublicPlaceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const nav = useNavigation();
  const { user, premium } = useApp();
  const [p, setP] = useState<PublicPlace | null>(null);
  const [photos, setPhotos] = useState<PublicPhoto[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    try {
      const pl = await getPublicPlace(id, user?.id ?? null);
      if (!pl) { setMissing(true); return; }
      setP(pl); nav.setOptions({ title: pl.name });
      const [ph, cm] = await Promise.all([getPlacePhotos(id), getComments(id)]);
      setPhotos(ph); setComments(cm);
    } catch (e: any) { Alert.alert('Could not load', e.message ?? 'Check your connection.'); }
    finally { setLoading(false); }
  }, [id, user?.id, nav]);
  useEffect(() => { void load(); }, [load]);

  if (loading) return <ActivityIndicator style={{ marginTop: 80 }} color={colors.forest} />;
  if (missing || !p) return <View style={{ padding: space.xl }}><Text style={font.h2}>This place is no longer available.</Text></View>;
  const mine = user?.id === p.user_id;
  const needAuth = (fn: () => void) => user ? fn() : Alert.alert('Sign in', 'Create a free account to rate, comment and save places.', [{ text: 'Not now', style: 'cancel' }, { text: 'Sign in', onPress: () => router.push('/auth') }]);

  const doReport = () => needAuth(() => {
    const reasons: [string, ReportReason][] = [['Incorrect information', 'incorrect'], ['Dangerous conditions', 'dangerous'], ['Private property / no access', 'private_property'], ['Inappropriate content', 'inappropriate'], ['Spam', 'spam']];
    Alert.alert('Report this place', 'What is wrong?', [...reasons.map(([t, r]) => ({ text: t, onPress: async () => { try { await report(user!.id, { placeId: p.id, reason: r }); Alert.alert('Thank you', 'Our team will review this report.'); } catch (e: any) { Alert.alert('Could not report', e.message); } } })), { text: 'Cancel', style: 'cancel' as const }]);
  });
  const doBlock = () => needAuth(() => Alert.alert(`Block ${p.author}?`, "You won't see their places or comments anymore.", [{ text: 'Cancel', style: 'cancel' },
    { text: 'Block', style: 'destructive', onPress: async () => { try { await blockUser(user!.id, p.user_id); router.back(); } catch (e: any) { Alert.alert('Error', e.message); } } }]));
  const saveCopy = () => needAuth(async () => {
    if (!(await canSaveMore(premium, router.push))) return;
    router.push({ pathname: '/save', params: { lat: String(p.lat), lng: String(p.lng), name: p.name, kind: p.kind, desc: p.description ?? '', source: 'community', from: p.id } });
  });

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <ScrollView style={{ backgroundColor: colors.sand }} contentContainerStyle={{ paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        {photos.length > 0 && <FlatList horizontal pagingEnabled showsHorizontalScrollIndicator={false} data={photos} keyExtractor={(x) => x.id}
          renderItem={({ item }) => <Image source={{ uri: item.url }} style={{ width: W, height: 260 }} contentFit="cover" />} />}
        <View style={{ padding: space.lg }}>
          <Text style={font.h1}>{p.name}</Text>
          <Text style={font.small}>{kindLabel(p.kind)} · shared by {p.author}</Text>
          <Banner tone={p.verified ? 'info' : 'warn'} icon={p.verified ? 'shield-checkmark' : 'alert-circle'}>
            {p.verified ? 'Verified by CreekFinder.' : 'Unverified user submission. Location, access and safety have not been checked — confirm for yourself.'}
          </Banner>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Stars value={p.avg_rating ?? 0} />
            <Text style={font.small}>{p.avg_rating ? `${p.avg_rating.toFixed(1)} (${p.rating_count})` : 'No ratings yet'}</Text>
          </View>
          {!mine && (
            <View style={{ marginTop: 8 }}>
              <Text style={font.small}>Your rating</Text>
              <Stars value={p.my_rating ?? 0} size={30} onChange={(n) => needAuth(async () => { try { await rate(p.id, user!.id, n); await load(); } catch (e: any) { Alert.alert('Error', e.message); } })} />
            </View>
          )}
          <Card style={{ marginTop: space.md }}>
            <Text selectable style={font.body}>{formatCoords(p.lat, p.lng, 5)}</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <Button small icon="navigate" title="Find it" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/navigate', params: { lat: String(p.lat), lng: String(p.lng), name: p.name } })} />
              <Button small variant="secondary" icon="car" title="Directions" style={{ flex: 1 }} onPress={() => openDirections(p.name, p.lat, p.lng)} />
              <Button small variant="secondary" icon="share" title="Share" style={{ flex: 1 }} onPress={() => shareLocation(p.name, p.lat, p.lng)} />
            </View>
            <View style={{ marginTop: 8 }}><Button icon="bookmark" title="Save to My Places" onPress={saveCopy} /></View>
          </Card>
          {[['About', p.description], ['Water', p.water_notes], ['Depth', p.depth_notes], ['Scenery & surroundings', p.surroundings]].map(([t, v]) => v ? <View key={t as string}><SectionTitle>{t}</SectionTitle><Text style={font.body}>{v}</Text></View> : null)}

          <SectionTitle>Comments</SectionTitle>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput value={text} onChangeText={setText} placeholder="Add a comment (be kind & accurate)" maxLength={1000} multiline style={{ flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.line, minHeight: 46 }} />
            <Button small title="Post" disabled={!text.trim()} onPress={() => needAuth(async () => { try { await addComment(p.id, user!.id, text); setText(''); setComments(await getComments(p.id)); } catch (e: any) { Alert.alert('Could not post', e.message); } })} />
          </View>
          {comments.length === 0 && <Text style={[font.small, { marginTop: 8 }]}>No comments yet.</Text>}
          {comments.map((c) => (
            <Card key={c.id} style={{ marginTop: 8 }}>
              <Text style={{ fontWeight: '700' }}>{c.author} <Text style={font.small}>· {new Date(c.created_at).toLocaleDateString()}</Text></Text>
              <Text style={font.body}>{c.body}</Text>
              <View style={{ flexDirection: 'row', gap: 16, marginTop: 6 }}>
                {c.user_id === user?.id
                  ? <Text style={{ color: colors.danger, fontWeight: '700' }} onPress={async () => { await deleteComment(c.id); setComments(await getComments(p.id)); }}>Delete</Text>
                  : <Text style={{ color: colors.muted, fontWeight: '700' }} onPress={() => needAuth(async () => { try { await report(user!.id, { commentId: c.id, reason: 'inappropriate' }); Alert.alert('Reported', 'Thanks — we will review this comment.'); } catch (e: any) { Alert.alert('Error', e.message); } })}>Report</Text>}
              </View>
            </Card>
          ))}

          <SectionTitle>Conditions & safety</SectionTitle>
          <SafetyPanel lat={p.lat} lng={p.lng} />

          {!mine && (
            <View style={{ marginTop: space.lg, borderRadius: 14, overflow: 'hidden' }}>
              <Row icon="flag" title="Report incorrect or dangerous info" onPress={doReport} />
              <Row icon="ban" danger title={`Block ${p.author}`} onPress={doBlock} />
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

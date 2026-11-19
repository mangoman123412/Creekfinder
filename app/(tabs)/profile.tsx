import React, { useState } from 'react';
import { ScrollView, Switch, View } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Linking } from 'react-native';
import { Alert } from '../../src/lib/alert';
import { Banner, Button, Group, Pill, Pressy, Row, SectionTitle, Text } from '../../src/components/ui';
import { TextPrompt } from '../../src/components/TextPrompt';
import { useApp } from '../../src/state/app';
import { useTheme, type ThemePref } from '../../src/state/theme';
import { useDbQuery } from '../../src/state/hooks';
import { countAdventures, countPlaces, kvSet, kvGet, getDb, wipeLocal } from '../../src/db/local';
import { deleteAccountRemote, updateDisplayName } from '../../src/lib/community';
import { openSettings } from '../../src/lib/location';
import { pickPhotos } from '../../src/lib/photos';
import { formatDistance } from '../../src/lib/geo';
import { config, hasBackend, FREE_PLACE_LIMIT } from '../../src/config';
import { colors, font, radius, shadow } from '../../src/theme';

export default function Profile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, premium, online, syncing, pending, sync, signOut, imperial, setImperial, displayName, lastSyncError } = useApp();
  const { pref, setPref } = useTheme();
  const places = useDbQuery(countPlaces, [], 0);
  const advs = useDbQuery(countAdventures, [], 0);
  const km = useDbQuery(async () => { const db = await getDb(); const r = await db.getFirstAsync<{ d: number }>("SELECT COALESCE(SUM(distance_m),0) d FROM adventures WHERE deleted=0 AND status='finished'"); return r?.d ?? 0; }, [], 0);
  const avatar = useDbQuery(() => kvGet('avatar'), [], null as string | null);
  const [renaming, setRenaming] = useState(false);

  const changeAvatar = async () => { const u = await pickPhotos(); if (u[0]) await kvSet('avatar', u[0]); };
  const confirmDelete = () => Alert.alert('Delete your account?', 'This permanently deletes your account, saved places, photos and adventures from our servers and from this phone. This cannot be undone.',
    [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete everything', style: 'destructive', onPress: async () => {
      if (!online) { Alert.alert('Connect to the internet', 'You must be online to delete your account.'); return; }
      try { await deleteAccountRemote(user!.id); await wipeLocal(); Alert.alert('Account deleted', 'Your account and data have been deleted.'); }
      catch (e: any) { Alert.alert('Could not delete account', e.message ?? 'Please try again or contact support.'); }
    } }]);
  const mail = () => Linking.openURL(`mailto:${config.supportEmail || 'support@example.com'}?subject=CreekFinder%20support`);
  const name = user ? displayName : 'Guest explorer';

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 130 }}>
        <LinearGradient colors={[colors.primaryDeep, colors.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingTop: insets.top + 24, paddingBottom: 56, paddingHorizontal: 20, alignItems: 'center' }}>
          <Pressy onPress={changeAvatar} accessibilityLabel="Change profile photo" scale={0.95}>
            <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 3, borderColor: 'rgba(255,255,255,0.9)' }}>
              {avatar.data ? <Image source={{ uri: avatar.data }} style={{ width: 96, height: 96 }} /> : <Text style={{ fontSize: 38, fontWeight: '800', color: colors.primary }}>{name.slice(0, 1).toUpperCase()}</Text>}
            </View>
            <View style={{ position: 'absolute', right: -2, bottom: -2, width: 30, height: 30, borderRadius: 15, backgroundColor: colors.water, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.primary }}><Ionicons name="camera" size={15} color="#fff" /></View>
          </Pressy>
          <Text style={{ color: '#fff', fontSize: 24, fontWeight: '800', marginTop: 12 }}>{name}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13.5 }}>{user?.email ?? 'Saved on this phone only'}</Text>
          <View style={{ marginTop: 10 }}><Pill tone={premium ? 'ok' : 'dark'} icon={premium ? 'star' : 'leaf'} label={premium ? 'Premium explorer' : `Free plan · ${places.data}/${FREE_PLACE_LIMIT} places`} /></View>
        </LinearGradient>

        <View style={{ paddingHorizontal: 18, marginTop: -34 }}>
          <View style={[{ flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.lg, paddingVertical: 16 }, shadow.card]}>
            {[[String(places.data), 'Places'], [String(advs.data), 'Adventures'], [formatDistance(km.data, imperial), 'Explored']].map(([v, l], i) => (
              <View key={l} style={{ flex: 1, alignItems: 'center', borderLeftWidth: i ? 1 : 0, borderColor: colors.line }}><Text style={{ fontSize: 22, fontWeight: '800' }}>{v}</Text><Text style={font.small}>{l}</Text></View>))}
          </View>

          {!user && hasBackend && <View style={{ marginTop: 16 }}><Button icon="log-in" title="Sign in or create account" onPress={() => router.push('/auth')} /><Text style={[font.small, { marginTop: 6, textAlign: 'center' }]}>Back up your creeks, use them on any phone, and share with the community.</Text></View>}
          {!premium && <View style={{ marginTop: 12 }}><Button variant="water" icon="star" title="Go Premium" onPress={() => router.push('/premium')} /></View>}

          {user && (<>
            <SectionTitle>Sync</SectionTitle>
            <View style={[{ backgroundColor: colors.surface, borderRadius: radius.md, padding: 16 }, shadow.soft]}>
              <Text style={font.body}>{!online ? 'Offline — changes are saved on this phone.' : syncing ? 'Syncing…' : pending > 0 ? `${pending} change${pending > 1 ? 's' : ''} waiting to upload` : 'Everything is backed up'}</Text>
              {lastSyncError && <Text style={[font.small, { color: colors.danger, marginTop: 4 }]}>{lastSyncError.includes('FREE_LIMIT') ? 'Some places could not upload: the free plan limit was reached.' : lastSyncError}</Text>}
              <View style={{ marginTop: 10 }}><Button small variant="secondary" icon="sync" title="Sync now" onPress={sync} loading={syncing} disabled={!online} /></View>
            </View>
          </>)}

          <SectionTitle>Appearance</SectionTitle>
          <View style={{ flexDirection: 'row', backgroundColor: colors.surface2, borderRadius: 22, padding: 4 }}>
            {([['system', 'Auto', 'phone-portrait'], ['light', 'Light', 'sunny'], ['dark', 'Dark', 'moon']] as [ThemePref, string, any][]).map(([k, l, ic]) => (
              <Pressy key={k} onPress={() => setPref(k)} accessibilityLabel={`${l} theme`} style={{ flex: 1, height: 42, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, backgroundColor: pref === k ? colors.primary : 'transparent' }}>
                <Ionicons name={ic} size={16} color={pref === k ? '#fff' : colors.muted} /><Text style={{ fontWeight: '700', fontSize: 13.5, color: pref === k ? '#fff' : colors.muted }}>{l}</Text>
              </Pressy>))}
          </View>

          <SectionTitle>My outdoors</SectionTitle>
          <Group>
            <Row icon="footsteps" title="Tracking history" subtitle={`${advs.data} saved adventure${advs.data === 1 ? '' : 's'}`} onPress={() => router.push('/adventures')} />
            <Row icon="radio-button-on" title="Start tracking" onPress={() => router.push('/track')} />
            <Row icon="cloud-download" title="Offline maps" onPress={() => router.push('/offline')} />
            <Row icon="shield-checkmark" title="Safety & emergency sharing" onPress={() => router.push('/safety')} />
          </Group>

          <SectionTitle>Settings</SectionTitle>
          <Group>
            <Row icon="speedometer" title="Use miles & feet" subtitle={imperial ? 'Imperial' : 'Metric (km & m)'} right={<Switch value={imperial} onValueChange={setImperial} trackColor={{ true: colors.primary }} />} />
            {user ? <Row icon="create" title="Display name" subtitle={displayName} onPress={() => setRenaming(true)} /> : <Row icon="person" title="Profile photo" subtitle="Tap your picture above" />}
            <Row icon="location" title="Location permission" subtitle="Open settings" onPress={openSettings} />
          </Group>

          <SectionTitle>Privacy & legal</SectionTitle>
          <Group>
            <Row icon="lock-closed" title="Private by default" subtitle="Only places you switch to Public appear on the community map." />
            <Row icon="document-text" title="Privacy policy" onPress={() => router.push('/legal/privacy')} />
            <Row icon="document" title="Terms of service" onPress={() => router.push('/legal/terms')} />
            <Row icon="mail" title="Contact support" onPress={mail} />
          </Group>

          {user && (<>
            <SectionTitle>Account</SectionTitle>
            <Group>
              <Row icon="log-out" title="Sign out" subtitle="Removes this account's data from this phone" onPress={() => Alert.alert('Sign out?', pending > 0 && !online ? `You have ${pending} unsynced changes and no connection — they would be lost. Connect first.` : 'Your data stays safe in your account.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign out', onPress: signOut }])} />
              <Row icon="trash" danger title="Delete account" subtitle="Permanently erase your account and data" onPress={confirmDelete} />
            </Group>
          </>)}
          <Banner tone="info" icon="information-circle">CreekFinder {Constants.expoConfig?.version ?? '2.0'} · Maps © OpenStreetMap contributors © MapTiler. Always verify conditions and access yourself.</Banner>
        </View>
      </ScrollView>
      <TextPrompt visible={renaming} title="Display name" initial={displayName} onCancel={() => setRenaming(false)} onSubmit={async (v) => { try { await updateDisplayName(user!.id, v); } catch (e: any) { Alert.alert('Error', e.message); } setRenaming(false); }} />
    </View>
  );
}

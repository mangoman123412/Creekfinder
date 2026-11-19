import React, { useState } from 'react';
import { Alert, Linking, ScrollView, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Banner, Button, Card, Row, SectionTitle } from '../../src/components/ui';
import { TextPrompt } from '../../src/components/TextPrompt';
import { useApp } from '../../src/state/app';
import { useDbQuery } from '../../src/state/hooks';
import { countAdventures, countPlaces, wipeLocal } from '../../src/db/local';
import { deleteAccountRemote, updateDisplayName } from '../../src/lib/community';
import { openSettings } from '../../src/lib/location';
import { config, hasBackend, FREE_PLACE_LIMIT } from '../../src/config';
import { colors, font, space } from '../../src/theme';

export default function Profile() {
  const router = useRouter();
  const { user, premium, online, syncing, pending, sync, signOut, imperial, setImperial, displayName, lastSyncError } = useApp();
  const places = useDbQuery(countPlaces, [], 0);
  const advs = useDbQuery(countAdventures, [], 0);
  const [renaming, setRenaming] = useState(false);

  const confirmDelete = () => Alert.alert('Delete your account?',
    'This permanently deletes your account, saved places, photos and adventures from our servers and from this phone. This cannot be undone.',
    [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete everything', style: 'destructive', onPress: async () => {
      if (!online) { Alert.alert('Connect to the internet', 'You must be online to delete your account.'); return; }
      try { await deleteAccountRemote(user!.id); await wipeLocal(); Alert.alert('Account deleted', 'Your account and data have been deleted.'); }
      catch (e: any) { Alert.alert('Could not delete account', e.message ?? 'Please try again or contact support.'); }
    } }]);

  const mail = () => Linking.openURL(`mailto:${config.supportEmail || 'support@example.com'}?subject=CreekFinder%20support`);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.sand }}>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 60 }}>
        <Text style={font.h1}>Profile</Text>
        <Card style={{ marginTop: space.md, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.forest, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="person" size={28} color="#fff" /></View>
          <View style={{ flex: 1 }}>
            {user ? (<><Text style={font.h2}>{displayName}</Text><Text style={font.small}>{user.email}</Text></>) : (<><Text style={font.h2}>Guest</Text><Text style={font.small}>Saved on this phone only</Text></>)}
            <Text style={[font.small, { color: premium ? colors.ok : colors.muted, fontWeight: '700' }]}>{premium ? 'Premium' : `Free plan · ${places.data}/${FREE_PLACE_LIMIT} places`}</Text>
          </View>
        </Card>
        {!user && hasBackend && <View style={{ marginTop: space.md }}><Button icon="log-in" title="Sign in or create account" onPress={() => router.push('/auth')} /><Text style={[font.small, { marginTop: 6 }]}>Back up your creeks, use them on any phone, and share with the community.</Text></View>}
        {!premium && <View style={{ marginTop: space.md }}><Button variant="water" icon="star" title="Go Premium" onPress={() => router.push('/premium')} /></View>}

        {user && (
          <>
            <SectionTitle>Sync</SectionTitle>
            <Card>
              <Text style={font.body}>{!online ? 'Offline — changes are saved on this phone.' : syncing ? 'Syncing…' : pending > 0 ? `${pending} change${pending > 1 ? 's' : ''} waiting to upload` : 'Everything is backed up'}</Text>
              {lastSyncError && <Text style={[font.small, { color: colors.danger, marginTop: 4 }]}>{lastSyncError === 'FREE_LIMIT_REACHED' || lastSyncError.includes('FREE_LIMIT') ? 'Some places could not upload: the free plan limit was reached.' : lastSyncError}</Text>}
              <View style={{ marginTop: 10 }}><Button small variant="secondary" icon="sync" title="Sync now" onPress={sync} loading={syncing} disabled={!online} /></View>
            </Card>
          </>
        )}

        <SectionTitle>My outdoors</SectionTitle>
        <View style={{ borderRadius: 14, overflow: 'hidden' }}>
          <Row icon="footsteps" title="Tracking history" subtitle={`${advs.data} saved adventure${advs.data === 1 ? '' : 's'}`} onPress={() => router.push('/adventures')} />
          <Row icon="radio-button-on" title="Start tracking" onPress={() => router.push('/track')} />
          <Row icon="cloud-download" title="Offline maps" onPress={() => router.push('/offline')} />
          <Row icon="shield-checkmark" title="Safety & emergency sharing" onPress={() => router.push('/safety')} />
        </View>

        <SectionTitle>Settings</SectionTitle>
        <View style={{ borderRadius: 14, overflow: 'hidden' }}>
          <Row icon="speedometer" title="Use miles & feet" subtitle={imperial ? 'Imperial' : 'Metric (km & m)'} right={<Switch value={imperial} onValueChange={setImperial} trackColor={{ true: colors.forest }} />} />
          {user && <Row icon="create" title="Display name" subtitle={displayName} onPress={() => setRenaming(true)} />}
          <Row icon="location" title="Location permission" subtitle="Open phone settings" onPress={openSettings} />
        </View>

        <SectionTitle>Privacy & legal</SectionTitle>
        <View style={{ borderRadius: 14, overflow: 'hidden' }}>
          <Row icon="lock-closed" title="Your places are private by default" subtitle="Only places you switch to Public appear on the community map." />
          <Row icon="document-text" title="Privacy policy" onPress={() => router.push('/legal/privacy')} />
          <Row icon="document" title="Terms of service" onPress={() => router.push('/legal/terms')} />
          <Row icon="mail" title="Contact support" onPress={mail} />
        </View>

        {user && (
          <>
            <SectionTitle>Account</SectionTitle>
            <View style={{ borderRadius: 14, overflow: 'hidden' }}>
              <Row icon="log-out" title="Sign out" subtitle="Removes this account's data from this phone" onPress={() => Alert.alert('Sign out?', pending > 0 && !online ? `You have ${pending} unsynced changes and no connection — they would be lost. Connect first.` : 'Your data stays safe in your account.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign out', onPress: signOut }])} />
              <Row icon="trash" danger title="Delete account" subtitle="Permanently erase your account and data" onPress={confirmDelete} />
            </View>
          </>
        )}
        <Banner tone="info" icon="information-circle">CreekFinder {Constants.expoConfig?.version} · Maps © OpenStreetMap contributors © MapTiler. Always verify conditions and access yourself.</Banner>
      </ScrollView>
      <TextPrompt visible={renaming} title="Display name" initial={displayName} onCancel={() => setRenaming(false)} onSubmit={async (v) => { try { await updateDisplayName(user!.id, v); } catch (e: any) { Alert.alert('Error', e.message); } setRenaming(false); }} />
    </SafeAreaView>
  );
}

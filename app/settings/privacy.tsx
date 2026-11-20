import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Alert } from '../../src/lib/alert';
import { Banner, Button, Text } from '../../src/components/ui';
import { Group2, NavRow, SegmentRow, SettingsPage, SwitchRow } from '../../src/custom/controls';
import { CodeBox } from '../../src/custom/pages';
import { getDb, listAdventures, listPlaces, listVisits } from '../../src/db/local';
import { mutate, useSettings } from '../../src/custom/store';
import { useApp } from '../../src/state/app';
import { themed } from '../../src/custom/themed';
import { font } from '../../src/theme';

function Privacy() {
  const router = useRouter(); const p = useSettings().privacy; const { user } = useApp();
  const [data, setData] = React.useState('');
  const clearCaches = async () => { const db = await getDb(); await db.runAsync("DELETE FROM kv WHERE key LIKE 'c:%'"); Alert.alert('Cleared', 'Cached place info, photos lists and map styles were removed. They reload when needed.'); };
  const exportMine = async () => { const [places, advs, visits] = await Promise.all([listPlaces(), listAdventures(), listVisits(500)]); setData(JSON.stringify({ exportedAt: new Date().toISOString(), places, adventures: advs, visits }, null, 1)); };
  return (
    <SettingsPage>
      <Banner tone="info" icon="lock-closed">Everything you save is private by default. Private places, photos, tracks, visits and these settings are visible only to you.</Banner>
      <Group2 title="Sharing defaults">
        <SegmentRow title="New places are" options={[{ id: 'private', label: 'Private', icon: 'lock-closed' }, { id: 'public', label: 'Public', icon: 'globe' }]} value={p.defaultVisibility} onChange={(v) => mutate((d) => { d.privacy.defaultVisibility = v; })} />
        <SwitchRow icon="alert-circle" title="Ask before sharing publicly" subtitle="Confirm every time a place would become public" value={p.confirmShare} onChange={(v) => mutate((d) => { d.privacy.confirmShare = v; })} />
        <NavRow icon="folder" title="Private collections" subtitle="Folders whose places can never be shared" onPress={() => router.push('/folders')} />
      </Group2>
      <Group2 title="Location & visits"><SwitchRow icon="walk" title="Auto check-in at creeks" subtitle="Record a visit when you open a creek page while standing there. Stored only on this device." value={p.autoCheckIn} onChange={(v) => mutate((d) => { d.privacy.autoCheckIn = v; })} /></Group2>
      <Group2 title="Your data">
        <NavRow icon="trash-bin" title="Clear cached data" subtitle="Cached map styles and place info (your saved places are not touched)" onPress={clearCaches} />
        <NavRow icon="download" title="Export my data" subtitle="Places, adventures and visits as JSON" onPress={exportMine} />
        <NavRow icon="cloud-upload" title="Cloud sync & backups" subtitle="What is synced and how to delete it" onPress={() => router.push('/settings/cloud')} />
        {user ? <NavRow icon="person-remove" title="Delete account" subtitle="In Profile → Delete account" onPress={() => router.push('/(tabs)/profile')} /> : null}
      </Group2>
      {data ? <CodeBox title="My CreekFinder data" code={data} filename="my-creekfinder-data.json" /> : null}
      <Text style={[font.small, { marginTop: 12 }]}>Security: your sign-in token is stored in the iOS Keychain / Android Keystore (browser storage on the web app). Cloud settings are protected by row-level security — only you can read them.</Text>
      <View style={{ height: 6 }} /><Button variant="ghost" title="Read the privacy policy" onPress={() => router.push('/legal/privacy')} />
    </SettingsPage>
  );
}
void View;
export default themed(Privacy);

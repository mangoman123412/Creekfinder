import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '../../src/custom/Icon';
import { Alert } from '../../src/lib/alert';
import { Banner, Button, Text } from '../../src/components/ui';
import { Group2, SettingsPage } from '../../src/custom/controls';
import { CodeBox, PasteImport } from '../../src/custom/pages';
import { createBackup, listBackups, restoreBackup, syncCustomization, type BackupInfo } from '../../src/custom/sync';
import { getLibrary, useLibrary } from '../../src/custom/store';
import { encodeShare } from '../../src/custom/share';
import { useApp } from '../../src/state/app';
import { hasBackend } from '../../src/config';
import { colors, font } from '../../src/theme';
import { themed } from '../../src/custom/themed';

function Cloud() {
  const router = useRouter(); const { user, online } = useApp(); const lib = useLibrary();
  const [busy, setBusy] = useState(false); const [list, setList] = useState<BackupInfo[]>([]); const [file, setFile] = useState('');
  const reload = useCallback(async () => setList(await listBackups(user?.id ?? null)), [user?.id]);
  useEffect(() => { void reload(); }, [reload]);
  const sync = async () => { if (!user) return; setBusy(true); try { const r = await syncCustomization(user.id); Alert.alert('Synced', r === 'pulled' ? 'Newer settings from your account were applied here.' : r === 'pushed' ? 'Your settings were saved to your account.' : 'Already up to date.'); } catch (e: any) { Alert.alert('Sync failed', e.message ?? 'Try again.'); } setBusy(false); };
  const backup = async () => { setBusy(true); try { await createBackup(user?.id ?? null, `Backup ${new Date().toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`); await reload(); } catch (e: any) { Alert.alert('Backup failed', e.message); } setBusy(false); };
  return (
    <SettingsPage>
      {!hasBackend ? <Banner tone="info" icon="information-circle">Cloud sync needs the backend (Supabase) to be connected. Everything below that says “this device” works now.</Banner> : !user ? <Banner tone="info" icon="person">Sign in to sync your themes, layouts, map presets and profiles between devices.</Banner> : null}
      <Group2 title="Sync" footer="Synced: themes, home layouts, map presets, profiles and all customization settings. NOT synced: places, photos, tracks (those use normal account sync) or your location. Latest change wins.">
        <View style={{ padding: 16, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Ionicons name={user ? 'cloud-done' : 'cloud-offline'} size={22} color={user ? colors.ok : colors.faint} /><Text style={{ fontWeight: '700' }}>{user ? (online ? 'Syncing automatically' : 'Offline — will sync later') : 'Not signed in'}</Text></View>
          <Text style={font.small}>Last customization change: {lib.updatedAt ? new Date(lib.updatedAt).toLocaleString() : 'never'}</Text>
          {user ? <Button small icon="sync" title="Sync now" onPress={sync} loading={busy} disabled={!online} /> : hasBackend ? <Button small icon="log-in" title="Sign in" onPress={() => router.push('/auth')} /> : null}
        </View>
      </Group2>
      <Group2 title="Backups" footer="A backup is a snapshot you can restore later. Local snapshots are kept on this device; with an account they are also saved online (last 15). An automatic daily backup is made when you’re signed in. Restoring first saves a snapshot of your current setup.">
        <View style={{ padding: 16 }}><Button small icon="save" title="Back up now" onPress={backup} loading={busy} /></View>
        {list.length === 0 ? <Text style={[font.small, { padding: 16, paddingTop: 0 }]}>No backups yet.</Text> : list.slice(0, 12).map((b) => (
          <View key={b.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 }}>
            <Ionicons name={b.local ? 'phone-portrait' : 'cloud'} size={20} color={colors.primary} />
            <View style={{ flex: 1 }}><Text style={{ fontWeight: '700' }} numberOfLines={1}>{b.label}</Text><Text style={font.small}>{new Date(b.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} · {b.local ? 'this device' : 'cloud'}</Text></View>
            <Button small variant="secondary" title="Restore" onPress={() => Alert.alert('Restore this backup?', `“${b.label}” replaces your current customization. A snapshot of the current setup is saved first.`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Restore', style: 'destructive', onPress: async () => { const ok = await restoreBackup(user?.id ?? null, b); Alert.alert(ok ? 'Restored' : 'Could not restore'); await reload(); } }])} />
          </View>))}
      </Group2>
      <Group2 title="Export / import everything" footer="One code that contains all profiles, themes and map presets. Settings only — no personal data.">
        <View style={{ padding: 16 }}><Button small icon="share" title="Export all customization" variant="secondary" onPress={() => setFile(encodeShare('library', 'My CreekFinder', { library: getLibrary() }))} /></View>
      </Group2>
      {file ? <CodeBox title="All customization" code={file} filename="my-creekfinder-design.creekfinder.txt" /> : null}
      <PasteImport label="Restore from an exported code" />
    </SettingsPage>
  );
}
export default themed(Cloud);

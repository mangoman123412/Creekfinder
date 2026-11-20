import React, { useState } from 'react';
import { TextInput, View } from 'react-native';
import { Ionicons } from '../../src/custom/Icon';
import { Alert } from '../../src/lib/alert';
import { Banner, Button, Pressy, Text } from '../../src/components/ui';
import { Group2, IconGrid, SettingsPage } from '../../src/custom/controls';
import { CodeBox, PasteImport } from '../../src/custom/pages';
import { createProfile, deleteProfile, duplicateProfile, replaceLibrary, switchProfile, updateProfileMeta, useLibrary, getLibrary } from '../../src/custom/store';
import { PROFILE_ICONS, officialProfiles } from '../../src/custom/schema';
import { encodeShare, profileToPayload } from '../../src/custom/share';
import { colors, font, radius, shadow } from '../../src/theme';
import { themed } from '../../src/custom/themed';

function Profiles() {
  const lib = useLibrary();
  const [edit, setEdit] = useState<string | null>(null);
  const [name, setName] = useState(''); const [icon, setIcon] = useState('leaf');
  const [code, setCode] = useState<{ title: string; code: string } | null>(null);
  const [newName, setNewName] = useState('');
  const e = lib.profiles.find((p) => p.id === edit);
  const startEdit = (id: string) => { const p = lib.profiles.find((x) => x.id === id)!; setEdit(id); setName(p.name); setIcon(p.icon); };
  return (
    <SettingsPage>
      <Banner tone="info" icon="people-circle">A profile is a <Text style={{ fontWeight: '800' }}>complete setup</Text>: theme, home layout, navigation, map preset, creek details, tracking and more. Tap one to switch instantly. Changes you make are saved into the active profile.</Banner>
      <View style={{ marginTop: 8 }}>
        {lib.profiles.map((p) => { const on = p.id === lib.activeProfileId; return (
          <Pressy key={p.id} onPress={() => switchProfile(p.id)} scale={0.99} accessibilityLabel={`${p.name} profile${on ? ', active' : ''}`}>
            <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: on ? colors.primary : colors.surface, borderRadius: radius.md, padding: 14, marginBottom: 10 }, shadow.soft]}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: on ? 'rgba(255,255,255,0.2)' : colors.waterTint, alignItems: 'center', justifyContent: 'center' }}><Ionicons name={p.icon as any} size={22} color={on ? colors.onPrimary : colors.water} /></View>
              <View style={{ flex: 1 }}><Text style={{ fontWeight: '800', fontSize: 16, color: on ? colors.onPrimary : colors.ink }}>{p.name}</Text><Text style={{ fontSize: 12, color: on ? colors.onPrimary : colors.muted }}>{on ? 'Active now' : p.official ? 'Built-in' : 'Yours'} · {p.settings.nav.style} nav · {p.settings.detail.layout} creeks</Text></View>
              <Pressy onPress={() => startEdit(p.id)} accessibilityLabel={`Edit ${p.name}`} hitSlop={8}><Ionicons name="create" size={21} color={on ? colors.onPrimary : colors.muted} /></Pressy>
            </View>
          </Pressy>); })}
      </View>
      {e && (
        <Group2 title={`Edit profile`}>
          <View style={{ padding: 16 }}>
            <Text style={font.label}>Name</Text>
            <TextInput value={name} onChangeText={setName} maxLength={30} accessibilityLabel="Profile name" placeholder="Profile name" placeholderTextColor={colors.faint} style={{ backgroundColor: colors.surface2, borderRadius: 12, padding: 12, fontSize: 16, color: colors.ink, marginTop: 6 }} />
          </View>
          <Text style={[font.label, { paddingHorizontal: 16 }]}>Icon</Text>
          <IconGrid icons={PROFILE_ICONS} value={icon} onChange={setIcon} />
          <View style={{ padding: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Button small icon="checkmark" title="Save" onPress={() => { updateProfileMeta(e.id, { name, icon }); setEdit(null); }} />
            <Button small variant="secondary" icon="copy" title="Duplicate" onPress={() => { duplicateProfile(e.id); setEdit(null); }} />
            <Button small variant="secondary" icon="share" title="Export" onPress={() => setCode({ title: `Profile: ${e.name}`, code: encodeShare('profile', e.name, profileToPayload(e)) })} />
            {e.official && <Button small variant="secondary" icon="refresh" title="Restore original" onPress={() => { const o = officialProfiles().find((x) => x.id === e.id); if (o) replaceLibrary({ ...getLibrary(), profiles: getLibrary().profiles.map((p) => (p.id === e.id ? { ...p, settings: o.settings } : p)) }, 'edit'); }} />}
            <Button small variant="danger" icon="trash" title="Delete" onPress={() => Alert.alert(`Delete “${e.name}”?`, 'This can’t be undone.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => { if (!deleteProfile(e.id)) Alert.alert('Keep one profile', 'You need at least one profile.'); setEdit(null); } }])} />
          </View>
        </Group2>)}
      {code && <CodeBox title={code.title} code={code.code} filename="profile.creekfinder.txt" />}
      <Group2 title="Create a new profile" footer="Starts as a copy of your active profile.">
        <View style={{ padding: 16, gap: 10 }}>
          <TextInput value={newName} onChangeText={setNewName} maxLength={30} placeholder="e.g. Kayaking" placeholderTextColor={colors.faint} accessibilityLabel="New profile name" style={{ backgroundColor: colors.surface2, borderRadius: 12, padding: 12, fontSize: 16, color: colors.ink }} />
          <Button icon="add-circle" title="Create profile" disabled={!newName.trim()} onPress={() => { createProfile(newName, 'star'); setNewName(''); }} />
        </View>
      </Group2>
      <PasteImport label="Import a profile code" />
    </SettingsPage>
  );
}
export default themed(Profiles);

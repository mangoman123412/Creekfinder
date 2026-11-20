import React, { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';
import { Ionicons } from '../../src/custom/Icon';
import { Alert } from '../../src/lib/alert';
import { Banner, Button, Chip, Text } from '../../src/components/ui';
import { Group2, SegmentRow, SettingsPage, SliderRow, SwitchRow } from '../../src/custom/controls';
import { NOTIF_CATS, NOTIF_META, type NotifCat, type SoundId } from '../../src/custom/schema';
import { mutate, resetSection, useSettings } from '../../src/custom/store';
import { canChooseSound, deliverSystem, notifPermission, previewSound, requestNotifPermission } from '../../src/custom/deliver';
import { addNotification } from '../../src/db/local';
import { isQuietNow } from '../../src/custom/quiet';
import { colors, font } from '../../src/theme';
import { themed } from '../../src/custom/themed';

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const SOUNDS: { id: SoundId; label: string }[] = [{ id: 'default', label: 'Default' }, { id: 'chime', label: 'Chime' }, { id: 'siren', label: 'Siren' }, { id: 'silent', label: 'Silent' }];
const TIMES = ['20:00', '21:00', '22:00', '23:00', '05:00', '06:00', '07:00', '08:00'];

function Time({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [t, setT] = useState(value); useEffect(() => setT(value), [value]);
  return (
    <View style={{ padding: 16 }}>
      <Text style={[font.body, { fontWeight: '600' }]}>{label}</Text>
      <TextInput value={t} onChangeText={(x) => { setT(x); if (/^([01]\d|2[0-3]):[0-5]\d$/.test(x)) onChange(x); }} maxLength={5} accessibilityLabel={label} placeholder="HH:MM" placeholderTextColor={colors.faint} style={{ backgroundColor: colors.surface2, borderRadius: 12, padding: 10, fontSize: 16, color: /^([01]\d|2[0-3]):[0-5]\d$/.test(t) ? colors.ink : colors.danger, marginTop: 8, width: 110 }} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>{TIMES.map((x) => <Chip key={x} label={x} active={value === x} onPress={() => onChange(x)} />)}</View>
    </View>
  );
}

function Notifications() {
  const n = useSettings().notifications;
  const [perm, setPerm] = useState<string>('…');
  useEffect(() => { void notifPermission().then(setPerm); }, []);
  const quietNow = isQuietNow(n.quiet, new Date());
  const toggle = (c: NotifCat, v: boolean) => mutate((d) => { d.notifications.enabled[c] = v; });
  const cats = (safety: boolean) => NOTIF_CATS.filter((c) => NOTIF_META[c].safety === safety);
  const test = async (safety: boolean) => {
    const sound = safety ? n.sounds.safety : n.sounds.social;
    await addNotification({ cat: safety ? 'flood' : 'nearby', safety, title: safety ? 'Test: flash flood warning' : 'Test: 2 new waterfalls near you', body: safety ? 'This is only a test of your safety alert style and sound.' : 'This is only a test of your update style and sound.', dedupe: `test:${Date.now()}` });
    await deliverSystem(safety ? 'Test: flash flood warning' : 'Test: 2 new waterfalls near you', 'This is only a test.', safety, sound);
    Alert.alert('Test sent', `A ${safety ? 'safety' : 'regular'} test alert was added to your inbox${perm === 'granted' ? ' and shown as a system notification' : ''}.`);
  };
  return (
    <SettingsPage onReset={() => resetSection('notifications')} resetLabel="Reset notifications">
      <Banner tone="info" icon="information-circle">Alerts are checked while CreekFinder is open (and every 10 minutes while it stays open). Notifications while the app is fully closed need a push server, which isn’t set up yet. Weather and flood alerts use the US National Weather Service.</Banner>
      <Group2 title="Delivery" footer={perm === 'granted' ? 'System notifications are allowed.' : 'Allow system notifications to see pop-ups and hear sounds. Everything also lands in the in-app inbox.'}>
        <SegmentRow options={[{ id: 'system', label: 'Pop-up + inbox', icon: 'notifications' }, { id: 'inbox', label: 'Inbox only', icon: 'mail' }]} value={n.deliver} onChange={(v) => mutate((d) => { d.notifications.deliver = v; })} />
        {perm !== 'granted' && <View style={{ padding: 16 }}><Button small icon="notifications" title="Allow system notifications" onPress={async () => { await requestNotifPermission(); setPerm(await notifPermission()); }} /></View>}
      </Group2>
      <Group2 title="Safety alerts" footer="Safety alerts look different (red, labelled SAFETY) and are never mixed in with ordinary updates.">
        {cats(true).map((c) => <SwitchRow key={c} icon={NOTIF_META[c].icon as any} title={NOTIF_META[c].title} subtitle={NOTIF_META[c].blurb} value={n.enabled[c]} onChange={(v) => toggle(c, v)} />)}
      </Group2>
      <Group2 title="Updates" footer="“Likes” and “followers” aren’t part of CreekFinder, so there is nothing to notify about for them.">
        {cats(false).map((c) => <SwitchRow key={c} icon={NOTIF_META[c].icon as any} title={NOTIF_META[c].title} subtitle={NOTIF_META[c].blurb} value={n.enabled[c]} onChange={(v) => toggle(c, v)} />)}
        <SliderRow title="Remind me before a trip" value={n.tripLeadHours} min={1} max={72} step={1} format={(v) => `${v} h`} onChange={(v) => mutate((d) => { d.notifications.tripLeadHours = v; })} />
      </Group2>
      <Group2 title="Quiet hours" footer={n.quiet.enabled ? (quietNow ? 'Quiet hours are active right now — updates are held in the inbox.' : 'Outside quiet hours right now.') : 'Hold pop-ups and sounds during set hours. Alerts still arrive in your inbox.'}>
        <SwitchRow icon="moon" title="Enable quiet hours" value={n.quiet.enabled} onChange={(v) => mutate((d) => { d.notifications.quiet.enabled = v; })} />
        {n.quiet.enabled && (<>
          <Time label="From" value={n.quiet.from} onChange={(v) => mutate((d) => { d.notifications.quiet.from = v; })} />
          <Time label="Until" value={n.quiet.to} onChange={(v) => mutate((d) => { d.notifications.quiet.to = v; })} />
          <View style={{ padding: 16 }}><Text style={[font.body, { fontWeight: '600' }]}>Days (the night that starts on…)</Text><View style={{ flexDirection: 'row', marginTop: 8 }}>{DAYS.map((l, i) => <Chip key={i} label={l} active={n.quiet.days[i]} onPress={() => mutate((d) => { d.notifications.quiet.days[i] = !d.notifications.quiet.days[i]; })} />)}</View></View>
          <SwitchRow icon="warning" title="Still deliver flash-flood alerts" subtitle="Recommended — floods are dangerous" value={n.quiet.allowFloodDuringQuiet} onChange={(v) => mutate((d) => { d.notifications.quiet.allowFloodDuringQuiet = v; })} />
        </>)}
      </Group2>
      <Group2 title="Sounds" footer={canChooseSound ? 'Sounds are generated by the app and play when an alert arrives while the app is open.' : 'On phones the system controls notification sounds: “Silent” mutes them, any other choice uses your phone’s default sound.'}>
        <SegmentRow title="Safety alerts" options={SOUNDS} value={n.sounds.safety} onChange={(v) => { mutate((d) => { d.notifications.sounds.safety = v; }); previewSound(v); }} />
        <SegmentRow title="Other updates" options={SOUNDS} value={n.sounds.social} onChange={(v) => { mutate((d) => { d.notifications.sounds.social = v; }); previewSound(v); }} />
      </Group2>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}><Button small variant="danger" icon="warning" title="Test safety alert" style={{ flex: 1 }} onPress={() => test(true)} /><Button small variant="secondary" icon="notifications" title="Test update" style={{ flex: 1 }} onPress={() => test(false)} /></View>
    </SettingsPage>
  );
}
void Ionicons;
export default themed(Notifications);

import React, { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '../src/custom/Icon';
import { Banner, Button, Chip, Empty, Pill, Pressy, Text } from '../src/components/ui';
import { SafetyPanel } from '../src/components/SafetyPanel';
import { ensureForegroundPermission, lastKnown } from '../src/lib/location';
import { clearNotifications, listNotifications, markAllRead, type AppNotification } from '../src/db/local';
import { useDbQuery } from '../src/state/hooks';
import { runAlertChecks } from '../src/custom/alerts';
import { useApp } from '../src/state/app';
import { NOTIF_META, type NotifCat } from '../src/custom/schema';
import { colors, font, radius, shadow } from '../src/theme';
import { themed } from '../src/custom/themed';

function Alerts() {
  const router = useRouter();
  const { user } = useApp();
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [denied, setDenied] = useState(false);
  const [filter, setFilter] = useState<'all' | 'safety' | 'updates'>('all');
  const inbox = useDbQuery(() => listNotifications(100), [], [] as AppNotification[]);
  useEffect(() => { void (async () => { if (!(await ensureForegroundPermission())) { setDenied(true); return; } const l = await lastKnown(); if (l) setPos(l); })(); void runAlertChecks(user?.id ?? null); return () => { void markAllRead(); }; }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = inbox.data.filter((n) => filter === 'all' || (filter === 'safety' ? n.safety : !n.safety));
  const open = (n: AppNotification) => { if (n.ref) router.push({ pathname: '/creek', params: { source: 'community', id: n.ref } }); };

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: 18, paddingBottom: 110 }}>
      <Text style={font.h1}>Alerts & notifications</Text>
      <Text style={[font.small, { marginVertical: 8 }]}>Safety alerts are shown in red and kept separate from ordinary updates. Alerts are checked while CreekFinder is open.</Text>
      <View style={{ flexDirection: 'row', marginTop: 4 }}>
        <Chip label="All" active={filter === 'all'} onPress={() => setFilter('all')} /><Chip label="Safety" icon="warning" active={filter === 'safety'} onPress={() => setFilter('safety')} /><Chip label="Updates" icon="notifications" active={filter === 'updates'} onPress={() => setFilter('updates')} />
      </View>
      <View style={{ marginTop: 12 }}>
        {shown.length === 0 ? <Empty icon="notifications-outline" title="You're all caught up" body="New safety alerts and updates appear here. Choose which ones you get in Settings → Notifications." action={<Button small variant="secondary" icon="options" title="Notification settings" onPress={() => router.push('/settings/notifications')} />} /> : shown.map((n) => {
          const meta = NOTIF_META[n.cat as NotifCat];
          return (
            <Pressy key={n.id} onPress={() => open(n)} scale={0.99} accessibilityLabel={n.title}>
              <View style={[{ flexDirection: 'row', gap: 12, backgroundColor: n.safety ? colors.dangerTint : colors.surface, borderRadius: radius.md, padding: 14, marginBottom: 10, borderLeftWidth: n.safety ? 5 : 0, borderLeftColor: colors.danger, opacity: n.read ? 0.8 : 1 }, shadow.soft]}>
                <Ionicons name={(meta?.icon ?? 'notifications') as any} size={22} color={n.safety ? colors.danger : colors.primary} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>{n.safety ? <Pill tone="danger" icon="warning" label="SAFETY ALERT" /> : <Pill label={meta?.title ?? 'Update'} />}{!n.read && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.water }} />}</View>
                  <Text style={{ fontWeight: '800', marginTop: 4 }}>{n.title}</Text>{n.body ? <Text style={font.small}>{n.body}</Text> : null}
                  <Text style={[font.small, { marginTop: 4, fontSize: 11.5 }]}>{new Date(n.ts).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</Text>
                </View>
              </View>
            </Pressy>);
        })}
        {inbox.data.length > 0 && <Button small variant="ghost" title="Clear all" onPress={() => clearNotifications()} />}
      </View>
      <Text style={[font.h2, { marginTop: 24, marginBottom: 8 }]}>Conditions right now</Text>
      {denied && <Banner tone="info" icon="location">Allow location access to see alerts for where you are.</Banner>}
      {pos ? <SafetyPanel lat={pos.lat} lng={pos.lng} /> : !denied && <Text style={font.small}>Finding your location…</Text>}
    </ScrollView>
  );
}
export default themed(Alerts);

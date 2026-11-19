import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Platform, ScrollView, View } from 'react-native';
import { Text } from '../src/components/ui';
import { Alert } from '../src/lib/alert';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { PurchasesPackage } from 'react-native-purchases';
import { Banner, Button, Card } from '../src/components/ui';
import { useApp } from '../src/state/app';
import { billingConfigured, buy, getPackages, restore } from '../src/lib/entitlements';
import { FREE_ADVENTURE_LIMIT, FREE_PLACE_LIMIT } from '../src/config';
import { colors, font, space } from '../src/theme';

const WHY: Record<string, string> = {
  limit: `You've saved ${FREE_PLACE_LIMIT} places — the free limit. Go Premium for unlimited saved creeks.`,
  maps: 'Satellite and topographic maps are part of Premium.',
  offline: 'Offline map downloads are part of Premium.',
  photos: 'Premium lets each place hold up to 30 photos (free: 5).',
  filters: 'Advanced search filters are part of Premium.',
  history: `Free accounts keep ${FREE_ADVENTURE_LIMIT} adventures. Premium keeps unlimited GPS history.`,
};

const FEATURES: [string, string, string][] = [
  ['infinite', 'Unlimited saved locations', `Free: ${FREE_PLACE_LIMIT}`],
  ['earth', 'Satellite & topographic maps', 'Free: standard map'],
  ['cloud-download', 'Offline map downloads', 'Free: not included'],
  ['footsteps', 'Unlimited GPS adventure history', `Free: last ${FREE_ADVENTURE_LIMIT}`],
  ['options', 'Advanced search filters', 'Free: basic filters'],
  ['images', 'More photo storage', 'Free: 5 photos per place · Premium: 30'],
];

export default function Premium() {
  const { reason } = useLocalSearchParams<{ reason?: string }>();
  const router = useRouter();
  const { premium, refreshPremium, user, devPremium, setDevPremium } = useApp();
  const [pkgs, setPkgs] = useState<PurchasesPackage[] | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { void getPackages().then(setPkgs).catch(() => setPkgs([])); }, []);

  const purchase = async (p: PurchasesPackage) => {
    setBusy(true);
    try { if (await buy(p)) { await refreshPremium(); Alert.alert('Welcome to Premium', 'Thank you for supporting CreekFinder!'); router.back(); } }
    catch (e: any) { if (!e?.userCancelled) Alert.alert('Purchase failed', e?.message ?? 'Please try again.'); }
    setBusy(false);
  };
  const doRestore = async () => {
    setBusy(true);
    try { const ok = await restore(); await refreshPremium(); Alert.alert(ok ? 'Restored' : 'Nothing to restore', ok ? 'Premium is active again.' : 'No active subscription was found for this store account.'); }
    catch (e: any) { Alert.alert('Could not restore', e.message); }
    setBusy(false);
  };

  return (
    <ScrollView style={{ backgroundColor: colors.sand }} contentContainerStyle={{ padding: space.lg, paddingBottom: 60 }}>
      <Text style={font.h1}>CreekFinder Premium</Text>
      {reason && WHY[reason] ? <Banner tone="info" icon="information-circle">{WHY[reason]}</Banner> : null}
      <Card style={{ marginTop: space.md }}>
        {FEATURES.map(([icon, t, free]) => (
          <View key={t} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 }}>
            <Ionicons name={icon as any} size={22} color={colors.forest} />
            <View style={{ flex: 1 }}><Text style={[font.body, { fontWeight: '700' }]}>{t}</Text><Text style={font.small}>{free}</Text></View>
            <Ionicons name="checkmark-circle" size={20} color={colors.ok} />
          </View>
        ))}
      </Card>
      <Text style={[font.small, { marginTop: 10 }]}>The free version stays useful: save up to {FREE_PLACE_LIMIT} places, standard maps, GPS tracking, offline coordinates/notes/photos, and browsing public creeks.</Text>

      {premium ? <Banner tone="info" icon="checkmark-circle">Premium is active on this account.</Banner> : !billingConfigured ? (
        <Banner tone="warn" icon="construct">In-app purchases aren't configured in this build. Add your RevenueCat keys (docs/SETUP.md) after creating the subscription in App Store Connect / Google Play Console.</Banner>
      ) : pkgs == null ? <ActivityIndicator style={{ margin: 20 }} color={colors.forest} /> : pkgs.length === 0 ? (
        <Banner tone="warn" icon="alert-circle">No subscription products are available right now. Please try again later.</Banner>
      ) : (
        <View style={{ gap: 10, marginTop: space.lg }}>
          {pkgs.map((p) => (
            <Button key={p.identifier} loading={busy} title={`${p.product.title.replace(/\s*\(.*\)/, '')} — ${p.product.priceString}${p.packageType === 'ANNUAL' ? '/year' : p.packageType === 'MONTHLY' ? '/month' : ''}`} onPress={() => purchase(p)} />
          ))}
        </View>
      )}
      {billingConfigured && <View style={{ marginTop: 10 }}><Button variant="ghost" title="Restore purchases" onPress={doRestore} /></View>}
      <Text style={[font.small, { marginTop: 14 }]}>
        Subscriptions renew automatically unless cancelled at least 24 hours before the end of the period. Payment is charged to your {Platform.OS === 'ios' ? 'Apple ID' : 'Google Play'} account. Manage or cancel any time in your {Platform.OS === 'ios' ? 'App Store' : 'Google Play'} subscription settings.
      </Text>
      <View style={{ flexDirection: 'row', gap: 16, marginTop: 10 }}>
        <Text style={{ color: colors.water, fontWeight: '700' }} onPress={() => router.push('/legal/terms')}>Terms</Text>
        <Text style={{ color: colors.water, fontWeight: '700' }} onPress={() => router.push('/legal/privacy')}>Privacy</Text>
      </View>
      {__DEV__ && (
        <View style={{ marginTop: 24 }}>
          <Banner tone="info" icon="bug">Developer build only: simulate Premium to test gating without a store account.</Banner>
          <Button variant="secondary" title={devPremium ? 'Turn dev Premium OFF' : 'Turn dev Premium ON'} onPress={() => setDevPremium(!devPremium)} />
        </View>
      )}
    </ScrollView>
  );
}

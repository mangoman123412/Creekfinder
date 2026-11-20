import React, { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Banner, Button, SAFETY_NOTICE, Text } from '../../src/components/ui';
import { HomeDataProvider, useHome } from '../../src/custom/homeData';
import { renderWidget } from '../../src/custom/widgets';
import { useSettings } from '../../src/custom/store';
import { useApp } from '../../src/state/app';
import { colors, font, gutter } from '../../src/theme';
import { themed } from '../../src/custom/themed';

function HomeBody() {
  const router = useRouter();
  const { online, pending, user } = useApp();
  const home = useHome();
  const widgets = useSettings().home.widgets.filter((w) => w.visible);
  const hasHeader = widgets.some((w) => w.type === 'header');
  const [refreshing, setRefreshing] = useState(false);
  const first = widgets[0];
  const heroFirst = first?.type === 'explore_map' && !hasHeader && first.size === 'large';
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 150 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await home.reload(); setRefreshing(false); }} />}>
        {heroFirst && renderWidget(first, hasHeader)}
        <View style={{ paddingHorizontal: gutter(), paddingTop: heroFirst ? 0 : 56 }}>
          {!online && <Banner tone="info" icon="cloud-offline">You're offline. Saving, photos, notes and GPS tracking still work and will sync later.</Banner>}
          {online && pending > 0 && user && <Banner tone="info" icon="sync">{pending} change{pending > 1 ? 's' : ''} waiting to sync.</Banner>}
          {home.msg && <Banner tone="info" icon="information-circle">{home.msg}</Banner>}
          {widgets.filter((w) => !(heroFirst && w === first)).map((w) => renderWidget(w, hasHeader))}
          {widgets.length === 0 && <View style={{ marginTop: 30, alignItems: 'center' }}><Text style={font.h2}>Your Home screen is empty</Text><Text style={[font.small, { textAlign: 'center', marginVertical: 8 }]}>Add widgets in the Home editor.</Text></View>}
          <View style={{ marginTop: 22 }}><Button variant="secondary" icon="color-palette" title="Customize this screen" onPress={() => router.push({ pathname: '/editor', params: { tab: 'home' } })} /></View>
          <Text style={[font.small, { marginTop: 16 }]}>Photos from Wikimedia Commons & explorers. Place data © OpenStreetMap contributors.</Text>
          <Banner icon="warning">{SAFETY_NOTICE}</Banner>
        </View>
      </ScrollView>
    </View>
  );
}

function Home() {
  const widgets = useSettings().home.widgets.filter((w) => w.visible);
  const need = useMemo(() => {
    const t = new Set(widgets.map((w) => w.type));
    return { geo: ['header', 'explore_map', 'nearby', 'popular_waterfalls', 'new_discoveries', 'weather', 'conditions', 'recent_saved', 'favorites'].some((x) => t.has(x as any)),
      items: ['explore_map', 'nearby', 'popular_waterfalls', 'new_discoveries'].some((x) => t.has(x as any)), weather: t.has('weather') || t.has('header') || t.has('explore_map'), gauges: t.has('conditions') };
  }, [widgets.map((w) => w.type).join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
  return <HomeDataProvider need={need}><HomeBody /></HomeDataProvider>;
}
export default themed(Home);

import React from 'react';
import { ScrollView } from 'react-native';
import { Text } from '../src/components/ui';
import { Banner } from '../src/components/ui';
import { colors, font, space } from '../src/theme';

export default function OfflineWeb() {
  return (
    <ScrollView style={{ backgroundColor: colors.sand }} contentContainerStyle={{ padding: space.lg }}>
      <Text style={font.h2}>Offline use in the web app</Text>
      <Banner tone="info" icon="information-circle">Downloadable map regions need the native app. In this web app, map areas you have already viewed are cached automatically on this phone for a while.</Banner>
      <Text style={[font.body, { marginTop: 12 }]}>
        Works with no signal once installed to your Home Screen:{'\n'}• your saved places, coordinates, notes and photos{'\n'}• saving a new place (GPS works without cell service){'\n'}• recording a GPS trail while the app stays open{'\n'}• everything syncs when you're back online.
      </Text>
      <Text style={[font.body, { marginTop: 12 }]}>Before you head out: open the Map and pan/zoom around the area you'll visit while you have signal, so those tiles are cached.</Text>
    </ScrollView>
  );
}

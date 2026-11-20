import React from 'react';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { Button } from '../../src/components/ui';
import { SettingsPage } from '../../src/custom/controls';
import { LivePreview } from '../../src/custom/pages';
import { WidgetsSection } from '../../src/custom/sections';
import { mutate, useSettings } from '../../src/custom/store';
import { themed } from '../../src/custom/themed';

function HomeSettings() {
  const s = useSettings(); const router = useRouter();
  return (
    <SettingsPage>
      <LivePreview width={170} />
      <View style={{ marginBottom: 14 }}><Button icon="color-wand" title="Open the live editor (preview + undo)" variant="secondary" onPress={() => router.push({ pathname: '/editor', params: { tab: 'home' } })} /></View>
      <WidgetsSection s={s} update={(fn) => mutate(fn)} />
    </SettingsPage>
  );
}
export default themed(HomeSettings);

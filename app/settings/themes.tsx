import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '../../src/custom/Icon';
import { useColorScheme } from 'react-native';
import { Button, Pressy, Text } from '../../src/components/ui';
import { Group2, NavRow, SettingsPage } from '../../src/custom/controls';
import { CodeBox, PasteImport } from '../../src/custom/pages';
import { applyThemeSpec, activeProfile, deleteTheme, getLibrary, mutate, useLibrary, useSettings } from '../../src/custom/store';
import { OFFICIAL_THEMES } from '../../src/custom/schema';
import { resolveSeeds } from '../../src/custom/themeEngine';
import { encodeShare, profileToPayload } from '../../src/custom/share';
import { colors, font } from '../../src/theme';
import { themed } from '../../src/custom/themed';

function Themes() {
  const router = useRouter(); const lib = useLibrary(); const s = useSettings(); const sys = useColorScheme() === 'dark';
  const [code, setCode] = useState<{ title: string; code: string } | null>(null);
  const swatch = (t: typeof OFFICIAL_THEMES[number]) => { const sd = resolveSeeds(t.spec, sys).seeds; return [sd.primary, sd.secondary, sd.background]; };
  return (
    <SettingsPage>
      <Group2><NavRow icon="storefront" title="Open the marketplace" subtitle="Browse, preview, rate and download themes & layouts" onPress={() => router.push('/marketplace')} /></Group2>
      <Group2 title="Official CreekFinder themes">
        {OFFICIAL_THEMES.map((t) => (
          <View key={t.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 }}>
            <View style={{ flexDirection: 'row' }}>{swatch(t).map((c, i) => <View key={i} style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: c, marginLeft: i ? -6 : 0, borderWidth: 1.5, borderColor: colors.surface }} />)}</View>
            <Text style={{ flex: 1, fontWeight: '700' }}>{t.name}</Text>
            {s.theme.presetId === t.spec.presetId && !Object.keys(s.theme.overrides).length ? <Ionicons name="checkmark-circle" size={20} color={colors.primary} /> : <Button small variant="secondary" title="Apply" onPress={() => applyThemeSpec(t.spec)} />}
          </View>))}
      </Group2>
      {lib.themes.length > 0 && (
        <Group2 title="My themes">
          {lib.themes.map((t) => (
            <View key={t.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 }}>
              <Text style={{ flex: 1, fontWeight: '700' }} numberOfLines={1}>{t.name}</Text>
              <Button small variant="secondary" title="Apply" onPress={() => applyThemeSpec(t.spec)} />
              <Button small variant="secondary" icon="share" title="" onPress={() => setCode({ title: `Theme: ${t.name}`, code: encodeShare('theme', t.name, { spec: t.spec }) })} />
              <Pressy onPress={() => deleteTheme(t.id)} accessibilityLabel={`Delete ${t.name}`} hitSlop={8}><Ionicons name="trash" size={19} color={colors.danger} /></Pressy>
            </View>))}
        </Group2>)}
      <Text style={[font.label, { marginTop: 22, marginBottom: 4, marginLeft: 4 }]}>Share what you’ve made</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
        <Button small icon="color-palette" title="Current theme" variant="secondary" onPress={() => setCode({ title: 'My current theme', code: encodeShare('theme', 'My theme', { spec: s.theme }) })} />
        <Button small icon="home" title="Home layout" variant="secondary" onPress={() => setCode({ title: 'My Home layout', code: encodeShare('layout', 'My home layout', { widgets: s.home.widgets }) })} />
        <Button small icon="person-circle" title="Whole profile" variant="secondary" onPress={() => { const p = activeProfile(); setCode({ title: `Profile: ${p.name}`, code: encodeShare('profile', p.name, profileToPayload(p)) }); }} />
        <Button small icon="albums" title="Everything" variant="secondary" onPress={() => setCode({ title: 'All my customization (backup)', code: encodeShare('library', 'Backup', { library: getLibrary() }) })} />
      </View>
      {code && <CodeBox title={code.title} code={code.code} filename="design.creekfinder.txt" />}
      <PasteImport />
      <Text style={[font.small, { marginTop: 12 }]}>Design codes contain settings only — colours, layouts and preferences. They are validated on import and can never run code or include your places, photos or location.</Text>
      <View style={{ height: 6 }} /><Pressy onPress={() => mutate((d) => { d.theme = { presetId: 'forest', mode: 'system', overrides: {} }; })} accessibilityLabel="Reset theme"><Text style={{ color: colors.primary, fontWeight: '700' }}>Reset to the default theme</Text></Pressy>
    </SettingsPage>
  );
}
export default themed(Themes);

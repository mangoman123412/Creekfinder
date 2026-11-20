import React, { useState } from 'react';
import { Platform, Share, TextInput, useColorScheme, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Alert } from '../lib/alert';
import { Button, Text } from '../components/ui';
import { MiniPhone, type DeviceId } from './MiniPhone';
import { useSettings, addImportedProfile, applyThemeSpec, createMapPreset, saveMapPreset, mutate, replaceLibrary, getLibrary } from './store';
import { decodeShare } from './share';
import { colors, font, radius, shadow } from '../theme';
import type { Settings } from './schema';
import { sanitizeLibrary } from './schema';
import { SettingsPage } from './controls';

export function LivePreview({ s, device = 'phone', width = 190, caption = true }: { s?: Settings; device?: DeviceId; width?: number; caption?: boolean }) {
  const live = useSettings(); const sys = useColorScheme() === 'dark';
  return (
    <View style={{ alignItems: 'center', marginBottom: 6 }}>
      <MiniPhone s={s ?? live} systemDark={sys} device={device} width={width} />
      {caption && <Text style={[font.small, { marginTop: 6 }]}>Live preview — updates as you change settings</Text>}
    </View>
  );
}

/** Show a share code with Copy / Share / Download (web) actions. */
export function CodeBox({ title, code, filename }: { title: string; code: string; filename: string }) {
  const copy = async () => { await Clipboard.setStringAsync(code); Alert.alert('Copied', 'Design code copied. Paste it into a message to share it.'); };
  const share = async () => { try { if (Platform.OS === 'web' && (navigator as any).share) await (navigator as any).share({ title, text: code }); else await Share.share({ message: code, title }); } catch {} };
  const download = () => { const url = URL.createObjectURL(new Blob([code], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 4000); };
  return (
    <View style={[{ backgroundColor: colors.surface, borderRadius: radius.md, padding: 14, marginTop: 10 }, shadow.soft]}>
      <Text style={{ fontWeight: '800' }}>{title}</Text>
      <Text selectable numberOfLines={3} style={{ fontSize: 11, color: colors.muted, marginVertical: 8 }}>{code}</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button small variant="secondary" icon="copy" title="Copy" style={{ flex: 1 }} onPress={copy} />
        <Button small variant="secondary" icon="share" title="Share" style={{ flex: 1 }} onPress={share} />
        {Platform.OS === 'web' && <Button small variant="secondary" icon="download" title="File" style={{ flex: 1 }} onPress={download} />}
      </View>
    </View>
  );
}

/** Apply a decoded design. Returns a human message. Everything has already been validated by decodeShare(). */
export function applyDecoded(d: ReturnType<typeof decodeShare>): string {
  if (!d.ok) return d.error;
  switch (d.kind) {
    case 'theme': applyThemeSpec(d.spec); return `Theme “${d.name}” applied.`;
    case 'layout': mutate((s) => { s.home.widgets = d.widgets; }); return `Home layout “${d.name}” applied.`;
    case 'profile': addImportedProfile({ name: d.name, icon: d.icon, settings: d.settings }); return `Profile “${d.name}” added to your profiles.`;
    case 'mappreset': { const id = createMapPreset(d.name, d.preset); void id; saveMapPreset; return `Map preset “${d.name}” added and selected.`; }
    case 'library': replaceLibrary(sanitizeLibrary(d.library), 'edit'); return 'All customization restored from the file.'; 
  }
}

/** Paste a design code (or load a file on web) and apply it after a confirmation. */
export function PasteImport({ label = 'Import a design code' }: { label?: string }) {
  const [text, setText] = useState('');
  const go = (t: string) => {
    const d = decodeShare(t);
    if (!d.ok) { Alert.alert('Can’t import', d.error); return; }
    const what = { theme: 'theme', layout: 'home layout', profile: 'profile', mappreset: 'map preset', library: 'complete backup (replaces ALL your customization)' }[d.kind];
    Alert.alert(`Import ${what}?`, `“${d.name}” — it contains settings only (colours, layouts, preferences) and cannot run code.`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Import', onPress: () => { Alert.alert('Done', applyDecoded(d)); setText(''); } }]);
  };
  const file = () => { const i = document.createElement('input'); i.type = 'file'; i.accept = '.json,.txt,.creekfinder'; i.onchange = async () => { const f = i.files?.[0]; if (f && f.size < 200_000) go(await f.text()); }; i.click(); };
  return (
    <View style={[{ backgroundColor: colors.surface, borderRadius: radius.md, padding: 14, marginTop: 10 }, shadow.soft]}>
      <Text style={{ fontWeight: '800' }}>{label}</Text>
      <TextInput value={text} onChangeText={setText} placeholder="Paste a code that starts with CF1:" placeholderTextColor={colors.faint} multiline autoCapitalize="none" autoCorrect={false} accessibilityLabel="Design code" style={{ backgroundColor: colors.surface2, borderRadius: 12, padding: 12, minHeight: 64, color: colors.ink, marginVertical: 10, fontSize: 12 }} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button small icon="download" title="Import" style={{ flex: 1 }} disabled={!text.trim()} onPress={() => go(text)} />
        {Platform.OS === 'web' && <Button small variant="secondary" icon="document" title="From file" style={{ flex: 1 }} onPress={file} />}
      </View>
    </View>
  );
}
export { SettingsPage, getLibrary };

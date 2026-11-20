import React, { useMemo, useReducer, useState } from 'react';
import { ScrollView, useColorScheme, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert } from '../src/lib/alert';
import { Button, Chip, IconButton, Pressy, Text } from '../src/components/ui';
import { MiniPhone, DEVICES, type DeviceId } from '../src/custom/MiniPhone';
import { DisplaySection, NavSection, ThemeSection, WidgetsSection } from '../src/custom/sections';
import { DEFAULTS, sanitize, type Settings } from '../src/custom/schema';
import { createProfile, setSettings, useSettings } from '../src/custom/store';
import { colors, font, runtime, shadow } from '../src/theme';
import { themed } from '../src/custom/themed';
import { Group2, SegmentRow, SwitchRow } from '../src/custom/controls';

type Tab = 'theme' | 'home' | 'nav' | 'display';
interface St { draft: Settings; past: Settings[]; future: Settings[] }
type Act = { t: 'edit'; fn: (d: Settings) => void } | { t: 'undo' } | { t: 'redo' } | { t: 'set'; s: Settings } | { t: 'section'; tab: Tab };
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const SECTION_KEYS: Record<Tab, (keyof Settings)[]> = { theme: ['theme'], home: ['home'], nav: ['nav'], display: ['display', 'a11y'] };

function reducer(s: St, a: Act): St {
  switch (a.t) {
    case 'edit': { const next = clone(s.draft); a.fn(next); const clean = sanitize(next); if (JSON.stringify(clean) === JSON.stringify(s.draft)) return s; return { draft: clean, past: [...s.past.slice(-49), s.draft], future: [] }; }
    case 'undo': { if (!s.past.length) return s; const prev = s.past[s.past.length - 1]; return { draft: prev, past: s.past.slice(0, -1), future: [s.draft, ...s.future] }; }
    case 'redo': { if (!s.future.length) return s; const [n, ...rest] = s.future; return { draft: n, past: [...s.past, s.draft], future: rest }; }
    case 'set': return { draft: sanitize(a.s), past: [...s.past.slice(-49), s.draft], future: [] };
    case 'section': { const d = DEFAULTS(); const next = clone(s.draft); for (const k of SECTION_KEYS[a.tab]) (next as any)[k] = (d as any)[k]; return { draft: sanitize(next), past: [...s.past.slice(-49), s.draft], future: [] }; }
  }
}

/** The live design editor: edit a DRAFT with instant preview, undo/redo and per-section reset; nothing changes in the app until SAVE MY DESIGN. */
function Editor() {
  const router = useRouter(); const { tab: t0 } = useLocalSearchParams<{ tab?: Tab }>();
  const live = useSettings(); const sys = useColorScheme() === 'dark';
  const [st, dispatch] = useReducer(reducer, { draft: live, past: [], future: [] });
  const [tab, setTab] = useState<Tab>((['theme', 'home', 'nav', 'display'] as Tab[]).includes(t0 as Tab) ? (t0 as Tab) : 'theme');
  const [device, setDevice] = useState<DeviceId>('phone');
  const dirty = useMemo(() => JSON.stringify(st.draft) !== JSON.stringify(live), [st.draft, live]);
  const update = (fn: (d: Settings) => void) => dispatch({ t: 'edit', fn });
  const save = () => { setSettings(st.draft); Alert.alert('Design saved', 'Your design is now live across the app.'); router.back(); };
  const previewW = device === 'tablet' ? 190 : device === 'small' ? 118 : device === 'large' ? 140 : 130;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[{ flexDirection: 'row', gap: 12, padding: 14, backgroundColor: colors.surface }, shadow.soft]}>
        <MiniPhone s={st.draft} systemDark={sys} device={device} width={previewW} />
        <View style={{ flex: 1, gap: 8 }}>
          <Text style={font.label}>Preview size</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{(Object.keys(DEVICES) as DeviceId[]).map((d) => <Chip key={d} label={DEVICES[d].label} active={device === d} onPress={() => setDevice(d)} />)}</View>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <IconButton icon="arrow-undo" label="Undo" size={40} onPress={() => dispatch({ t: 'undo' })} style={{ opacity: st.past.length ? 1 : 0.4 }} />
            <IconButton icon="arrow-redo" label="Redo" size={40} onPress={() => dispatch({ t: 'redo' })} style={{ opacity: st.future.length ? 1 : 0.4 }} />
            <Text style={font.small}>{st.past.length} change{st.past.length === 1 ? '' : 's'}</Text>
          </View>
          <Button small variant="secondary" icon="refresh" title="Reset this section" onPress={() => dispatch({ t: 'section', tab })} />
          <Button small variant="secondary" icon="trash-bin" title="Restore all defaults" onPress={() => Alert.alert('Restore all defaults?', 'Resets theme, home, navigation and display in this editor. You can still undo, and nothing is saved until you press Save.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Restore', style: 'destructive', onPress: () => dispatch({ t: 'set', s: DEFAULTS() }) }])} />
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, paddingVertical: 10, paddingHorizontal: 14 }}>
        {([['theme', 'Colours', 'color-palette'], ['home', 'Home', 'home'], ['nav', 'Navigation', 'navigate'], ['display', 'Display', 'text']] as [Tab, string, string][]).map(([id, l, ic]) => <Chip key={id} label={l} icon={ic as any} active={tab === id} onPress={() => setTab(id)} />)}
      </ScrollView>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 150 }} keyboardShouldPersistTaps="handled">
        {tab === 'theme' && <ThemeSection s={st.draft} update={update} />}
        {tab === 'home' && <WidgetsSection s={st.draft} update={update} />}
        {tab === 'nav' && <NavSection s={st.draft} update={update} />}
        {tab === 'display' && (<><DisplaySection s={st.draft} update={update} />
          <Group2 title="Accessibility"><SwitchRow icon="contrast" title="High contrast" value={st.draft.a11y.highContrast} onChange={(v) => update((d) => { d.a11y.highContrast = v; })} /><SwitchRow icon="hand-left" title="Larger touch targets" value={st.draft.a11y.largeTargets} onChange={(v) => update((d) => { d.a11y.largeTargets = v; })} /></Group2></>)}
      </ScrollView>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 14, paddingBottom: 22, backgroundColor: colors.surface, flexDirection: 'row', gap: 10, ...shadow.float }}>
        <Button variant="secondary" title="Discard" style={{ flex: 1 }} onPress={() => (dirty ? Alert.alert('Discard your changes?', undefined, [{ text: 'Keep editing', style: 'cancel' }, { text: 'Discard', style: 'destructive', onPress: () => router.back() }]) : router.back())} />
        <Button variant="secondary" icon="person-add" title="As new profile" style={{ flex: 1 }} disabled={!dirty} onPress={() => { createProfile('My design', 'color-palette', st.draft); Alert.alert('New profile created', 'Your design was saved as a new profile and is now active.'); router.back(); }} />
        <Button icon="checkmark-circle" title="SAVE MY DESIGN" style={{ flex: 1.6 }} disabled={!dirty} onPress={save} />
      </View>
    </View>
  );
}
void SegmentRow; void Pressy; void runtime;
export default themed(Editor);

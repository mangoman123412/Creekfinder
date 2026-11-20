import React, { useState } from 'react';
import { ScrollView, TextInput, useColorScheme, View } from 'react-native';
import { Ionicons } from './Icon';
import { Alert } from '../lib/alert';
import { Banner, Button, Chip, Pressy, Text } from '../components/ui';
import { TextPrompt } from '../components/TextPrompt';
import { ColorRow, DragList, Group2, IconGrid, MoveButtons, SegmentRow, SliderRow, SwitchRow } from './controls';
import { DEFAULTS, FONT_OPTIONS, NAV_META, SEED_KEYS, SEED_LABELS, SHORTCUT_OPTIONS, THEME_PRESETS, WIDGET_META, WIDGET_TYPES, type Settings, type WidgetBg, type WidgetInstance, type WidgetSize, type WidgetType } from './schema';
import { resolveSeeds } from './themeEngine';
import { arrayMove } from './arrays';
import { colors, font, radius, shadow } from '../theme';
import { deleteTheme, saveTheme, useLibrary } from './store';
import { listPlaces } from '../db/local';
import { useDbQuery } from '../state/hooks';

/** Every section edits a Settings object through `update(fn)`. The settings pages bind it to the live store; the editor binds it to a draft. */
export interface SecProps { s: Settings; update: (fn: (d: Settings) => void) => void }

// ------------------------------------------------------------------ theme
export function ThemeSection({ s, update }: SecProps) {
  const sys = useColorScheme() === 'dark';
  const lib = useLibrary();
  const [naming, setNaming] = useState(false);
  const { seeds } = resolveSeeds(s.theme, sys);
  const touched = Object.keys(s.theme.overrides).length;
  const preset = THEME_PRESETS.find((p) => p.id === s.theme.presetId);
  return (
    <View>
      <Group2 title="Mode"><SegmentRow options={[{ id: 'system', label: 'Automatic', icon: 'phone-portrait' }, { id: 'light', label: 'Light', icon: 'sunny' }, { id: 'dark', label: 'Dark', icon: 'moon' }]} value={s.theme.mode} onChange={(m) => update((d) => { d.theme.mode = m; })} />
        {preset?.forceDark ? <Text style={[font.small, { padding: 16, paddingTop: 0 }]}>Midnight is always dark.</Text> : null}</Group2>
      <Text style={[font.label, { marginTop: 22, marginBottom: 8, marginLeft: 4 }]}>Theme</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {THEME_PRESETS.map((p) => { const sd = (p.forceDark || s.theme.mode === 'dark' || (s.theme.mode === 'system' && sys)) ? p.dark : p.light; const on = s.theme.presetId === p.id;
          return (
            <Pressy key={p.id} onPress={() => update((d) => { d.theme.presetId = p.id; if (p.id !== 'custom') d.theme.overrides = {}; })} accessibilityLabel={`${p.name} theme`} scale={0.97} style={{ width: '48%', flexGrow: 1 }}>
              <View style={[{ borderRadius: radius.md, overflow: 'hidden', backgroundColor: sd.card, borderWidth: on ? 3 : 1, borderColor: on ? colors.primary : colors.line }, shadow.soft]}>
                <View style={{ height: 46, backgroundColor: sd.background, flexDirection: 'row', alignItems: 'center', padding: 8, gap: 6 }}>{[sd.primary, sd.secondary, sd.accent, sd.card].map((c, i) => <View key={i} style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: c, borderWidth: 1, borderColor: 'rgba(127,127,127,0.3)' }} />)}</View>
                <View style={{ padding: 9, flexDirection: 'row', alignItems: 'center', gap: 6 }}><Text style={{ fontWeight: '800', fontSize: 13, color: sd.text, flex: 1 }} numberOfLines={1}>{p.name}</Text>{on && <Ionicons name="checkmark-circle" size={16} color={sd.primary} />}</View>
              </View>
            </Pressy>); })}
      </View>
      <Group2 title="Customize colours" footer={touched ? `${touched} colour${touched > 1 ? 's' : ''} customised on top of ${preset?.name}.` : 'Tap any colour to change it. Pick with sliders, swatches or type a HEX code.'}>
        {SEED_KEYS.map((k) => <ColorRow key={k} label={SEED_LABELS[k]} value={seeds[k]} overridden={!!s.theme.overrides[k]} onChange={(hex) => update((d) => { d.theme.overrides[k] = hex; })} onClear={() => update((d) => { delete d.theme.overrides[k]; })} />)}
      </Group2>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
        <Button small variant="secondary" icon="refresh" title="Reset colours" style={{ flex: 1 }} onPress={() => update((d) => { d.theme.overrides = {}; })} disabled={!touched} />
        <Button small icon="bookmark" title="Save as my theme" style={{ flex: 1 }} onPress={() => setNaming(true)} />
      </View>
      {lib.themes.length > 0 && (
        <Group2 title="My saved themes">
          {lib.themes.map((t) => { const sd = resolveSeeds(t.spec, sys).seeds; return (
            <View key={t.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 }}>
              <View style={{ flexDirection: 'row' }}>{[sd.primary, sd.secondary, sd.background].map((c, i) => <View key={i} style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: c, marginLeft: i ? -6 : 0, borderWidth: 1.5, borderColor: colors.surface }} />)}</View>
              <Text style={{ flex: 1, fontWeight: '700' }} numberOfLines={1}>{t.name}</Text>
              <Button small title="Apply" variant="secondary" onPress={() => update((d) => { d.theme = JSON.parse(JSON.stringify(t.spec)); })} />
              <Pressy onPress={() => deleteTheme(t.id)} accessibilityLabel={`Delete theme ${t.name}`} hitSlop={8}><Ionicons name="trash" size={19} color={colors.danger} /></Pressy>
            </View>); })}
        </Group2>)}
      <TextPrompt visible={naming} title="Name your theme" placeholder="e.g. Sunrise canyon" onCancel={() => setNaming(false)} onSubmit={(n) => { saveTheme(n, s.theme); setNaming(false); }} />
    </View>
  );
}

// ------------------------------------------------------------------ home widgets
const BGS: [WidgetBg, string][] = [['default', 'Card'], ['tint', 'Tint'], ['primary', 'Color'], ['dark', 'Dark'], ['glass', 'Glass'], ['none', 'None'], ['custom', 'Custom']];
export function WidgetsSection({ s, update }: SecProps) {
  const places = useDbQuery(() => listPlaces(), [], []);
  const [sel, setSel] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const ws = s.home.widgets;
  const cur = ws.find((w) => w.id === sel);
  const setW = (id: string, fn: (w: WidgetInstance) => void) => update((d) => { const w = d.home.widgets.find((x) => x.id === id); if (w) fn(w); });
  const remove = (w: WidgetInstance) => update((d) => { const same = d.home.widgets.filter((x) => x.type === w.type).length; if (same > 1) d.home.widgets = d.home.widgets.filter((x) => x.id !== w.id); else { const x = d.home.widgets.find((y) => y.id === w.id); if (x) x.visible = false; } });
  const add = (t: WidgetType) => update((d) => { const hidden = d.home.widgets.find((x) => x.type === t && !x.visible); if (hidden) { hidden.visible = true; d.home.widgets = [hidden, ...d.home.widgets.filter((x) => x !== hidden)]; return; } const meta = WIDGET_META[t]; d.home.widgets.unshift({ id: `${t}-${Date.now().toString(36)}`, type: t, size: meta.sizes[Math.min(1, meta.sizes.length - 1)], bg: 'default', visible: true, shortcuts: t === 'shortcuts' ? ['map', 'track'] : undefined }); });
  return (
    <View>
      <Text style={[font.small, { marginBottom: 8 }]}>Drag the handle (or use the arrows) to reorder. Switch widgets on or off. Tap a row to resize it or change its background.</Text>
      <DragList data={ws} onReorder={(next) => update((d) => { d.home.widgets = next; })} renderRow={(w, i, handle, move) => (
        <Pressy onPress={() => setSel(sel === w.id ? null : w.id)} scale={0.99} accessibilityLabel={`${WIDGET_META[w.type].title}, ${w.visible ? 'shown' : 'hidden'}, ${w.size}`} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: w.visible ? colors.waterTint : colors.surface2, alignItems: 'center', justifyContent: 'center' }}><Ionicons name={WIDGET_META[w.type].icon as any} size={17} color={w.visible ? colors.water : colors.faint} /></View>
          <View style={{ flex: 1, opacity: w.visible ? 1 : 0.5 }}><Text style={{ fontWeight: '700', fontSize: 14 }} numberOfLines={1}>{WIDGET_META[w.type].title}</Text><Text style={{ fontSize: 11.5, color: colors.muted }}>{w.size} · {w.bg === 'default' ? 'card' : w.bg}</Text></View>
          <MoveButtons index={i} count={ws.length} move={move} />
          <Pressy onPress={() => setW(w.id, (x) => { x.visible = !x.visible; })} accessibilityLabel={`${w.visible ? 'Hide' : 'Show'} ${WIDGET_META[w.type].title}`} hitSlop={6}><Ionicons name={w.visible ? 'eye' : 'eye-off'} size={22} color={w.visible ? colors.primary : colors.faint} /></Pressy>
          {handle}
        </Pressy>)} />
      {cur && (
        <Group2 title={`Edit: ${WIDGET_META[cur.type].title}`}>
          <SegmentRow title="Size" options={WIDGET_META[cur.type].sizes.map((z) => ({ id: z, label: z[0].toUpperCase() + z.slice(1) }))} value={cur.size} onChange={(z: WidgetSize) => setW(cur.id, (x) => { x.size = z; })} />
          <View style={{ padding: 16 }}>
            <Text style={[font.body, { fontWeight: '600' }]}>Style / background</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>{BGS.map(([id, label]) => <Chip key={id} label={label} active={cur.bg === id} onPress={() => setW(cur.id, (x) => { x.bg = id; if (id === 'custom' && !x.customBg) x.customBg = '#E8F1EC'; })} />)}</View>
          </View>
          {cur.bg === 'custom' && <ColorRow label="Background colour" value={cur.customBg ?? '#E8F1EC'} onChange={(hex) => setW(cur.id, (x) => { x.customBg = hex; })} />}
          {cur.type === 'shortcuts' && (
            <View style={{ padding: 16 }}>
              <Text style={[font.body, { fontWeight: '600' }]}>Shortcuts ({(cur.shortcuts ?? []).length}/8)</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
                {SHORTCUT_OPTIONS.map((o) => { const on = (cur.shortcuts ?? []).includes(o.id); return <Chip key={o.id} label={o.label} icon={o.icon as any} active={on} onPress={() => setW(cur.id, (x) => { const l = x.shortcuts ?? []; x.shortcuts = on ? l.filter((i) => i !== o.id) : l.length < 8 ? [...l, o.id] : l; })} />; })}
                {places.data.slice(0, 12).map((p) => { const id = `place:${p.id}`; const on = (cur.shortcuts ?? []).includes(id); return <Chip key={id} label={p.name} icon="water" active={on} onPress={() => setW(cur.id, (x) => { const l = x.shortcuts ?? []; x.shortcuts = on ? l.filter((i) => i !== id) : l.length < 8 ? [...l, id] : l; })} />; })}
              </View>
            </View>)}
          <View style={{ padding: 16, flexDirection: 'row', gap: 10 }}><Button small variant="secondary" icon="eye-off" title={cur.visible ? 'Hide' : 'Show'} style={{ flex: 1 }} onPress={() => setW(cur.id, (x) => { x.visible = !x.visible; })} /><Button small variant="danger" icon="trash" title="Remove" style={{ flex: 1 }} onPress={() => { remove(cur); setSel(null); }} /></View>
        </Group2>)}
      <View style={{ marginTop: 14, gap: 10 }}>
        <Button icon="add-circle" title={adding ? 'Close widget list' : 'Add a widget'} onPress={() => setAdding(!adding)} />
        {adding && (
          <View style={[{ backgroundColor: colors.surface, borderRadius: radius.md, overflow: 'hidden' }, shadow.soft]}>
            {WIDGET_TYPES.map((t, i) => (
              <Pressy key={t} onPress={() => add(t)} scale={0.99} accessibilityLabel={`Add ${WIDGET_META[t].title}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderTopWidth: i ? 1 : 0, borderColor: colors.line }}>
                <Ionicons name={WIDGET_META[t].icon as any} size={22} color={colors.primary} /><View style={{ flex: 1 }}><Text style={{ fontWeight: '700' }}>{WIDGET_META[t].title}</Text><Text style={font.small}>{WIDGET_META[t].blurb}</Text></View><Ionicons name="add" size={22} color={colors.primary} />
              </Pressy>))}
          </View>)}
        <Button variant="secondary" icon="refresh" title="Restore default layout" onPress={() => Alert.alert('Restore the default Home layout?', 'Your widgets return to the original order, sizes and styles.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Restore', style: 'destructive', onPress: () => update((d) => { d.home = DEFAULTS().home; }) }])} />
      </View>
    </View>
  );
}

// ------------------------------------------------------------------ navigation
const NAV_ICON_STYLES = [{ id: 'auto', label: 'Auto' }, { id: 'outline', label: 'Outline' }, { id: 'filled', label: 'Filled' }] as const;
export function NavSection({ s, update }: SecProps) {
  const [sel, setSel] = useState<string | null>(null);
  const items = s.nav.items.map((i) => ({ ...i, id: i.id as string }));
  const cur = s.nav.items.find((i) => i.id === sel);
  const visibleCount = s.nav.items.filter((i) => i.visible).length;
  return (
    <View>
      <Group2 title="Style"><SegmentRow options={[{ id: 'floating', label: 'Floating' }, { id: 'bottom', label: 'Bottom bar' }, { id: 'compact', label: 'Compact' }, { id: 'expanded', label: 'Expanded' }]} value={s.nav.style} onChange={(v) => update((d) => { d.nav.style = v; })} />
        <SegmentRow title="Labels" options={[{ id: 'auto', label: 'Auto' }, { id: 'always', label: 'Always' }, { id: 'never', label: 'Never' }]} value={s.nav.labels} onChange={(v) => update((d) => { d.nav.labels = v; })} />
        <SegmentRow title="Icon style" options={NAV_ICON_STYLES.map((x) => ({ id: x.id, label: x.label }))} value={s.nav.iconStyle} onChange={(v) => update((d) => { d.nav.iconStyle = v; })} /></Group2>
      <Text style={[font.label, { marginTop: 22, marginBottom: 8, marginLeft: 4 }]}>Tabs — reorder, show or hide</Text>
      <DragList data={items} onReorder={(next) => update((d) => { d.nav.items = next as any; })} renderRow={(it, i, handle, move) => { const m = NAV_META[it.id as keyof typeof NAV_META]; return (
        <Pressy onPress={() => setSel(sel === it.id ? null : it.id)} scale={0.99} accessibilityLabel={`${it.label || m.label} tab, ${it.visible ? 'shown' : 'hidden'}`} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: it.visible ? colors.primary : colors.surface2, alignItems: 'center', justifyContent: 'center' }}><Ionicons name={(it.icon ?? m.icon) as any} size={18} color={it.visible ? colors.onPrimary : colors.faint} /></View>
          <View style={{ flex: 1, opacity: it.visible ? 1 : 0.5 }}><Text style={{ fontWeight: '700' }} numberOfLines={1}>{it.label || m.label}</Text><Text style={{ fontSize: 11.5, color: colors.muted }}>{m.essential ? 'Always shown (settings access)' : it.visible ? 'Shown' : 'Hidden'}</Text></View>
          <MoveButtons index={i} count={items.length} move={move} />
          <Pressy disabled={!!m.essential} onPress={() => { if (it.visible && visibleCount <= 3) { Alert.alert('Keep at least 3 tabs', 'Navigation needs at least three tabs so you can always get around.'); return; } update((d) => { const x = d.nav.items.find((y) => y.id === it.id); if (x) x.visible = !x.visible; }); }} accessibilityLabel={`${it.visible ? 'Hide' : 'Show'} ${m.label}`} hitSlop={6}><Ionicons name={it.visible ? 'eye' : 'eye-off'} size={22} color={m.essential ? colors.surface3 : it.visible ? colors.primary : colors.faint} /></Pressy>
          {handle}
        </Pressy>); }} />
      {cur && (
        <Group2 title={`Edit tab: ${NAV_META[cur.id].label}`}>
          <View style={{ padding: 16 }}>
            <Text style={[font.body, { fontWeight: '600' }]}>Label</Text>
            <TextInput value={cur.label ?? ''} maxLength={14} placeholder={NAV_META[cur.id].label} placeholderTextColor={colors.faint} onChangeText={(t) => update((d) => { const x = d.nav.items.find((y) => y.id === cur.id); if (x) x.label = t || undefined; })} accessibilityLabel="Tab label" style={{ backgroundColor: colors.surface2, borderRadius: 12, padding: 12, fontSize: 16, color: colors.ink, marginTop: 8 }} />
          </View>
          <Text style={[font.body, { fontWeight: '600', paddingHorizontal: 16 }]}>Icon</Text>
          <IconGrid icons={NAV_META[cur.id].icons} value={cur.icon ?? NAV_META[cur.id].icon} onChange={(ic) => update((d) => { const x = d.nav.items.find((y) => y.id === cur.id); if (x) x.icon = ic; })} />
          <View style={{ padding: 16 }}><Button small variant="secondary" icon="refresh" title="Reset this tab" onPress={() => update((d) => { const x = d.nav.items.find((y) => y.id === cur.id); if (x) { x.label = undefined; x.icon = undefined; } })} /></View>
        </Group2>)}
      <View style={{ marginTop: 14 }}><Button variant="secondary" icon="refresh" title="Reset navigation" onPress={() => update((d) => { d.nav = DEFAULTS().nav; })} /></View>
    </View>
  );
}

// ------------------------------------------------------------------ fonts & display
export function DisplaySection({ s, update }: SecProps) {
  const dd = s.display;
  return (
    <View>
      <Group2 title="Text">
        <SliderRow title="Text size" subtitle="Applies to every screen" value={dd.textScale} min={0.8} max={1.6} step={0.05} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => update((d) => { d.display.textScale = v; })} />
        <SwitchRow icon="text" title="Bold text" subtitle="Heavier font weight everywhere" value={dd.boldText} onChange={(v) => update((d) => { d.display.boldText = v; })} />
        <View style={{ padding: 16 }}>
          <Text style={[font.body, { fontWeight: '600' }]}>Font style</Text>
          {FONT_OPTIONS.map((f) => (
            <Pressy key={f.id} onPress={() => update((d) => { d.display.font = f.id; })} scale={0.99} accessibilityLabel={f.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 }}>
              <Ionicons name={dd.font === f.id ? 'radio-button-on' : 'radio-button-off'} size={22} color={dd.font === f.id ? colors.primary : colors.faint} /><Text style={{ flex: 1, fontWeight: '600' }}>{f.label}</Text>
            </Pressy>))}
        </View>
      </Group2>
      <Group2 title="Controls & icons">
        <SegmentRow title="Button size" options={[{ id: 'small', label: 'Small' }, { id: 'medium', label: 'Medium' }, { id: 'large', label: 'Large' }]} value={dd.buttonSize} onChange={(v) => update((d) => { d.display.buttonSize = v; })} />
        <SegmentRow title="Icon size" options={[{ id: 'small', label: 'Small' }, { id: 'medium', label: 'Medium' }, { id: 'large', label: 'Large' }]} value={dd.iconSize} onChange={(v) => update((d) => { d.display.iconSize = v; })} />
      </Group2>
      <Group2 title="Cards & layout">
        <SegmentRow title="Card appearance" options={[{ id: 'elevated', label: 'Shadow' }, { id: 'flat', label: 'Flat' }, { id: 'outlined', label: 'Outline' }, { id: 'glass', label: 'Glass' }]} value={dd.cardStyle} onChange={(v) => update((d) => { d.display.cardStyle = v; })} />
        <SegmentRow title="Corner roundness" options={[{ id: 'sharp', label: 'Sharp' }, { id: 'soft', label: 'Soft' }, { id: 'round', label: 'Round' }]} value={dd.corners} onChange={(v) => update((d) => { d.display.corners = v; })} />
        <SegmentRow title="Spacing / density" options={[{ id: 'compact', label: 'Compact' }, { id: 'comfortable', label: 'Comfortable' }, { id: 'spacious', label: 'Spacious' }]} value={dd.density} onChange={(v) => update((d) => { d.display.density = v; })} />
        <SegmentRow title="Animation intensity" subtitle="Off removes all motion" options={[{ id: 'off', label: 'Off' }, { id: 'subtle', label: 'Subtle' }, { id: 'normal', label: 'Normal' }, { id: 'lively', label: 'Lively' }]} value={dd.motion} onChange={(v) => update((d) => { d.display.motion = v; })} />
      </Group2>
      <View style={{ marginTop: 14 }}><Button variant="secondary" icon="refresh" title="Reset fonts & display" onPress={() => update((d) => { d.display = DEFAULTS().display; })} /></View>
    </View>
  );
}
void ScrollView; void arrayMove; void Banner;

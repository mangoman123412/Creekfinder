import React, { useCallback, useEffect, useRef, useState } from 'react';
import { PanResponder, Platform, ScrollView, Switch, TextInput, View, type LayoutChangeEvent } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Ionicons } from './Icon';
import { Alert } from '../lib/alert';
import { Button, Pressy, Text, type IconName } from '../components/ui';
import { colors, font, radius, runtime, shadow, space } from '../theme';
import { HEX_RE, hsvToHex, normHex, onColor, rgbToHsv, toRgb } from './colorUtils';
import { arrayMove } from './arrays';

/** Settings page scaffold: scrollable, padded, with an optional "reset this section" footer. */
export function SettingsPage({ children, onReset, resetLabel = 'Reset this section' }: { children: React.ReactNode; onReset?: () => void; resetLabel?: string }) {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 18 * runtime.density, paddingBottom: 110 }} keyboardShouldPersistTaps="handled">
      {children}
      {onReset && (
        <View style={{ marginTop: 28 }}>
          <Button variant="secondary" icon="refresh" title={resetLabel} onPress={() => Alert.alert(resetLabel + '?', 'Your other settings stay as they are.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Reset', style: 'destructive', onPress: onReset }])} />
        </View>
      )}
    </ScrollView>
  );
}

export function Group2({ title, footer, children }: { title?: string; footer?: string; children: React.ReactNode }) {
  const kids = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={{ marginTop: 22 }}>
      {title ? <Text style={[font.label, { marginBottom: 8, marginLeft: 4 }]}>{title}</Text> : null}
      <View style={[{ backgroundColor: colors.surface, borderRadius: radius.md, overflow: 'hidden' }, shadow.soft]}>
        {kids.map((k, i) => (<View key={i}>{i > 0 && <View style={{ height: 1, backgroundColor: colors.line, marginLeft: 16 }} />}{k}</View>))}
      </View>
      {footer ? <Text style={[font.small, { marginTop: 8, marginHorizontal: 6 }]}>{footer}</Text> : null}
    </View>
  );
}

const rowPad = () => ({ paddingVertical: 12 * runtime.density, paddingHorizontal: 16 });

export function SwitchRow({ icon, title, subtitle, value, onChange, disabled }: { icon?: IconName; title: string; subtitle?: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <Pressy onPress={() => onChange(!value)} disabled={disabled} scale={0.99} accessibilityLabel={`${title}, ${value ? 'on' : 'off'}`} style={[{ flexDirection: 'row', alignItems: 'center', gap: 12, opacity: disabled ? 0.5 : 1 }, rowPad()]}>
      {icon ? <Ionicons name={icon} size={22} color={colors.primary} /> : null}
      <View style={{ flex: 1 }}><Text style={[font.body, { fontWeight: '600' }]}>{title}</Text>{subtitle ? <Text style={font.small}>{subtitle}</Text> : null}</View>
      <Switch value={value} onValueChange={onChange} disabled={disabled} accessibilityLabel={title} trackColor={{ true: colors.primary, false: colors.surface3 }} thumbColor="#fff" />
    </Pressy>
  );
}

export function SegmentRow<T extends string>({ title, subtitle, options, value, onChange }: { title?: string; subtitle?: string; options: { id: T; label: string; icon?: IconName }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={rowPad()}>
      {title ? <Text style={[font.body, { fontWeight: '600' }]}>{title}</Text> : null}
      {subtitle ? <Text style={[font.small, { marginBottom: 6 }]}>{subtitle}</Text> : null}
      <View style={{ flexDirection: 'row', backgroundColor: colors.surface2, borderRadius: radius.pill, padding: 3, marginTop: 6, flexWrap: 'wrap' }}>
        {options.map((o) => (
          <Pressy key={o.id} onPress={() => onChange(o.id)} accessibilityLabel={`${title ?? ''} ${o.label}`} scale={0.96}
            style={{ flexGrow: 1, flexBasis: 0, minWidth: 64, minHeight: 36, paddingHorizontal: 8, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 5, backgroundColor: value === o.id ? colors.primary : 'transparent' }}>
            {o.icon ? <Ionicons name={o.icon} size={15} color={value === o.id ? colors.onPrimary : colors.muted} /> : null}
            <Text style={{ fontWeight: '700', fontSize: 12.5, color: value === o.id ? colors.onPrimary : colors.muted }} numberOfLines={1}>{o.label}</Text>
          </Pressy>
        ))}
      </View>
    </View>
  );
}

export function NavRow({ icon, title, subtitle, onPress, right }: { icon: IconName; title: string; subtitle?: string; onPress: () => void; right?: React.ReactNode }) {
  return (
    <Pressy onPress={onPress} scale={0.99} accessibilityLabel={title} style={[{ flexDirection: 'row', alignItems: 'center', gap: 12 }, rowPad()]}>
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.waterTint, alignItems: 'center', justifyContent: 'center' }}><Ionicons name={icon} size={19} color={colors.water} /></View>
      <View style={{ flex: 1 }}><Text style={[font.body, { fontWeight: '600' }]}>{title}</Text>{subtitle ? <Text style={font.small}>{subtitle}</Text> : null}</View>
      {right ?? <Ionicons name="chevron-forward" size={18} color={colors.faint} />}
    </Pressy>
  );
}

/** Slider that works with touch and mouse (PanResponder) and also supports accessibility +/- buttons. */
export function SliderRow({ title, subtitle, value, min, max, step = 0.05, onChange, format }: { title: string; subtitle?: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; format?: (v: number) => string }) {
  const [w, setW] = useState(0);
  const wRef = useRef(0); wRef.current = w;
  const valRef = useRef({ value, min, max, step, onChange }); valRef.current = { value, min, max, step, onChange };
  const snap = (x: number) => { const { min, max, step } = valRef.current; const t = Math.max(0, Math.min(1, x / Math.max(1, wRef.current))); const v = min + t * (max - min); return Math.round(v / step) * step; };
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true, onMoveShouldSetPanResponder: () => true, onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (e) => valRef.current.onChange(+snap(e.nativeEvent.locationX).toFixed(4)),
    onPanResponderMove: (e) => valRef.current.onChange(+snap(e.nativeEvent.locationX).toFixed(4)),
  })).current;
  const t = (value - min) / (max - min);
  const bump = (d: number) => onChange(+Math.max(min, Math.min(max, value + d * step)).toFixed(4));
  return (
    <View style={rowPad()}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1 }}><Text style={[font.body, { fontWeight: '600' }]}>{title}</Text>{subtitle ? <Text style={font.small}>{subtitle}</Text> : null}</View>
        <Text style={{ fontWeight: '800', color: colors.primary }}>{format ? format(value) : value.toFixed(2)}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }}>
        <Pressy onPress={() => bump(-1)} accessibilityLabel={`Decrease ${title}`}><Ionicons name="remove-circle" size={26} color={colors.faint} /></Pressy>
        <View style={{ flex: 1, height: 34, justifyContent: 'center' }} onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)} {...pan.panHandlers} accessible accessibilityRole="adjustable" accessibilityLabel={title} accessibilityValue={{ min, max, now: value }}>
          <View pointerEvents="none" style={{ height: 6, borderRadius: 3, backgroundColor: colors.surface3 }}>
            <View style={{ width: `${Math.max(0, Math.min(1, t)) * 100}%`, height: 6, borderRadius: 3, backgroundColor: colors.primary }} />
          </View>
          <View pointerEvents="none" style={{ position: 'absolute', left: Math.max(0, Math.min(1, t)) * Math.max(0, w - 22), width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', borderWidth: 3, borderColor: colors.primary, ...shadow.soft }} />
        </View>
        <Pressy onPress={() => bump(1)} accessibilityLabel={`Increase ${title}`}><Ionicons name="add-circle" size={26} color={colors.faint} /></Pressy>
      </View>
    </View>
  );
}

// ------------------------------------------------------------------ colours
const SWATCHES = ['#1F5A43', '#3C9C73', '#6E9A59', '#1B8FD0', '#0B6E99', '#2F6FDB', '#5AA9FF', '#8E44AD', '#B88CF0', '#D9562B', '#FF7A4D', '#D98E1F', '#F2A33A', '#FFC857', '#C8402F', '#7A5C3A', '#C9A27A', '#121C17', '#5B6961', '#F3F1EA', '#FFFFFF', '#000000'];

export function ColorPicker({ value, onChange, label }: { value: string; onChange: (hex: string) => void; label: string }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const [h, s, v] = rgbToHsv(toRgb(value));
  const apply = useCallback((hh: number, ss: number, vv: number) => onChange(hsvToHex(hh, ss, vv)), [onChange]);
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 12 }}>
        <View style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: value, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: onColor(value), fontWeight: '800', fontSize: 12 }}>Aa</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={font.label}>{label} · HEX</Text>
          <TextInput value={text} onChangeText={(t) => { setText(t); if (HEX_RE.test(t.trim())) onChange(normHex(t)); }} autoCapitalize="characters" autoCorrect={false} maxLength={7} accessibilityLabel={`${label} hex colour`}
            style={{ backgroundColor: colors.surface2, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 9, fontSize: 16, color: HEX_RE.test(text.trim()) ? colors.ink : colors.danger, marginTop: 4 }} />
        </View>
      </View>
      <SliderRow title="Hue" min={0} max={359} step={1} value={Math.round(h)} onChange={(x) => apply(x, s || 0.5, v || 0.5)} format={(x) => `${Math.round(x)}°`} />
      <SliderRow title="Saturation" min={0} max={1} step={0.01} value={s} onChange={(x) => apply(h, x, v)} format={(x) => `${Math.round(x * 100)}%`} />
      <SliderRow title="Brightness" min={0} max={1} step={0.01} value={v} onChange={(x) => apply(h, s, x)} format={(x) => `${Math.round(x * 100)}%`} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingBottom: 14 }}>
        {SWATCHES.map((c) => (
          <Pressy key={c} onPress={() => onChange(c)} accessibilityLabel={`Use ${c}`} scale={0.9} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: c, borderWidth: value.toUpperCase() === c ? 3 : 1, borderColor: value.toUpperCase() === c ? colors.ink : colors.line }}><View /></Pressy>
        ))}
      </View>
    </View>
  );
}

/** A row showing a colour; tapping expands the full picker (HSV sliders + HEX input + swatches). */
export function ColorRow({ label, value, onChange, onClear, overridden }: { label: string; value: string; onChange: (hex: string) => void; onClear?: () => void; overridden?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Pressy onPress={() => setOpen((o) => !o)} scale={0.99} accessibilityLabel={`${label} colour ${value}`} style={[{ flexDirection: 'row', alignItems: 'center', gap: 12 }, rowPad()]}>
        <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: value, borderWidth: 2, borderColor: colors.line }} />
        <View style={{ flex: 1 }}><Text style={[font.body, { fontWeight: '600' }]}>{label}</Text><Text style={font.small}>{value}{overridden ? ' · customised' : ''}</Text></View>
        {overridden && onClear ? <Text onPress={onClear} style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }}>Reset</Text> : null}
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.faint} />
      </Pressy>
      {open && <ColorPicker value={value} onChange={onChange} label={label} />}
    </View>
  );
}

// ------------------------------------------------------------------ pickers
export function IconGrid({ icons, value, onChange, color }: { icons: string[]; value?: string; onChange: (i: string) => void; color?: string }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16, paddingVertical: 12 }}>
      {icons.map((i) => (
        <Pressy key={i} onPress={() => onChange(i)} accessibilityLabel={`Icon ${i}`} scale={0.9} style={{ width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: value === i ? (color ?? colors.primary) : colors.surface2 }}>
          <Ionicons name={i as any} size={22} color={value === i ? colors.onPrimary : colors.ink} />
        </Pressy>
      ))}
    </View>
  );
}

// ------------------------------------------------------------------ drag & drop reorder list
const ROW_H = 68;
function DragRow({ index, count, active, over, dragY, onDone, onMove, children }: { index: number; count: number; active: any; over: any; dragY: any; onDone: (from: number, to: number) => void; onMove: (from: number, to: number) => void; children: (handle: React.ReactNode) => React.ReactNode }) {
  const pan = Gesture.Pan().minDistance(2)
    .onStart(() => { 'worklet'; active.value = index; over.value = index; dragY.value = 0; })
    .onUpdate((e) => { 'worklet'; dragY.value = e.translationY; over.value = Math.max(0, Math.min(count - 1, Math.round(index + e.translationY / ROW_H))); })
    .onEnd(() => { 'worklet'; const to = over.value; runOnJS(onDone)(index, to); active.value = -1; dragY.value = 0; })
    .onFinalize(() => { 'worklet'; if (active.value === index) { active.value = -1; dragY.value = 0; } });
  const st = useAnimatedStyle(() => {
    const a = active.value, o = over.value; let y = 0;
    if (a === index) y = dragY.value; else if (a >= 0) { if (a < index && index <= o) y = -ROW_H; else if (o <= index && index < a) y = ROW_H; }
    return { transform: [{ translateY: a === index ? y : withTiming(y, { duration: 140 }) }, { scale: a === index ? 1.02 : 1 }], zIndex: a === index ? 10 : 0, shadowOpacity: a === index ? 0.25 : 0 };
  });
  const handle = (
    <GestureDetector gesture={pan}>
      <View accessibilityLabel="Drag to reorder" accessibilityRole="adjustable" style={{ width: 40, height: 44, alignItems: 'center', justifyContent: 'center', ...(Platform.OS === 'web' ? { cursor: 'grab', touchAction: 'none' } as any : {}) }}>
        <Ionicons name="reorder-three" size={26} color={colors.faint} />
      </View>
    </GestureDetector>
  );
  return (
    <Animated.View style={[{ height: ROW_H, backgroundColor: colors.surface, shadowColor: '#000', shadowRadius: 12, shadowOffset: { width: 0, height: 6 } }, st]}>
      {children(handle)}
      <View style={{ position: 'absolute', right: 50, top: 0, bottom: 0, justifyContent: 'center', display: 'none' }} />
    </Animated.View>
  );
}

/** Drag-and-drop reorderable list (drag the handle) with accessible up/down alternatives via `moveButtons`. */
export function DragList<T extends { id: string }>({ data, onReorder, renderRow }: { data: T[]; onReorder: (next: T[]) => void; renderRow: (item: T, index: number, handle: React.ReactNode, move: (dir: -1 | 1) => void) => React.ReactNode }) {
  const active = useSharedValue(-1), over = useSharedValue(-1), dragY = useSharedValue(0);
  const done = useCallback((from: number, to: number) => { if (from !== to) onReorder(arrayMove(data, from, to)); }, [data, onReorder]);
  return (
    <View style={[{ backgroundColor: colors.surface, borderRadius: radius.md, overflow: 'hidden', height: data.length * ROW_H }, shadow.soft]}>
      {data.map((item, i) => (
        <DragRow key={item.id} index={i} count={data.length} active={active} over={over} dragY={dragY} onDone={done} onMove={done}>
          {(handle) => (
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', borderTopWidth: i ? 1 : 0, borderColor: colors.line, paddingLeft: 12 }}>
              {renderRow(item, i, handle, (dir) => done(i, i + dir))}
            </View>
          )}
        </DragRow>
      ))}
    </View>
  );
}
export const MoveButtons = ({ index, count, move }: { index: number; count: number; move: (d: -1 | 1) => void }) => (
  <View style={{ flexDirection: 'column' }}>
    <Pressy disabled={index === 0} onPress={() => move(-1)} accessibilityLabel="Move up" hitSlop={6} style={{ width: 38, height: 30, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="chevron-up" size={20} color={index === 0 ? colors.surface3 : colors.muted} /></Pressy>
    <Pressy disabled={index === count - 1} onPress={() => move(1)} accessibilityLabel="Move down" hitSlop={6} style={{ width: 38, height: 30, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="chevron-down" size={20} color={index === count - 1 ? colors.surface3 : colors.muted} /></Pressy>
  </View>
);

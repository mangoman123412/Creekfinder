import React, { useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text as RNText, TextInput, View, type StyleProp, type TextInputProps, type TextProps, type TextStyle, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { Ionicons } from '../custom/Icon';
import * as Haptics from 'expo-haptics';
import { FONT, cardExtra, colors, font, radius, runtime, shadow, space } from '../theme';
import { pressScale } from '../custom/motion';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

/** App text: honours the user's font family, text size and bold-text settings. */
export function Text({ style, ...p }: TextProps) {
  const flat = (StyleSheet.flatten(style) ?? {}) as TextStyle;
  let w = String(flat.fontWeight ?? '400');
  if (runtime.bold) w = w === '400' ? '600' : w === '500' || w === '600' ? '700' : w;
  const family = w === '800' || w === '900' ? FONT.black : w === '700' || w === 'bold' ? FONT.bold : w === '600' || w === '500' ? FONT.semi : FONT.regular;
  const k = runtime.textScale;
  const size = (flat.fontSize ?? 14) * k;
  return <RNText {...p} style={[{ fontFamily: family, color: colors.ink }, style, { fontWeight: undefined, fontSize: size, lineHeight: flat.lineHeight ? flat.lineHeight * k : undefined }]} />;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Pressable with a springy press-in scale. */
export function Pressy({ children, onPress, style, scale = 0.96, disabled, accessibilityLabel, hitSlop, onLongPress }: {
  children: React.ReactNode; onPress?: () => void; onLongPress?: () => void; style?: StyleProp<ViewStyle>; scale?: number; disabled?: boolean; accessibilityLabel?: string; hitSlop?: number;
}) {
  const s = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <AnimatedPressable
      accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityHint={runtime.screenReader && accessibilityLabel ? `Double tap to ${accessibilityLabel.toLowerCase()}` : undefined} disabled={disabled} hitSlop={runtime.largeTargets ? Math.max(hitSlop ?? 0, 12) : hitSlop}
      onPressIn={() => { s.value = withSpring(pressScale(scale), { damping: 18, stiffness: 400 }); }}
      onPressOut={() => { s.value = withSpring(1, { damping: 14, stiffness: 300 }); }}
      onPress={onPress} onLongPress={onLongPress} style={[a, style]}
    >{children}</AnimatedPressable>
  );
}

export function Button({ title, onPress, icon, variant = 'primary', loading, disabled, style, small }: {
  title: string; onPress: () => void; icon?: IconName; variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'water' | 'glass'; loading?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle>; small?: boolean;
}) {
  const bg = { primary: colors.button, secondary: colors.surface2, danger: colors.danger, ghost: 'transparent', water: colors.water, glass: colors.overlay }[variant];
  const fg = variant === 'secondary' || variant === 'glass' ? colors.ink : variant === 'ghost' ? colors.primary : variant === 'primary' ? colors.onButton : '#FFFFFF';
  return (
    <Pressy
      disabled={disabled || loading} accessibilityLabel={title}
      onPress={() => { void Haptics.selectionAsync().catch(() => {}); onPress(); }}
      style={[{ flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', paddingVertical: (small ? 10 : 15) * runtime.buttonH, paddingHorizontal: small ? 16 : 22, borderRadius: radius.pill, minHeight: (small ? 42 : 54) * runtime.buttonH, backgroundColor: bg, opacity: disabled ? 0.45 : 1 },
        variant === 'primary' && shadow.soft, style]}
    >
      {loading ? <ActivityIndicator color={fg} /> : (<>
        {icon && <Ionicons name={icon} size={small ? 18 : 21} color={fg} />}
        <Text style={{ color: fg, fontSize: small ? 14.5 : 16.5, fontWeight: '700' }}>{title}</Text>
      </>)}
    </Pressy>
  );
}

/** Round glass icon button for map overlays / headers. */
export function IconButton({ icon, onPress, label, size = 44, active, badge, style }: { icon: IconName; onPress: () => void; label: string; size?: number; active?: boolean; badge?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressy onPress={onPress} accessibilityLabel={label} style={[{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? colors.primary : colors.overlay }, shadow.soft, style]}>
      <Ionicons name={icon} size={size * 0.5} color={active ? '#fff' : colors.ink} />
      {badge && <View style={{ position: 'absolute', top: size * 0.2, right: size * 0.22, width: 10, height: 10, borderRadius: 5, backgroundColor: colors.danger, borderWidth: 2, borderColor: colors.surface }} />}
    </Pressy>
  );
}

export function Card({ children, style, flat }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; flat?: boolean }) {
  return <View style={[{ backgroundColor: colors.surface, borderRadius: radius.md, padding: space.lg }, !flat && shadow.soft, cardExtra(), style]}>{children}</View>;
}

export function Chip({ label, active, onPress, icon }: { label: string; active?: boolean; onPress?: () => void; icon?: IconName }) {
  return (
    <Pressy onPress={onPress} scale={0.94} accessibilityLabel={label}
      style={{ flexDirection: 'row', gap: 6, alignItems: 'center', paddingHorizontal: 15, height: 38, borderRadius: radius.pill, backgroundColor: active ? colors.primary : colors.surface, marginRight: 8, ...(active ? {} : shadow.soft) }}>
      {icon && <Ionicons name={icon} size={15} color={active ? '#fff' : colors.primary} />}
      <Text style={{ color: active ? '#fff' : colors.ink, fontWeight: '600', fontSize: 14 }}>{label}</Text>
    </Pressy>
  );
}

export function Pill({ label, icon, tone = 'neutral' }: { label: string; icon?: IconName; tone?: 'neutral' | 'water' | 'ok' | 'amber' | 'danger' | 'dark' }) {
  const t = { neutral: [colors.surface2, colors.muted], water: [colors.waterTint, colors.waterDeep], ok: [colors.okTint, colors.ok], amber: [colors.amberTint, colors.warn], danger: [colors.dangerTint, colors.danger], dark: ['rgba(0,0,0,0.55)', '#fff'] }[tone];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: t[0], paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.pill, alignSelf: 'flex-start' }}>
      {icon && <Ionicons name={icon} size={12} color={t[1]} />}
      <Text style={{ fontSize: 11.5, fontWeight: '700', color: t[1] }}>{label}</Text>
    </View>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ marginBottom: space.md }}>
      <Text style={[font.label, { marginBottom: 7 }]}>{label}</Text>
      <TextInput placeholderTextColor={colors.faint} {...props}
        style={[{ backgroundColor: colors.surface, borderRadius: radius.sm, paddingHorizontal: 15, paddingVertical: 13, fontSize: 16 * runtime.textScale, color: colors.ink, fontFamily: FONT.regular }, props.multiline && { minHeight: 96, textAlignVertical: 'top' }, props.style]} />
    </View>
  );
}

export function SectionTitle({ children, right, onRight, sub }: { children: React.ReactNode; right?: string; onRight?: () => void; sub?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: space.xl + 4, marginBottom: space.md }}>
      <View style={{ flex: 1 }}>
        <Text style={font.h2}>{children}</Text>
        {sub ? <Text style={[font.small, { marginTop: 2 }]}>{sub}</Text> : null}
      </View>
      {right ? <Text onPress={onRight} style={{ color: colors.primary, fontWeight: '700', fontSize: 14 }}>{right}</Text> : null}
    </View>
  );
}

export function Banner({ tone = 'warn', icon, children }: { tone?: 'warn' | 'danger' | 'info'; icon?: IconName; children: React.ReactNode }) {
  const bg = tone === 'danger' ? colors.dangerTint : tone === 'info' ? colors.waterTint : colors.amberTint;
  const fg = tone === 'danger' ? colors.danger : tone === 'info' ? colors.waterDeep : colors.warn;
  return (
    <View style={{ flexDirection: 'row', gap: 10, padding: 13, borderRadius: radius.sm + 2, marginVertical: space.sm, backgroundColor: bg }}>
      <Ionicons name={icon ?? 'warning'} size={19} color={fg} style={{ marginTop: 1 }} />
      <Text style={{ flex: 1, fontSize: 13.5, lineHeight: 19 }}>{children}</Text>
    </View>
  );
}

export function Empty({ icon, title, body, action }: { icon: IconName; title: string; body: string; action?: React.ReactNode }) {
  return (
    <View style={{ alignItems: 'center', padding: space.xl }}>
      <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: colors.waterTint, alignItems: 'center', justifyContent: 'center' }}><Ionicons name={icon} size={34} color={colors.water} /></View>
      <Text style={[font.h2, { marginTop: space.md, textAlign: 'center' }]}>{title}</Text>
      <Text style={[font.small, { textAlign: 'center', marginTop: 6, marginBottom: space.lg, fontSize: 14, maxWidth: 320 }]}>{body}</Text>
      {action}
    </View>
  );
}

/** A rounded group of rows (settings-style). Children are <Row/>. */
export function Group({ children }: { children: React.ReactNode }) {
  const kids = React.Children.toArray(children);
  return (
    <View style={[{ borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surface }, shadow.soft, cardExtra()]}>
      {kids.map((k, i) => (<View key={i}>{i > 0 && <View style={{ height: 1, backgroundColor: colors.line, marginLeft: 66 }} />}{k}</View>))}
    </View>
  );
}

export function Row({ icon, title, subtitle, onPress, right, danger }: { icon: IconName; title: string; subtitle?: string; onPress?: () => void; right?: React.ReactNode; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13 * runtime.density, paddingHorizontal: space.lg, backgroundColor: pressed ? colors.surface2 : 'transparent' })}>
      <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: danger ? colors.dangerTint : colors.waterTint, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={20} color={danger ? colors.danger : colors.water} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[font.body, { fontWeight: '600' }, danger && { color: colors.danger }]}>{title}</Text>
        {subtitle ? <Text style={font.small}>{subtitle}</Text> : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={colors.faint} /> : null)}
    </Pressable>
  );
}

export function Stars({ value, onChange, size = 18 }: { value: number; onChange?: (n: number) => void; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable key={n} disabled={!onChange} onPress={() => onChange?.(n)} hitSlop={6} accessibilityLabel={`${n} stars`}>
          <Ionicons name={value >= n - 0.25 ? 'star' : value >= n - 0.75 ? 'star-half' : 'star-outline'} size={size} color="#E9A92C" />
        </Pressable>
      ))}
    </View>
  );
}

/** Shimmering placeholder block while real data loads. */
export function Skeleton({ w, h, r = 12, style }: { w?: number | string; h: number; r?: number; style?: StyleProp<ViewStyle> }) {
  const o = useSharedValue(0.5);
  useEffect(() => { if (runtime.motion <= 0) { o.value = 0.7; return; } o.value = withRepeat(withSequence(withTiming(1, { duration: 700 }), withTiming(0.5, { duration: 700 })), -1); }, [o]);
  const a = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[{ width: (w ?? '100%') as any, height: h, borderRadius: r, backgroundColor: colors.surface3 }, a, style]} />;
}

export const SAFETY_NOTICE =
  'Creek conditions can change quickly. Maps, trails, property boundaries and water-safety data may be incomplete or out of date. Never enter fast, rising or flooded water. Respect private property and posted signs — do not trespass. You are responsible for your own safety.';

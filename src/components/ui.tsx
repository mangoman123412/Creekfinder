import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle, type StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, font, radius, shadow, space } from '../theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export function Button({ title, onPress, icon, variant = 'primary', loading, disabled, style, small }: {
  title: string; onPress: () => void; icon?: IconName; variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'water'; loading?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle>; small?: boolean;
}) {
  const bg = { primary: colors.forest, secondary: colors.white, danger: colors.danger, ghost: 'transparent', water: colors.water }[variant];
  const fg = variant === 'secondary' ? colors.forest : variant === 'ghost' ? colors.forest : colors.white;
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={title} disabled={disabled || loading}
      onPress={() => { void Haptics.selectionAsync(); onPress(); }}
      style={({ pressed }) => [s.btn, small && s.btnSmall, { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.85 : 1 }, variant === 'secondary' && { borderWidth: 1.5, borderColor: colors.forest }, style]}
    >
      {loading ? <ActivityIndicator color={fg} /> : (
        <>
          {icon && <Ionicons name={icon} size={small ? 18 : 22} color={fg} />}
          <Text style={[s.btnText, small && { fontSize: 14 }, { color: fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Chip({ label, active, onPress, icon }: { label: string; active?: boolean; onPress?: () => void; icon?: IconName }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: !!active }}
      style={[s.chip, active && { backgroundColor: colors.forest, borderColor: colors.forest }]}>
      {icon && <Ionicons name={icon} size={15} color={active ? colors.white : colors.forest} />}
      <Text style={{ color: active ? colors.white : colors.forest, fontWeight: '600', fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ marginBottom: space.md }}>
      <Text style={s.label}>{label}</Text>
      <TextInput placeholderTextColor="#9AA59F" {...props} style={[s.input, props.multiline && { minHeight: 90, textAlignVertical: 'top' }, props.style]} />
    </View>
  );
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.xl, marginBottom: space.sm }}>
      <Text style={font.h2}>{children}</Text>
      {right}
    </View>
  );
}

export function Banner({ tone = 'warn', icon, children }: { tone?: 'warn' | 'danger' | 'info'; icon?: IconName; children: React.ReactNode }) {
  const bg = tone === 'danger' ? colors.dangerBg : tone === 'info' ? colors.waterLight : colors.warnBg;
  const fg = tone === 'danger' ? colors.danger : tone === 'info' ? colors.waterDeep : colors.warn;
  return (
    <View style={[s.banner, { backgroundColor: bg }]}>
      <Ionicons name={icon ?? 'warning'} size={20} color={fg} style={{ marginTop: 1 }} />
      <Text style={{ flex: 1, color: colors.ink, fontSize: 13.5, lineHeight: 19 }}>{children}</Text>
    </View>
  );
}

export function Empty({ icon, title, body, action }: { icon: IconName; title: string; body: string; action?: React.ReactNode }) {
  return (
    <View style={{ alignItems: 'center', padding: space.xxl }}>
      <View style={s.emptyIcon}><Ionicons name={icon} size={34} color={colors.forest} /></View>
      <Text style={[font.h2, { marginTop: space.md, textAlign: 'center' }]}>{title}</Text>
      <Text style={[font.small, { textAlign: 'center', marginTop: 6, marginBottom: space.lg, fontSize: 14 }]}>{body}</Text>
      {action}
    </View>
  );
}

export function Row({ icon, title, subtitle, onPress, right, danger }: { icon: IconName; title: string; subtitle?: string; onPress?: () => void; right?: React.ReactNode; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [s.row, pressed && { backgroundColor: '#F1EEE6' }]}>
      <View style={[s.rowIcon, danger && { backgroundColor: colors.dangerBg }]}><Ionicons name={icon} size={20} color={danger ? colors.danger : colors.forest} /></View>
      <View style={{ flex: 1 }}>
        <Text style={[font.body, { fontWeight: '600' }, danger && { color: colors.danger }]}>{title}</Text>
        {subtitle ? <Text style={font.small}>{subtitle}</Text> : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={colors.muted} /> : null)}
    </Pressable>
  );
}

export function Stars({ value, onChange, size = 22 }: { value: number; onChange?: (n: number) => void; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable key={n} disabled={!onChange} onPress={() => onChange?.(n)} hitSlop={6} accessibilityLabel={`${n} stars`}>
          <Ionicons name={value >= n - 0.25 ? 'star' : value >= n - 0.75 ? 'star-half' : 'star-outline'} size={size} color="#E0A100" />
        </Pressable>
      ))}
    </View>
  );
}

export const SAFETY_NOTICE =
  'Creek conditions can change quickly. Maps, trails, property boundaries and water-safety data may be incomplete or out of date. Never enter fast, rising or flooded water. Respect private property and posted signs — do not trespass. You are responsible for your own safety.';

const s = StyleSheet.create({
  btn: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', paddingVertical: 15, paddingHorizontal: 20, borderRadius: radius.pill, minHeight: 52 },
  btnSmall: { paddingVertical: 9, paddingHorizontal: 14, minHeight: 40 },
  btnText: { fontSize: 17, fontWeight: '700' },
  card: { backgroundColor: colors.card, borderRadius: radius.md, padding: space.lg, ...shadow, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2 },
  chip: { flexDirection: 'row', gap: 6, alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.forest, backgroundColor: colors.white, marginRight: 8 },
  label: { fontSize: 13, fontWeight: '700', color: colors.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  input: { backgroundColor: colors.white, borderRadius: radius.sm + 2, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: colors.ink },
  banner: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: radius.md, marginVertical: space.sm },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.waterLight, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: space.lg, backgroundColor: colors.white },
  rowIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.waterLight, alignItems: 'center', justifyContent: 'center' },
});

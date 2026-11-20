import React from 'react';
import { Text as RNText, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Settings, WidgetInstance } from './schema';
import { NAV_META, WIDGET_META } from './schema';
import { paletteFor } from './themeEngine';
import { markerPixels } from './markerImage';
import type { Palette } from '../theme';
import { onColor } from './colorUtils';

export const DEVICES = { small: { label: 'Small phone', w: 320, h: 640 }, phone: { label: 'Phone', w: 390, h: 800 }, large: { label: 'Large phone', w: 430, h: 880 }, tablet: { label: 'Tablet', w: 600, h: 800 } } as const;
export type DeviceId = keyof typeof DEVICES;

const toneOf = (w: WidgetInstance, p: Palette) => {
  switch (w.bg) { case 'tint': return { bg: p.waterTint, fg: p.ink }; case 'primary': return { bg: p.primary, fg: p.onPrimary }; case 'dark': return { bg: '#0F1A15', fg: '#fff' };
    case 'glass': return { bg: p.overlay, fg: p.ink }; case 'none': return { bg: 'transparent', fg: p.ink }; case 'custom': { const bg = w.customBg ?? '#FFFFFF'; return { bg, fg: onColor(bg) }; } default: return { bg: p.surface, fg: p.ink }; }
};

/** A faithful miniature of the app using the given settings. Does NOT read global design tokens, so it can preview a draft. */
export function MiniPhone({ s, systemDark, device = 'phone', width = 250 }: { s: Settings; systemDark: boolean; device?: DeviceId; width?: number }) {
  const { palette: p } = paletteFor(s.theme, systemDark, s.a11y.highContrast);
  const D = DEVICES[device]; const k = width / D.w; const H = width * (D.h / D.w);
  const corner = { sharp: 0.35, soft: 1, round: 1.55 }[s.display.corners]; const dens = { compact: 0.8, comfortable: 1, spacious: 1.25 }[s.display.density];
  const R = (n: number) => n * corner * k; const gap = 10 * dens * k; const fs = (n: number) => Math.max(5, n * k * s.display.textScale);
  const cardBorder = s.display.cardStyle === 'outlined' ? { borderWidth: 1, borderColor: p.line } : s.display.cardStyle === 'elevated' ? { shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 4 * k, shadowOffset: { width: 0, height: 2 * k } } : {};
  const items = s.nav.items.filter((i) => i.visible); const st = s.nav.style;
  const navH = (st === 'expanded' ? 74 : st === 'bottom' ? 62 : 52) * k;
  const widgets = s.home.widgets.filter((w) => w.visible);
  const wide = device === 'tablet';

  const widgetBlock = (w: WidgetInstance, i: number) => {
    const t = toneOf(w, p); const meta = WIDGET_META[w.type]; const big = w.size === 'large' ? 1.5 : w.size === 'medium' ? 1 : 0.65;
    if (w.type === 'explore_map') {
      const h = (w.size === 'large' ? 150 : w.size === 'medium' ? 100 : 66) * k;
      return (<View key={w.id + i} style={{ height: h, borderRadius: w.size === 'large' ? 0 : R(18), backgroundColor: p.primaryDeep, overflow: 'hidden', marginHorizontal: w.size === 'large' ? -12 * k : 0 }}>
        {[[0.2, 0.3, p.markerSaved], [0.55, 0.5, p.markerCommunity], [0.75, 0.25, p.markerOsm], [0.4, 0.7, p.markerVisited]].map(([x, y, c], j) => <View key={j} style={{ position: 'absolute', left: `${(x as number) * 100}%`, top: `${(y as number) * 100}%`, width: 9 * k * s.display.textScale, height: 9 * k * s.display.textScale, borderRadius: R(5), backgroundColor: c as string, borderWidth: 1.5 * k, borderColor: '#fff' }} />)}
        <View style={{ position: 'absolute', left: 6 * k, right: 6 * k, bottom: 6 * k, flexDirection: 'row', gap: 4 * k }}><View style={{ flex: 1.1, height: 16 * k, borderRadius: 9 * k, backgroundColor: p.water }} /><View style={{ flex: 1, height: 16 * k, borderRadius: 9 * k, backgroundColor: p.overlay }} /></View>
      </View>);
    }
    if (w.type === 'quick_save') return <View key={w.id + i} style={{ height: (w.size === 'large' ? 38 : w.size === 'medium' ? 28 : 22) * k, borderRadius: 99, backgroundColor: p.water, alignItems: 'center', justifyContent: 'center' }}><RNText style={{ color: '#fff', fontSize: fs(8), fontWeight: '800' }}>SAVE THIS CREEK</RNText></View>;
    const isCarousel = ['nearby', 'recent_saved', 'favorites', 'popular_waterfalls', 'new_discoveries'].includes(w.type);
    return (
      <View key={w.id + i} style={[{ backgroundColor: t.bg, borderRadius: R(16), padding: 8 * dens * k }, w.bg === 'none' ? {} : cardBorder]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 * k }}><Ionicons name={meta.icon as any} size={9 * k} color={w.bg === 'primary' || w.bg === 'dark' ? t.fg : p.primary} /><RNText style={{ color: t.fg, fontSize: fs(8.5), fontWeight: '800' }} numberOfLines={1}>{meta.title}</RNText></View>
        {isCarousel ? (
          <View style={{ flexDirection: w.size === 'large' ? 'column' : 'row', gap: 4 * k, marginTop: 5 * k }}>
            {Array.from({ length: w.size === 'large' ? 2 : w.size === 'medium' ? 2 : 3 }).map((_, j) => <View key={j} style={{ flex: w.size === 'large' ? undefined : 1, height: (w.size === 'large' ? 30 : w.size === 'medium' ? 36 : 24) * k, borderRadius: R(10), backgroundColor: [p.primary, p.water, p.amber][(j + i) % 3], opacity: 0.85 }} />)}
          </View>
        ) : <View style={{ marginTop: 5 * k, gap: 3 * k }}>{Array.from({ length: Math.max(1, Math.round(2 * big)) }).map((_, j) => <View key={j} style={{ height: 4 * k, width: `${85 - j * 18}%`, borderRadius: 3, backgroundColor: t.fg, opacity: 0.25 }} />)}</View>}
      </View>
    );
  };

  const nav = (
    <View style={{ position: 'absolute', left: 0, right: 0, bottom: st === 'bottom' || st === 'expanded' ? 0 : 8 * k, alignItems: 'center' }}>
      <View style={[{ flexDirection: 'row', backgroundColor: p.navBg, justifyContent: 'space-around', alignItems: 'center', height: navH }, st === 'floating' ? { width: '92%', borderRadius: 99, paddingHorizontal: 4 * k } : st === 'compact' ? { borderRadius: 99, paddingHorizontal: 8 * k, gap: 4 * k } : { width: '100%', borderTopWidth: 1, borderColor: p.line }, st === 'floating' || st === 'compact' ? { shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 5 * k, shadowOffset: { width: 0, height: 2 } } : {}]}>
        {items.map((it, j) => { const m = NAV_META[it.id]; const on = j === 0; const pill = st === 'floating' || st === 'compact';
          return (<View key={it.id} style={[{ alignItems: 'center', justifyContent: 'center', flexDirection: pill ? 'row' : 'column' }, pill ? { height: 34 * k, minWidth: 34 * k, borderRadius: 99, paddingHorizontal: 6 * k, backgroundColor: on ? p.primary : 'transparent', gap: 3 * k } : { flex: 1 }]}>
            <Ionicons name={((on && s.nav.iconStyle !== 'outline') || s.nav.iconStyle === 'filled' ? (it.icon ?? m.icon) : `${it.icon ?? m.icon}-outline`) as any} size={(st === 'expanded' ? 17 : 13) * k * (s.display.iconSize === 'large' ? 1.25 : s.display.iconSize === 'small' ? 0.85 : 1)} color={pill ? (on ? p.onPrimary : p.muted) : on ? p.primary : p.muted} />
            {(s.nav.labels === 'always' || (s.nav.labels === 'auto' && ((st === 'floating' && on) || st === 'bottom' || st === 'expanded'))) ? <RNText numberOfLines={1} style={{ fontSize: fs(6.5), color: pill ? (on ? p.onPrimary : p.muted) : on ? p.primary : p.muted, fontWeight: '700' }}>{it.label || m.label}</RNText> : null}
          </View>); })}
      </View>
    </View>
  );

  return (
    <View style={{ width: width + 10, height: H + 10, borderRadius: 26 * k + 8, backgroundColor: '#111', padding: 5, alignItems: 'center' }} accessibilityLabel="Live preview of your design" accessible>
      <View style={{ width, height: H, borderRadius: 22 * k + 6, overflow: 'hidden', backgroundColor: p.bg }}>
        <View style={{ height: 14 * k, alignItems: 'center', justifyContent: 'center' }}><View style={{ width: 40 * k, height: 4 * k, borderRadius: 3, backgroundColor: p.ink, opacity: 0.2 }} /></View>
        <View style={{ paddingHorizontal: 12 * k, gap, flexDirection: wide ? 'row' : 'column', flexWrap: 'wrap' }}>
          {widgets.length === 0 ? <RNText style={{ color: p.muted, fontSize: fs(9), textAlign: 'center', marginTop: 40 * k }}>No widgets yet</RNText> : widgets.map((w, i) => <View key={w.id + i} style={wide ? { width: '48%' } : undefined}>{widgetBlock(w, i)}</View>)}
        </View>
        {nav}
      </View>
    </View>
  );
}
void markerPixels;

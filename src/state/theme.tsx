import React, { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, useColorScheme } from 'react-native';
import { applySettings, setSystemReduceMotion } from '../custom/runtime';
import { mutate, useSettings, hydrateFrom } from '../custom/store';
import { kvGet, kvSet } from '../db/local';
import { setPersistHook } from '../custom/store';
import { isDark } from '../theme';
import { ensureFontFamily, fontReady } from '../custom/fonts';
import type { ThemeSpec } from '../custom/schema';

export type ThemePref = 'system' | 'light' | 'dark';
export function useTheme() {
  const s = useSettings();
  return { dark: isDark(), pref: s.theme.mode as ThemePref, setPref: (p: ThemePref) => mutate((d) => { d.theme.mode = p; }) };
}
void ({} as ThemeSpec);

/** Applies the user's customization to the design tokens before any child renders, and hydrates/persists the library. */
export function ThemeProvider({ children }: { children: (key: string) => React.ReactNode }) {
  const system = useColorScheme();
  const settings = useSettings();
  const [, setTick] = useState(0);
  useEffect(() => {
    setPersistHook((lib) => { void kvSet('custom_lib', JSON.stringify(lib)).catch(() => {}); });
    void kvGet('custom_lib').then((raw) => { try { hydrateFrom(raw ? JSON.parse(raw) : null); } catch { hydrateFrom(null); } }).catch(() => hydrateFrom(null));
    AccessibilityInfo.isReduceMotionEnabled().then((v) => { setSystemReduceMotion(v); setTick((t) => t + 1); }).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => { setSystemReduceMotion(v); setTick((t) => t + 1); });
    return () => sub.remove();
  }, []);
  useEffect(() => { if (!fontReady(settings.display.font)) void ensureFontFamily(settings.display.font).then((c) => { if (c) setTick((t) => t + 1); }).catch(() => {}); }, [settings.display.font]);
  applySettings(settings, system === 'dark');
  if (!fontReady(settings.display.font)) { /* family still loading: Inter is used until it arrives */ }
  const key = useMemo(() => 'app', []);
  return <>{children(key)}</>;
}

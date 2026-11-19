import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Platform, useColorScheme } from 'react-native';
import { applyScheme, colors } from '../theme';
import { kvGet, kvSet } from '../db/local';

export type ThemePref = 'system' | 'light' | 'dark';
interface Ctx { dark: boolean; pref: ThemePref; setPref: (p: ThemePref) => void }
const ThemeCtx = createContext<Ctx>({ dark: false, pref: 'system', setPref: () => {} });
export const useTheme = () => useContext(ThemeCtx);

const initialPref = (): ThemePref => {
  if (Platform.OS === 'web') { try { const v = localStorage.getItem('cf_theme'); if (v === 'light' || v === 'dark' || v === 'system') return v; } catch {} }
  return 'system';
};

export function ThemeProvider({ children }: { children: (key: string) => React.ReactNode }) {
  const system = useColorScheme();
  const [pref, setPrefState] = useState<ThemePref>(initialPref);
  useEffect(() => { void kvGet('theme').then((v) => { if (v === 'light' || v === 'dark' || v === 'system') setPrefState(v); }).catch(() => {}); }, []);
  const dark = pref === 'dark' || (pref === 'system' && system === 'dark');
  applyScheme(dark ? 'dark' : 'light'); // before children render
  const setPref = (p: ThemePref) => {
    setPrefState(p); void kvSet('theme', p).catch(() => {});
    if (Platform.OS === 'web') { try { localStorage.setItem('cf_theme', p); } catch {} }
  };
  const value = useMemo(() => ({ dark, pref, setPref }), [dark, pref]); // eslint-disable-line react-hooks/exhaustive-deps
  return <ThemeCtx.Provider value={value}>{children(dark ? 'dark' : 'light')}</ThemeCtx.Provider>;
}
export { colors };
